/**
 * WiGLE v3 Enrichment Service
 * Slim orchestrator — delegates data access to wigleEnrichmentRepository
 * and per-item fetching to wigleEnrichmentFetcher.
 */

import * as container from '../config/container';
import logger from '../logging/logger';
import { assertBulkWigleAllowed } from './wigleBulkPolicy';
import { fetchWigle } from './wigleClient';
import { hashRecord } from './wigleRequestUtils';
import { fetchAndImportDetail } from './wigleEnrichmentFetcher';
import {
  getPendingEnrichmentCount,
  getEnrichmentCatalog,
  getNextEnrichmentBatch,
  getActiveEnrichmentRunId,
  setRunTotalItems,
  incrementRunProgress,
  getRunStatus,
  resetRunForResume,
  refreshWigleNetworksMv,
} from '../repositories/wigleEnrichmentRepository';
import {
  createImportRun,
  getImportRun,
  markRunControlStatus,
  markRunFailure,
  completeRun,
} from './wigleImport/runRepository';

export { getPendingEnrichmentCount, getEnrichmentCatalog };

const { secretsManager } = container as any;

const ENRICHMENT_DELAY_MS = 20_000;

export async function runEnrichmentLoop(runId: number, manualList?: string[]) {
  const run = await getImportRun(runId);
  if (run.status === 'completed' || run.status === 'cancelled') return run;

  /**
   * In-memory guard against tight re-fetch loops within a single run.
   * Not persisted: on resume the Set is empty so any previously-failed BSSID
   * is eligible for retry. This is intentional.
   */
  const processed = new Set<string>();

  logger.info(
    `[v3 Enrichment] Starting batch loop for run #${runId}${manualList ? ` (Manual: ${manualList.length} items)` : ''}`
  );

  try {
    for (;;) {
      const currentStatus = await getRunStatus(runId);
      if (currentStatus === 'paused' || currentStatus === 'cancelled') {
        logger.info(`[v3 Enrichment] Loop stopped: ${currentStatus}`);
        return;
      }

      const activeManualList = manualList ? manualList.filter((b) => !processed.has(b)) : undefined;
      const batch = await getNextEnrichmentBatch(5, activeManualList);

      if (batch.length === 0) {
        await completeRun(runId);
        logger.info(`[v3 Enrichment] Completed run #${runId}`);
        try {
          await refreshWigleNetworksMv();
          logger.info('[v3 Enrichment] Refreshed api_wigle_networks_mv');
        } catch (mvErr: any) {
          logger.warn('[v3 Enrichment] MV refresh skipped (not yet applied?):', mvErr.message);
        }
        return;
      }

      for (const item of batch) {
        try {
          await fetchAndImportDetail(item.bssid, item.type);
          processed.add(item.bssid);
          await incrementRunProgress(runId);

          if (process.env.NODE_ENV !== 'test') {
            await new Promise((resolve) => setTimeout(resolve, ENRICHMENT_DELAY_MS));
          }
        } catch (err: any) {
          if (
            err.status === 429 ||
            err.status === 403 ||
            err.message?.includes('429') ||
            err.message?.includes('403')
          ) {
            await markRunControlStatus(runId, 'paused');
            logger.warn(`[v3 Enrichment] WiGLE blocked/throttled. Pausing run #${runId}`);
            return;
          }
          logger.error(`[v3 Enrichment] Failed item ${item.bssid}: ${err.message}`);
          processed.add(item.bssid);
        }
      }
    }
  } catch (err: any) {
    await markRunFailure(runId, err.message);
    logger.error(`[v3 Enrichment] Fatal loop error: ${err.message}`);
  }
}

export async function startBatchEnrichment(bssids?: string[]) {
  const isManual = Array.isArray(bssids) && bssids.length > 0;
  if (!isManual) assertBulkWigleAllowed('Start Batch Enrichment (Full Backlog)');

  const pending = isManual ? bssids!.length : await getPendingEnrichmentCount();
  if (pending === 0) {
    throw new Error(
      isManual ? 'No valid BSSIDs provided for enrichment' : 'No networks found in v2 catalog'
    );
  }

  const conflictId = await getActiveEnrichmentRunId();
  if (conflictId !== null) {
    logger.warn(`[v3 Enrichment] Concurrency guard: run #${conflictId} already active.`, {
      conflictId,
    });
    throw Object.assign(
      new Error(
        `An enrichment run (#${conflictId}) is already active. Pause or wait for it to complete.`
      ),
      { status: 409 }
    );
  }

  const run = await createImportRun({
    version: 'v3',
    source: isManual ? 'v3_manual' : 'v3_batch',
    searchTerm: isManual
      ? `Targeted Enrichment (${pending} items)`
      : `Full Catalog Enrichment (${pending} items)`,
    resultsPerPage: 1,
  });

  await setRunTotalItems(run.id, pending);
  void runEnrichmentLoop(run.id, bssids);
  return run;
}

export async function resumeEnrichment(runId: number) {
  const conflictId = await getActiveEnrichmentRunId(runId);
  if (conflictId !== null) {
    logger.warn(
      `[v3 Enrichment] Concurrency guard: run #${conflictId} active, skipping resume of #${runId}.`,
      { conflictId, runId }
    );
    throw Object.assign(
      new Error(
        `Enrichment run #${conflictId} is already active. Pause it before resuming run #${runId}.`
      ),
      { status: 409 }
    );
  }

  const row = await resetRunForResume(runId);
  if (!row) throw new Error('Run not found');

  void runEnrichmentLoop(runId);
  return row;
}

/**
 * Validates that the WiGLE API key has remaining credit.
 */
export async function validateWigleApiCredit() {
  try {
    const wigleApiName = secretsManager.get('wigle_api_name');
    const wigleApiToken = secretsManager.get('wigle_api_token');

    if (!wigleApiName || !wigleApiToken) {
      return { hasCredit: false, message: 'WiGLE API credentials not configured' };
    }

    const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
    const response = await fetchWigle({
      kind: 'stats',
      url: 'https://api.wigle.net/api/v2/stats',
      timeoutMs: 15000,
      maxRetries: 0,
      label: 'WiGLE API Credit Check',
      entrypoint: 'stats',
      paramsHash: hashRecord({ endpoint: 'v2/stats' }),
      endpointType: 'v2/stats',
      init: { headers: { Authorization: `Basic ${encodedAuth}` } },
    });

    if (response.status === 401) return { hasCredit: false, message: 'Invalid WiGLE API key' };

    const data = (await response.json()) as any;
    const remaining = data?.estimatedApiQuotaRemaining || 0;

    if (remaining === 0)
      return { hasCredit: false, message: 'No API credit remaining (0 requests)' };
    if (remaining < 10) logger.warn(`[WiGLE] Low API credit: ${remaining} requests remaining`);

    return { hasCredit: true, message: `${remaining} requests available` };
  } catch (err) {
    logger.error('[WiGLE] Error checking API credit:', err);
    return { hasCredit: true, message: 'Credit check unavailable (proceeding with request)' };
  }
}
