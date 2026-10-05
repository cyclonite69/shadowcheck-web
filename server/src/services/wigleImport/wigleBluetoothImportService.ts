import type { PoolClient } from 'pg';
import logger from '../../logging/logger';
import { getLongRunningAdminPool } from '../adminDbService';
import {
  completeRun,
  createImportRun,
  findRunByRawFingerprint,
  getImportRun,
  getRunOrThrow,
  markRunControlStatus,
  markRunFailure,
  persistPageFailure,
  reconcileRunProgress,
} from './runRepository';
import {
  normalizeBtImportParams,
  validateBtImportQuery,
  getBtSearchTerm,
  getBtRequestFingerprint,
  DEFAULT_BT_RESULTS_PER_PAGE,
  type WigleBtImportParams,
} from './btParams';
import { processSuccessfulBtPage } from './btPageProcessor';
import { getEncodedWigleAuth } from './authProvider';
import { getAdaptiveDelay, sleep } from './rateLimitingStrategy';
import { fetchBtPage, type WigleBtPageResponse } from './btApiClient';
import {
  acquireGlobalWigleLock,
  acquireRunWigleLock,
  findActiveWigleRunId,
  releaseGlobalWigleLock,
  releaseRunWigleLock,
  transitionRunToRunning,
} from './wigleLocks';
import { type WigleDispatchResult, reconcileOrphanRuns } from './use-cases/manageImportRuns';

const RESUMABLE_STATUSES = ['running', 'paused', 'failed'];

/**
 * Execute the main import loop for a BT/BLE run.
 * Mirrors executeImportLoop in wigleImportRunService.ts but uses BT-specific
 * fetch and page-commit functions.
 */
const executeBluetoothImportLoop = async (runId: number) => {
  const encodedAuth = getEncodedWigleAuth();
  let run = await reconcileRunProgress(runId);

  if (run.status === 'completed' || run.status === 'cancelled') {
    return run;
  }

  const requestParams: WigleBtImportParams = normalizeBtImportParams(run.request_params || {});

  const computeRetryDelayMs = (retryAfterRaw: unknown): number => {
    const fallbackMs = 60_000;
    const raw = typeof retryAfterRaw === 'string' ? retryAfterRaw.trim() : '';
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    const baseMs = Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : fallbackMs;
    const jitterMs = Math.floor(baseMs * (Math.random() * 0.1));
    return baseMs + jitterMs;
  };

  for (;;) {
    run = await getRunOrThrow(runId);

    if (run.status === 'paused' || run.status === 'cancelled') {
      logger.info('[WiGLE BT Import] Run stopped by operator', { runId, status: run.status });
      return run;
    }

    const pageNumber = Number(run.next_page || 1);
    const requestCursor = run.api_cursor || null;

    logger.info('[WiGLE BT Import] Fetching page', {
      runId,
      pageNumber,
      requestCursor,
      state: run.state,
      searchTerm: run.search_term,
    });

    let data: WigleBtPageResponse | null;
    try {
      try {
        data = await fetchBtPage(encodedAuth, requestParams, requestCursor);
      } catch (error: any) {
        if (error?.status === 401 || error?.status === 403) {
          logger.error('[WiGLE BT Import] AUTH ERROR — halting pipeline', {
            runId,
            pageNumber,
            status: error?.status,
          });
          throw error;
        }

        if (error?.status === 429) {
          const delayMs = computeRetryDelayMs(error?.retryAfter);
          logger.warn('[WiGLE BT Import] Rate limited (429) — waiting then retrying once', {
            runId,
            pageNumber,
            delayMs,
          });
          await sleep(delayMs);

          try {
            data = await fetchBtPage(encodedAuth, requestParams, requestCursor);
          } catch (retryError: any) {
            if (retryError?.status === 429) {
              logger.error('[WiGLE BT Import] Rate limited again after retry — halting', {
                runId,
                pageNumber,
              });
            }
            throw retryError;
          }
        } else {
          throw error;
        }
      }

      const results = Array.isArray(data?.results) ? data.results : [];
      const liveTotal =
        data?.totalResults !== undefined && data?.totalResults !== null
          ? Number(data.totalResults)
          : null;
      const totalResults =
        liveTotal ?? (run.api_total_results !== null ? Number(run.api_total_results) : null);
      const nextCursor =
        data?.search_after !== undefined && data?.search_after !== null
          ? String(data.search_after)
          : null;
      const pageSize = requestParams.resultsPerPage || DEFAULT_BT_RESULTS_PER_PAGE;

      if (results.length === 0 && nextCursor === null) {
        const note =
          pageNumber === 1
            ? 'No records returned on first page — API quota may be exhausted or no results match the search'
            : undefined;
        return completeRun(runId, note);
      }

      const totalPages =
        totalResults !== null ? Math.max(1, Math.ceil(totalResults / pageSize)) : null;
      const isComplete =
        nextCursor === null &&
        (totalPages === null || pageNumber >= totalPages || results.length < pageSize);

      run = await processSuccessfulBtPage(
        runId,
        pageNumber,
        requestCursor,
        nextCursor,
        results,
        liveTotal,
        pageSize,
        isComplete
      );

      if (isComplete) {
        return run;
      }

      await sleep(getAdaptiveDelay());
    } catch (error: any) {
      const errorMessage = error?.details || error?.message || 'WiGLE BT import page failed';
      await persistPageFailure(runId, pageNumber, requestCursor, errorMessage);
      if (error?.status === 401 || error?.status === 403) {
        run = await markRunFailure(runId, errorMessage);
      } else if (error?.status === 429) {
        run = await markRunControlStatus(runId, 'paused');
        logger.warn('[WiGLE BT Import] Daily quota exhausted — run paused', { runId, pageNumber });
      } else {
        run = await markRunFailure(runId, errorMessage);
      }
      return run;
    }
  }
};

