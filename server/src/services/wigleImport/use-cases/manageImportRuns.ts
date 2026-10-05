import type { PoolClient } from 'pg';
import logger from '../../../logging/logger';
import { getLongRunningAdminPool } from '../../adminDbService';
import {
  findLatestResumableRun,
  getImportRun,
  getRunOrThrow,
  markRunControlStatus,
  markRunFailure,
} from '../runRepository';
import {
  cancelRun,
  findLatestResumable,
  initializeImportRun,
  pauseRun,
  prepareRunForResumption,
} from '../runStateManager';
import { WigleImportRunOrchestrator } from '../orchestrators/WigleImportRunOrchestrator';
import { validateImportQuery } from '../params';
import {
  WIGLE_RUN_LOCK_CLASSID,
  acquireGlobalWigleLock,
  acquireRunWigleLock,
  findActiveWigleRunId,
  releaseGlobalWigleLock,
  releaseRunWigleLock,
  transitionRunToRunning,
} from '../wigleLocks';

const orchestrator = new WigleImportRunOrchestrator();

export interface WigleDispatchSuccess {
  status: 'dispatched';
  run: any;
}

export interface WigleDispatchAlreadyRunning {
  status: 'already_running';
  activeRunId: number | null;
  isSameRun: boolean;
  run?: any;
  error?: string;
}

export type WigleDispatchResult = WigleDispatchSuccess | WigleDispatchAlreadyRunning;

/**
 * Execute the orchestrator import loop while holding dedicated session locks.
 * Guarantees release of per-run lock, global lock, and PoolClient in reverse acquisition order.
 */
async function executeImportWithLocks(
  client: PoolClient,
  runId: number,
  globalLockAcquired: boolean,
  runLockAcquired: boolean
): Promise<any> {
  try {
    return await orchestrator.execute(runId);
  } catch (error: any) {
    logger.error('[WiGLE Import] Background worker encountered error', {
      runId,
      error: error?.message || String(error),
    });
    const errorMessage = error?.details || error?.message || 'WiGLE import run failed';
    if (error?.status === 429) {
      await markRunControlStatus(runId, 'paused').catch(() => {});
    } else {
      await markRunFailure(runId, errorMessage).catch(() => {});
    }
    throw error;
  } finally {
    let releaseFailed = false;
    if (runLockAcquired) {
      const ok = await releaseRunWigleLock(client, runId).catch(() => false);
      if (!ok) {
        releaseFailed = true;
      }
    }
    if (globalLockAcquired) {
      const ok = await releaseGlobalWigleLock(client).catch(() => false);
      if (!ok) {
        releaseFailed = true;
      }
    }
    if (releaseFailed) {
      client.release(true);
    } else {
      client.release();
    }
  }
}

/**
 * Asynchronously dispatch a new WiGLE import run (or resume matching existing run).
 * Returns immediately with the initial run representation once locks and atomic status are secured.
 */
