import logger from '../logging/logger';
import {
  completeRun,
  getImportCompletenessSummary,
  getImportRun,
  getRunOrThrow,
  listImportRuns,
  markRunControlStatus,
  markRunFailure,
  persistPageFailure,
  reconcileRunProgress,
  bulkDeleteCancelledRunsByIds,
  findGlobalCancelledClusterIds,
} from './wigleImport/runRepository';
import { DEFAULT_RESULTS_PER_PAGE } from './wigleImport/params';
import { processSuccessfulPage } from './wigleImport/pageProcessor';
import { getEncodedWigleAuth } from './wigleImport/authProvider';
import { getAdaptiveDelay, sleep } from './wigleImport/rateLimitingStrategy';
import { fetchWiglePage, type WiglePageResponse } from './wigleImport/wigleApiClient';
import {
  initializeImportRun,
  prepareRunForResumption,
  pauseRun,
  cancelRun,
  findLatestResumable,
  type WigleImportRunStatus,
} from './wigleImport/runStateManager';
import { normalizeImportParams, type WigleImportParams } from './wigleImport/params';
import { validateImportQuery } from './wigleImport/params';

/**
 * Execute the main import loop for a WiGLE run
 * Fetches pages iteratively, processes results, handles errors and quota limits
 */
const executeImportLoop = async (runId: number) => {
  const encodedAuth = getEncodedWigleAuth();
  let run = await reconcileRunProgress(runId);

  if (run.status === 'completed' || run.status === 'cancelled') {
    return run;
  }

  const requestParams = normalizeImportParams(run.request_params || {});

  for (;;) {
    run = await getRunOrThrow(runId);

    if (run.status === 'paused' || run.status === 'cancelled') {
      logger.info('[WiGLE Import] Run stopped by operator', { runId, status: run.status });
      return run;
    }

    const pageNumber = Number(run.next_page || 1);
    const requestCursor = run.api_cursor || null;

    logger.info('[WiGLE Import] Fetching page', {
      runId,
      pageNumber,
      requestCursor,
      state: run.state,
      searchTerm: run.search_term,
    });

    let data: WiglePageResponse | null = null;
    try {
      data = await fetchWiglePage(encodedAuth, requestParams, requestCursor);

      const results = Array.isArray(data?.results) ? data.results : [];
      // liveTotal is null when the API response omits totalResults — used for DB writes only.
      // totalResults falls back to the DB value so loop termination logic always has a total.
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

      if (totalResults !== null && Number.isFinite(totalResults) && totalResults >= 0) {
        const expectedPages = Math.max(
          1,
          Math.ceil(totalResults / (requestParams.resultsPerPage || DEFAULT_RESULTS_PER_PAGE))
        );
        if (pageNumber > expectedPages && results.length > 0) {
          throw new Error(
            `WiGLE pagination metadata mismatch: page ${pageNumber} exceeded expected page count ${expectedPages}`
          );
        }
      }

      if (results.length === 0 && nextCursor) {
        throw new Error(
          `WiGLE pagination metadata inconsistent: empty page ${pageNumber} returned with a next cursor`
        );
      }

      if (results.length === 0 && nextCursor === null) {
        const note =
          pageNumber === 1
            ? 'No records returned on first page — API quota may be exhausted or no results match the search'
            : undefined;
        run = await completeRun(runId, note);
        return run;
      }

      const totalPages =
        totalResults !== null
          ? Math.max(
              1,
              Math.ceil(totalResults / (requestParams.resultsPerPage || DEFAULT_RESULTS_PER_PAGE))
            )
          : null;
      const isComplete =
        nextCursor === null &&
        (totalPages === null ||
          pageNumber >= totalPages ||
          results.length < (requestParams.resultsPerPage || DEFAULT_RESULTS_PER_PAGE));

      run = await processSuccessfulPage(
        runId,
        pageNumber,
        requestCursor,
        nextCursor,
        results,
        liveTotal,
        requestParams.resultsPerPage || DEFAULT_RESULTS_PER_PAGE,
        isComplete
      );

      if (isComplete) {
        return run;
      }

      await sleep(getAdaptiveDelay());
    } catch (error: any) {
      const errorMessage = error?.details || error?.message || 'WiGLE import page failed';
      await persistPageFailure(runId, pageNumber, requestCursor, errorMessage);
      if (error?.status === 429) {
        run = await markRunControlStatus(runId, 'paused');
        logger.warn('[WiGLE Import] Daily quota exhausted — run paused for later resumption', {
          runId,
          pageNumber,
        });
      } else {
        run = await markRunFailure(runId, errorMessage);
      }
      return run;
    }
  }
};