/**
 * Execute Bluetooth import loop with dedicated session advisory locks.
 */
async function executeBluetoothImportWithLocks(
  client: PoolClient,
  runId: number,
  globalLockAcquired: boolean,
  runLockAcquired: boolean
): Promise<any> {
  try {
    return await executeBluetoothImportLoop(runId);
  } catch (error: any) {
    logger.error('[WiGLE BT Import] Background worker encountered error', {
      runId,
      error: error?.message || String(error),
    });
    const errorMessage = error?.details || error?.message || 'WiGLE BT import run failed';
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
 * Asynchronously dispatch a Bluetooth/BLE import run.
 * Participates in the shared global WiGLE serialization lock and per-run identity lock.
 */
export const dispatchBluetoothImportRun = async (
  rawQuery: Record<string, unknown>
): Promise<WigleDispatchResult> => {
  const validationError = validateBtImportQuery(rawQuery);
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

      const normalized = normalizeBtImportParams(rawQuery);
      const fingerprint = getBtRequestFingerprint(normalized);
      const existing = await findRunByRawFingerprint(fingerprint, RESUMABLE_STATUSES).catch(
        () => null
      );
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
      logger.warn('[WiGLE BT Import] Dispatch orphan reconciliation encountered warning', {
        error: err.message,
      });
    });

    const normalized = normalizeBtImportParams(rawQuery);
    const fingerprint = getBtRequestFingerprint(normalized);
    let run = await findRunByRawFingerprint(fingerprint, RESUMABLE_STATUSES);

    if (run) {
      logger.info('[WiGLE BT Import] Resuming existing run', {
        runId: run.id,
        status: run.status,
      });
    } else {
      run = await createImportRun(normalized as Record<string, unknown>, {
        source: 'wigle_bt',
        api_version: 'v2',
        search_term: getBtSearchTerm(normalized),
      });
      logger.info('[WiGLE BT Import] Created run', {
        runId: run?.id,
        searchTerm: run?.search_term,
      });
    }

    runId = Number(run.id);
    runLockAcquired = await acquireRunWigleLock(client, runId);
    if (!runLockAcquired) {
      throw new Error(`Failed to acquire per-run lock for WiGLE BT import run ${runId}`);
    }

    const updatedRow = await transitionRunToRunning(client, runId);
    if (!updatedRow) {
      throw new Error(`WiGLE BT import run ${runId} is not in a runnable state`);
    }

    // Launch background worker without awaiting it
    workerSpawned = true;
    void executeBluetoothImportWithLocks(client, runId, globalLockAcquired, runLockAcquired).catch(
      (err) => {
        logger.error('[WiGLE BT Import] Unhandled background worker rejection', {
          runId,
          error: err.message,
        });
      }
    );

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
};

