import logger from '../../logging/logger';
import {
  countRecentCancelledByFingerprint,
  createImportRun,
  findLatestResumableRun,
  getImportRun,
  getRunOrThrow,
  markRunControlStatus,
  resumeRunState,
} from './runRepository';
import {
  getRequestFingerprint,
  normalizeImportParams,
  validateImportQuery,
  type WigleImportParams,
} from './params';

export type WigleImportRunStatus = 'running' | 'paused' | 'failed' | 'completed' | 'cancelled';

const RESUMABLE_STATUSES: WigleImportRunStatus[] = ['running', 'paused', 'failed'];

/**
 * Initiate a new WiGLE import run or resume existing
 */
export const initializeImportRun = async (rawQuery: Record<string, unknown>) => {
  const validationError = validateImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
  }

  // Check for existing resumable run with same query
  const existing = await findLatestResumableRun(rawQuery, RESUMABLE_STATUSES);
  if (existing) {
    logger.info('[WiGLE Import] Resuming existing run instead of creating duplicate', {
      runId: existing.id,
      status: existing.status,
      nextPage: existing.next_page,
    });
    return existing;
  }

  // Cluster guard: if ≥3 identical cancelled runs created recently, refuse
  const normalized = normalizeImportParams(rawQuery);
  const fingerprint = getRequestFingerprint(normalized);
  const recentCancelled = await countRecentCancelledByFingerprint(fingerprint, 60);
  if (recentCancelled >= 3) {
    throw new Error(
      `Cluster guard: ${recentCancelled} identical cancelled runs created in the last 60 seconds. ` +
        `Use the "Clean Up" tool to clear the cluster first.`
    );
  }

  // Create new run
  const run = await createImportRun(rawQuery);
  logger.info('[WiGLE Import] Created run', {
    runId: run?.id,
    state: run?.state,
    searchTerm: run?.search_term,
  });
  return run;
};

/**
 * Prepare a run for resumption from checkpoint
 */
export const prepareRunForResumption = async (runId: number) => {
  const run = await getRunOrThrow(runId);

  if (run.status === 'completed') {
    logger.info('[WiGLE Import] Run already completed', { runId });
    return run;
  }

  if (run.status === 'cancelled') {
    throw new Error('Cannot resume a cancelled WiGLE import run');
  }

  await resumeRunState(runId);
  return run;
};

/**
 * Pause a run
 */
export const pauseRun = async (runId: number) => {
  const run = await markRunControlStatus(runId, 'paused');
  if (!run) {
    throw new Error(`WiGLE import run ${runId} not found or not pausable`);
  }
  logger.info('[WiGLE Import] Run paused', { runId });
  return getImportRun(runId);
};

/**
 * Cancel a run
 */
export const cancelRun = async (runId: number) => {
  const run = await markRunControlStatus(runId, 'cancelled');
  if (!run) {
    throw new Error(`WiGLE import run ${runId} not found or not cancellable`);
  }
  logger.info('[WiGLE Import] Run cancelled', { runId });
  return getImportRun(runId);
};

/**
 * Find latest resumable run for query
 */
export const findLatestResumable = async (rawQuery: Record<string, unknown>) => {
  const validationError = validateImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
  }
  return findLatestResumableRun(rawQuery, RESUMABLE_STATUSES);
};