/**
 * Start a new WiGLE import run or resume existing if query matches
 */
export const startImportRun = async (rawQuery: Record<string, unknown>) => {
  const run = await initializeImportRun(rawQuery);
  const finalRun = await executeImportLoop(Number(run.id));
  return getImportRun(Number(finalRun.id));
};

/**
 * Resume an existing WiGLE import run
 */
export const resumeImportRun = async (runId: number) => {
  await prepareRunForResumption(runId);
  const finalRun = await executeImportLoop(runId);
  return getImportRun(Number(finalRun.id));
};

/**
 * Resume the latest resumable run matching a query, or start new if none exists
 */
export const resumeLatestImportRun = async (rawQuery: Record<string, unknown>) => {
  const latest = await findLatestResumable(rawQuery);
  if (!latest) {
    return startImportRun(rawQuery);
  }
  return resumeImportRun(Number(latest.id));
};

/**
 * Find latest resumable run for a query
 */
export const getLatestResumableImportRun = async (rawQuery: Record<string, unknown>) => {
  return findLatestResumable(rawQuery);
};

/**
 * Pause an import run
 */
export const pauseImportRun = async (runId: number) => {
  return pauseRun(runId);
};

/**
 * Cancel an import run
 */
export const cancelImportRun = async (runId: number) => {
  return cancelRun(runId);
};

/**
 * Get completeness report for import runs
 */
export const getImportCompletenessReport = async (options: {
  searchTerm?: string;
  state?: string;
}) => {
  const rows = await getImportCompletenessSummary(options);
  return {
    generatedAt: new Date().toISOString(),
    states: rows.map((row: any) => ({
      state: row.state,
      storedCount: Number(row.stored_count || 0),
      runId: row.run_id === null ? null : Number(row.run_id),
      searchTerm: row.search_term || null,
      requestParams: row.request_params || null,
      requestFingerprint: row.request_fingerprint || null,
      status: row.status || null,
      apiTotalResults: row.api_total_results === null ? null : Number(row.api_total_results),
      totalPages: row.total_pages === null ? null : Number(row.total_pages),
      pageSize: row.page_size === null ? null : Number(row.page_size),
      pagesFetched: row.pages_fetched === null ? null : Number(row.pages_fetched),
      rowsReturned: row.rows_returned === null ? null : Number(row.rows_returned),
      rowsInserted: row.rows_inserted === null ? null : Number(row.rows_inserted),
      lastSuccessfulPage:
        row.last_successful_page === null ? null : Number(row.last_successful_page),
      nextPage: row.next_page === null ? null : Number(row.next_page),
      apiCursor: row.api_cursor || null,
      lastError: row.last_error || null,
      startedAt: row.started_at || null,
      updatedAt: row.updated_at || null,
      completedAt: row.completed_at || null,
      missingApiRows: row.missing_api_rows === null ? null : Number(row.missing_api_rows),
      missingInsertRows: row.missing_insert_rows === null ? null : Number(row.missing_insert_rows),
      resumable: row.status ? ['running', 'paused', 'failed'].includes(row.status) : false,
    })),
  };
};

/**
 * Bulk delete globally cancelled runs (cluster cleanup)
 */
export const bulkDeleteGlobalCancelledCluster = async (): Promise<number> => {
  const ids = await findGlobalCancelledClusterIds();
  if (ids.length === 0) return 0;
  return bulkDeleteCancelledRunsByIds(ids);
};

export { getImportRun, listImportRuns, validateImportQuery };