/**
 * Asynchronously dispatch resumption of a specific Bluetooth import run by ID.
 */
export const dispatchResumeBluetoothImportRun = async (
  runId: number
): Promise<WigleDispatchResult> => {
  if (!Number.isFinite(runId)) {
    throw new Error('Invalid run id');
  }

  const existingRun = await getRunOrThrow(runId);
  if (existingRun.status === 'completed') {
    throw new Error('Cannot resume an import run that is already completed');
  }
  if (existingRun.status === 'cancelled') {
    throw new Error('Cannot resume a cancelled WiGLE BT import run');
  }
  // Cross-source guard: Bluetooth import runner must not resume WiFi imports
  if (existingRun.source && existingRun.source !== 'wigle_bt') {
    throw new Error('Cannot resume non-Bluetooth import run via Bluetooth service');
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
      logger.warn('[WiGLE BT Import] Dispatch orphan reconciliation encountered warning', {
        error: err.message,
      });
    });

    runLockAcquired = await acquireRunWigleLock(client, runId);
    if (!runLockAcquired) {
      throw new Error(`Failed to acquire per-run lock for WiGLE BT import run ${runId}`);
    }

    const updatedRow = await transitionRunToRunning(client, runId);
    if (!updatedRow) {
      throw new Error(`WiGLE BT import run ${runId} is not in a runnable state`);
    }

    // Launch background worker without awaiting it
    workerSpawned = true;
    void executeBluetoothImportWithLocks(client, runId, globalLockAcquired, runLockAcquired).catch(
      (err) => {
        logger.error('[WiGLE BT Import] Unhandled background worker rejection', {
          runId,
          error: err.message,
        });
      }
    );

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
};

/**
 * Start a new BT/BLE import run, or resume the latest matching run if one exists (synchronous).
 */
export const startBluetoothImportRun = async (rawQuery: Record<string, unknown>) => {
  const validationError = validateBtImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
  }

  const normalized = normalizeBtImportParams(rawQuery);
  const fingerprint = getBtRequestFingerprint(normalized);

  const existing = await findRunByRawFingerprint(fingerprint, RESUMABLE_STATUSES);

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
      logger.warn('[WiGLE BT Import] Startup orphan reconciliation encountered warning', {
        error: err.message,
      });
    });

    if (existing) {
      runId = Number(existing.id);
    } else {
      const run = await createImportRun(normalized as Record<string, unknown>, {
        source: 'wigle_bt',
        api_version: 'v2',
        search_term: getBtSearchTerm(normalized),
      });
      runId = Number(run.id);
    }

    runLockAcquired = await acquireRunWigleLock(client, runId);
    if (!runLockAcquired) {
      throw new Error(`Failed to acquire per-run lock for WiGLE BT import run ${runId}`);
    }

    const updatedRow = await transitionRunToRunning(client, runId);
    if (!updatedRow) {
      throw new Error(`WiGLE BT import run ${runId} is not in a runnable state`);
    }

    executionStarted = true;
    const finalRun = await executeBluetoothImportWithLocks(
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
      client.release();
    }
    throw err;
  }
};

/**
 * Resume a specific BT import run by ID (synchronous).
 */
export const resumeBluetoothImportRun = async (runId: number) => {
  const existingRun = await getRunOrThrow(runId);
  if (existingRun.status === 'completed') {
    return getImportRun(runId);
  }
  if (existingRun.status === 'cancelled') {
    throw new Error('Cannot resume a cancelled import run');
  }
  // Cross-source guard: Bluetooth import runner must not resume WiFi imports
  if (existingRun.source && existingRun.source !== 'wigle_bt') {
    throw new Error('Cannot resume non-Bluetooth import run via Bluetooth service');
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
      logger.warn('[WiGLE BT Import] Resumption orphan reconciliation encountered warning', {
        error: err.message,
      });
    });

    runLockAcquired = await acquireRunWigleLock(client, runId);
    if (!runLockAcquired) {
      throw new Error(`Failed to acquire per-run lock for WiGLE BT import run ${runId}`);
    }

    const updatedRow = await transitionRunToRunning(client, runId);
    if (!updatedRow) {
      throw new Error(`WiGLE BT import run ${runId} is not in a runnable state`);
    }

    executionStarted = true;
    const finalRun = await executeBluetoothImportWithLocks(
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

export { validateBtImportQuery };
