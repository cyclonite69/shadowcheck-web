import logger from '../../../logging/logger';
import { resetRunForResume } from '../../../repositories/wigleEnrichmentRepository';
import {
  getActiveEnrichmentRunId,
  getEnrichmentRun,
} from '../repositories/enrichmentReadRepository';
import { runEnrichmentLoop } from './runEnrichmentLoop';

function createError(message: string, status: number, code?: string) {
  const err: any = new Error(message);
  err.status = status;
  if (code) {
    err.code = code;
  }
  return err;
}

/**
 * Resume a paused or failed WiGLE full-backlog (v3_batch) enrichment run.
 * Targeted runs (v3_manual) cannot be resumed without a persisted target list.
 */
export async function resumeEnrichment(runId: number) {
  const conflictId = await getActiveEnrichmentRunId(runId);
  if (conflictId !== null) {
    logger.warn(
      `[v3 Enrichment] Concurrency guard: run #${conflictId} active, skipping resume of #${runId}.`,
      { conflictId, runId }
    );
    throw createError(
      `Enrichment run #${conflictId} is already active. Pause it before resuming run #${runId}.`,
      409,
      'ENRICHMENT_CONFLICT'
    );
  }

  const existingRun = await getEnrichmentRun(runId);
  if (!existingRun) {
    throw createError(`Run #${runId} not found`, 404);
  }

  // Cross-source guard: must be an enrichment run source
  if (existingRun.source !== 'v3_batch' && existingRun.source !== 'v3_manual') {
    throw createError(
      `Cannot resume non-enrichment import run #${runId} (source: ${existingRun.source}) via enrichment service`,
      400
    );
  }

  // Status guards
  if (existingRun.status === 'completed') {
    throw createError('Cannot resume an enrichment run that is already completed', 400);
  }
  if (existingRun.status === 'running') {
    throw createError('Cannot resume an enrichment run that is already running', 400);
  }
  if (existingRun.status === 'cancelled') {
    throw createError('Cannot resume a cancelled enrichment run', 400);
  }
  if (existingRun.status !== 'paused' && existingRun.status !== 'failed') {
    throw createError(`Cannot resume an enrichment run with status '${existingRun.status}'`, 400);
  }

  // Targeted run guard: requires a persisted target list
  if (existingRun.source === 'v3_manual') {
    const rawParams = existingRun.request_params;
    const bssids = Array.isArray(rawParams?.bssids) ? rawParams.bssids : undefined;
    if (!bssids || bssids.length === 0) {
      throw createError(
        `Cannot resume targeted enrichment run #${runId} without a persisted target list. Please start a new run.`,
        400
      );
    }
  }

  const row = await resetRunForResume(runId);
  if (!row) {
    throw createError(
      `Failed to resume enrichment run #${runId}: run is not in a resumable state`,
      400
    );
  }

  void runEnrichmentLoop(runId);
  return row;
}
