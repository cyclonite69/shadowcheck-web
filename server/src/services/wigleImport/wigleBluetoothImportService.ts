import logger from '../../logging/logger';
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
  resumeRunState,
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

      if (results.length === 0 && nextCursor === null) {
        const note =
          pageNumber === 1
            ? 'No records returned on first page — API quota may be exhausted or no results match'
            : undefined;
        run = await completeRun(runId, note);
        return run;
      }

      const pageSize = requestParams.resultsPerPage || DEFAULT_BT_RESULTS_PER_PAGE;
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
 * Start a new BT/BLE import run, or resume the latest matching run if one exists.
 */
export const startBluetoothImportRun = async (rawQuery: Record<string, unknown>) => {
  const validationError = validateBtImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
  }

  const normalized = normalizeBtImportParams(rawQuery);
  const fingerprint = getBtRequestFingerprint(normalized);

  const existing = await findRunByRawFingerprint(fingerprint, RESUMABLE_STATUSES);
  if (existing) {
    logger.info('[WiGLE BT Import] Resuming existing run', {
      runId: existing.id,
      status: existing.status,
    });
    await resumeRunState(Number(existing.id));
    const finalRun = await executeBluetoothImportLoop(Number(existing.id));
    return getImportRun(Number(finalRun.id));
  }

  // Pass normalized params as rawQuery so the fingerprint and stored request_params
  // are both derived from the normalized shape (consistent for future resume lookups).
  const run = await createImportRun(normalized as Record<string, unknown>, {
    source: 'wigle_bt',
    api_version: 'v2',
    search_term: getBtSearchTerm(normalized),
  });

  logger.info('[WiGLE BT Import] Created run', {
    runId: run?.id,
    searchTerm: run?.search_term,
  });

  const finalRun = await executeBluetoothImportLoop(Number(run.id));
  return getImportRun(Number(finalRun.id));
};

/**
 * Resume a specific BT import run by ID.
 */
export const resumeBluetoothImportRun = async (runId: number) => {
  const run = await getRunOrThrow(runId);
  if (run.status === 'completed') {
    return getImportRun(runId);
  }
  if (run.status === 'cancelled') {
    throw new Error('Cannot resume a cancelled import run');
  }
  await resumeRunState(runId);
  const finalRun = await executeBluetoothImportLoop(runId);
  return getImportRun(Number(finalRun.id));
};

export { validateBtImportQuery };