export async function dispatchImportRun(
  rawQuery: Record<string, unknown>
): Promise<WigleDispatchResult> {
  const validationError = validateImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
  }

  const pool = getLongRunningAdminPool();
  if (!pool) {
    throw new Error('Long-running admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }

  const client = await pool.connect();
  let globalLockAcquired = false;
  let runLockAcquired = false;
  let runId: number | null = null;
  let workerSpawned = false;
  let clientReleased = false;

  try {
    globalLockAcquired = await acquireGlobalWigleLock(client);
    if (!globalLockAcquired) {
      const activeRunId = await findActiveWigleRunId(client);
      client.release();
      clientReleased = true;

      const existing = await findLatestResumableRun(rawQuery, [
        'running',
        'paused',
        'failed',
      ]).catch(() => null);
      const isSameRun = Boolean(existing && Number(existing.id) === activeRunId);
      const activeRun = activeRunId
        ? await getImportRun(activeRunId).catch(() => null)
        : existing
          ? await getImportRun(Number(existing.id)).catch(() => null)
          : null;

      return {
        status: 'already_running',
        activeRunId,
        isSameRun,
        run: isSameRun ? (activeRun ?? undefined) : undefined,
        error: isSameRun
          ? undefined
          : `Another WiGLE import (run ${activeRunId ?? 'unknown'}) is currently running`,
      };
    }

    // Reconcile any dead runs on this dedicated connection before dispatching new run
    await reconcileOrphanRuns(client).catch((err) => {
      logger.warn('[WiGLE Import] Dispatch orphan reconciliation encountered warning', {
        error: err.message,
      });
    });

    const run = await initializeImportRun(rawQuery);
    runId = Number(run.id);

    runLockAcquired = await acquireRunWigleLock(client, runId);
    if (!runLockAcquired) {
      throw new Error(`Failed to acquire per-run lock for WiGLE import run ${runId}`);
    }

    const updatedRow = await transitionRunToRunning(client, runId);
    if (!updatedRow) {
      throw new Error(`WiGLE import run ${runId} is not in a runnable state`);
    }

    // Launch background worker without awaiting it
    workerSpawned = true;
    void executeImportWithLocks(client, runId, globalLockAcquired, runLockAcquired).catch((err) => {
      logger.error('[WiGLE Import] Unhandled background worker rejection', {
        runId,
        error: err.message,
      });
    });

    const serializedRun = await getImportRun(runId);
    return {
      status: 'dispatched',
      run: serializedRun,
    };
  } catch (err) {
    if (!workerSpawned) {
      if (runLockAcquired && runId !== null) {
        await releaseRunWigleLock(client, runId).catch(() => {});
      }
      if (globalLockAcquired) {
        await releaseGlobalWigleLock(client).catch(() => {});
      }
      if (runId !== null) {
        await markRunFailure(
          runId,
          `Dispatch aborted: ${err instanceof Error ? err.message : String(err)}`
        ).catch(() => {});
      }
      if (!clientReleased) {
        client.release();
      }
    }
    throw err;
  }
}

/**
 * Asynchronously dispatch resumption of a specific existing WiGLE import run.
 * Returns immediately with the initial run representation once locks and atomic status are secured.
 */
export async function dispatchResumeImportRun(runId: number): Promise<WigleDispatchResult> {
  if (!Number.isFinite(runId)) {
    throw new Error('Invalid run id');
  }

  const existingRun = await getRunOrThrow(runId);
  if (existingRun.status === 'completed') {
    throw new Error('Cannot resume an import run that is already completed');
  }
  if (existingRun.status === 'cancelled') {
    throw new Error('Cannot resume a cancelled WiGLE import run');
  }
  // Cross-source guard: WiFi import runner must not resume Bluetooth imports
  if (existingRun.source && existingRun.source === 'wigle_bt') {
    throw new Error('Cannot resume Bluetooth import run via WiFi search service');
  }

  const pool = getLongRunningAdminPool();
  if (!pool) {
    throw new Error('Long-running admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }

  const client = await pool.connect();
  let globalLockAcquired = false;
  let runLockAcquired = false;
  let workerSpawned = false;
  let clientReleased = false;

  try {
    globalLockAcquired = await acquireGlobalWigleLock(client);
    if (!globalLockAcquired) {
      const activeRunId = await findActiveWigleRunId(client);
      client.release();
      clientReleased = true;

      const isSameRun = activeRunId === runId;
      const activeRun = activeRunId ? await getImportRun(activeRunId).catch(() => null) : null;

      return {
        status: 'already_running',
        activeRunId,
        isSameRun,
        run: isSameRun ? (activeRun ?? existingRun) : undefined,
        error: isSameRun
          ? undefined
          : `Another WiGLE import (run ${activeRunId ?? 'unknown'}) is currently running`,
      };
    }

    // Reconcile any dead runs on this dedicated connection before resuming
    await reconcileOrphanRuns(client).catch((err) => {
      logger.warn('[WiGLE Import] Dispatch orphan reconciliation encountered warning', {
        error: err.message,
      });
    });

    runLockAcquired = await acquireRunWigleLock(client, runId);
    if (!runLockAcquired) {
      throw new Error(`Failed to acquire per-run lock for WiGLE import run ${runId}`);
    }

    const updatedRow = await transitionRunToRunning(client, runId);
    if (!updatedRow) {
      throw new Error(`WiGLE import run ${runId} is not in a runnable state`);
    }

    // Launch background worker without awaiting it
    workerSpawned = true;
    void executeImportWithLocks(client, runId, globalLockAcquired, runLockAcquired).catch((err) => {
      logger.error('[WiGLE Import] Unhandled background worker rejection', {
        runId,
        error: err.message,
      });
    });

    const serializedRun = await getImportRun(runId);
    return {
      status: 'dispatched',
      run: serializedRun,
    };
  } catch (err) {
    if (!workerSpawned) {
      if (runLockAcquired) {
        await releaseRunWigleLock(client, runId).catch(() => {});
      }
      if (globalLockAcquired) {
        await releaseGlobalWigleLock(client).catch(() => {});
      }
      if (!clientReleased) {
        client.release();
      }
    }
    throw err;
  }
}

/**
 * Asynchronously dispatch resumption of the latest resumable run for the same query,
 * or start a new run.
 */
export async function dispatchResumeLatestImportRun(
  rawQuery: Record<string, unknown>
): Promise<WigleDispatchResult> {
  const latest = await findLatestResumable(rawQuery);
  if (!latest) {
    return dispatchImportRun(rawQuery);
  }
  return dispatchResumeImportRun(Number(latest.id));
}

/**
 * Reconcile orphaned WiGLE import runs left behind by process crashes or restarts.
 * Adheres strictly to the rule: If the global lock cannot be acquired, ZERO mutating updates occur.
 */
export async function reconcileOrphanRuns(existingClient?: PoolClient): Promise<{
  reconciledCount: number;
  reconciledIds: number[];
  status: 'reconciled' | 'skipped_active';
  activeRunId?: number | null;
}> {
  const pool = existingClient ? null : getLongRunningAdminPool();
  if (!existingClient && !pool) {
    logger.warn('[WiGLE Orphan Reconciliation] Long-running admin pool unavailable');
    return { reconciledCount: 0, reconciledIds: [], status: 'skipped_active' };
  }

  const client = existingClient ?? (await pool!.connect());
  let globalLockAcquired = Boolean(existingClient);

  try {
    if (!existingClient) {
      globalLockAcquired = await acquireGlobalWigleLock(client);
      if (!globalLockAcquired) {
        const activeRunId = await findActiveWigleRunId(client);
        logger.info(
          '[WiGLE Orphan Reconciliation] Global lock held by active import; skipping mutation',
          { activeRunId }
        );
        return {
          reconciledCount: 0,
          reconciledIds: [],
          status: 'skipped_active',
          activeRunId,
        };
      }
    }

    const result = await client.query(
      `
      UPDATE app.wigle_import_runs
         SET status = 'paused',
             last_error = 'Interrupted by server restart or process termination. Checkpoint preserved; ready to resume.',
             updated_at = NOW()
       WHERE status = 'running'
         AND NOT EXISTS (
           SELECT 1
             FROM pg_locks l
            WHERE l.locktype = 'advisory'
              AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
              AND l.classid = $1
              AND l.objid = app.wigle_import_runs.id::oid
              AND l.objsubid = 2
              AND l.granted = true
         )
      RETURNING id;
      `,
      [WIGLE_RUN_LOCK_CLASSID]
    );

    const reconciledIds = (result.rows || []).map((r: any) => Number(r.id));
    if (reconciledIds.length > 0) {
      logger.warn('[WiGLE Orphan Reconciliation] Paused orphaned WiGLE import run(s)', {
        count: reconciledIds.length,
        runIds: reconciledIds,
      });
    }

    return {
      reconciledCount: reconciledIds.length,
      reconciledIds,
      status: 'reconciled',
    };
  } finally {
    if (!existingClient) {
      if (globalLockAcquired) {
        await releaseGlobalWigleLock(client).catch(() => {});
      }
      client.release();
    }
  }
}

/**
 * Start a new WiGLE import run and execute its page loop synchronously.
 */
export const startImportRun = async (rawQuery: Record<string, unknown>) => {
  const pool = getLongRunningAdminPool();
  if (!pool) {
    throw new Error('Long-running admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }

  const client = await pool.connect();
  let globalLockAcquired = false;
  let runLockAcquired = false;
  let runId: number | null = null;
  let executionStarted = false;

  try {
    globalLockAcquired = await acquireGlobalWigleLock(client);
    if (!globalLockAcquired) {
      const activeRunId = await findActiveWigleRunId(client);
      throw new Error(
        `Another WiGLE import (run ${activeRunId ?? 'unknown'}) is currently running`
      );
    }

    await reconcileOrphanRuns(client).catch((err) => {
      logger.warn('[WiGLE Import] Startup orphan reconciliation encountered warning', {
        error: err.message,
      });
    });

    const run = await initializeImportRun(rawQuery);
    runId = Number(run.id);

    // If an existing matching run was found and it is already paused, do not auto-resume it.
    // Explicit resume (resumeImportRun) is required to restart a paused run.
    if (run.status === 'paused') {
      if (globalLockAcquired) {
        await releaseGlobalWigleLock(client).catch(() => {});
      }
      client.release();
      return getImportRun(runId);
    }

    runLockAcquired = await acquireRunWigleLock(client, runId);
    if (!runLockAcquired) {
      throw new Error(`Failed to acquire per-run lock for WiGLE import run ${runId}`);
    }

    const updatedRow = await transitionRunToRunning(client, runId);
    if (!updatedRow) {
      throw new Error(`WiGLE import run ${runId} is not in a runnable state`);
    }

    executionStarted = true;
    const finalRun = await executeImportWithLocks(
      client,
      runId,
      globalLockAcquired,
      runLockAcquired
    );
    return getImportRun(Number(finalRun.id));
  } catch (err) {
    if (!executionStarted) {
      if (runLockAcquired && runId !== null) {
        await releaseRunWigleLock(client, runId).catch(() => {});
      }
      if (globalLockAcquired) {
        await releaseGlobalWigleLock(client).catch(() => {});
      }
      if (runId !== null) {
        await markRunFailure(
          runId,
          `Execution aborted: ${err instanceof Error ? err.message : String(err)}`
        ).catch(() => {});
      }
      client.release();
    }
    throw err;
  }
};

/**
 * Resume an existing persisted WiGLE import run synchronously.
 */
export const resumeImportRun = async (runId: number) => {
  const existingRun = await getRunOrThrow(runId);
  if (existingRun.status === 'completed') {
    return getImportRun(runId);
  }
  if (existingRun.status === 'cancelled') {
    throw new Error('Cannot resume a cancelled WiGLE import run');
  }
  // Cross-source guard: WiFi import runner must not resume Bluetooth imports
  if (existingRun.source && existingRun.source === 'wigle_bt') {
    throw new Error('Cannot resume Bluetooth import run via WiFi search service');
  }

  const pool = getLongRunningAdminPool();
  if (!pool) {
    throw new Error('Long-running admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }

  const client = await pool.connect();
  let globalLockAcquired = false;
  let runLockAcquired = false;
  let executionStarted = false;

  try {
    globalLockAcquired = await acquireGlobalWigleLock(client);
    if (!globalLockAcquired) {
      const activeRunId = await findActiveWigleRunId(client);
      throw new Error(
        `Another WiGLE import (run ${activeRunId ?? 'unknown'}) is currently running`
      );
    }

    await reconcileOrphanRuns(client).catch((err) => {
      logger.warn('[WiGLE Import] Resumption orphan reconciliation encountered warning', {
        error: err.message,
      });
    });

    runLockAcquired = await acquireRunWigleLock(client, runId);
    if (!runLockAcquired) {
      throw new Error(`Failed to acquire per-run lock for WiGLE import run ${runId}`);
    }

    await prepareRunForResumption(runId);
    const updatedRow = await transitionRunToRunning(client, runId);
    if (!updatedRow) {
      throw new Error(`WiGLE import run ${runId} is not in a runnable state`);
    }

    executionStarted = true;
    const finalRun = await executeImportWithLocks(
      client,
      runId,
      globalLockAcquired,
      runLockAcquired
    );
    return getImportRun(Number(finalRun.id));
  } catch (err) {
    if (!executionStarted) {
      if (runLockAcquired) {
        await releaseRunWigleLock(client, runId).catch(() => {});
      }
      if (globalLockAcquired) {
        await releaseGlobalWigleLock(client).catch(() => {});
      }
      client.release();
    }
    throw err;
  }
};

/**
 * Resume the latest resumable run for the same query, or start a new run synchronously.
 */
export const resumeLatestImportRun = async (rawQuery: Record<string, unknown>) => {
  const latest = await findLatestResumable(rawQuery);
  if (!latest) {
    return startImportRun(rawQuery);
  }
  return resumeImportRun(Number(latest.id));
};

/**
 * Find the latest resumable run for a query without mutating it.
 */
export const getLatestResumableImportRun = async (rawQuery: Record<string, unknown>) => {
  return findLatestResumable(rawQuery);
};

/**
 * Pause a running import.
 */
export const pauseImportRun = async (runId: number) => {
  return pauseRun(runId);
};

/**
 * Cancel a running or resumable import.
 */
export const cancelImportRun = async (runId: number) => {
  return cancelRun(runId);
};
