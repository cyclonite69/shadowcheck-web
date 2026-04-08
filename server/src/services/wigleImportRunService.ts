import logger from '../logging/logger';
import secretsManager from './secretsManager';
import {
  buildSearchParams,
  DEFAULT_RESULTS_PER_PAGE,
  normalizeImportParams,
  type WigleImportParams,
  validateImportQuery,
} from './wigleImport/params';
import { processSuccessfulPage } from './wigleImport/pageProcessor';
import {
  completeRun,
  createImportRun,
  findLatestResumableRun,
  getImportRun,
  getImportCompletenessSummary,
  getLatestResumableImportRun,
  getRunOrThrow,
  listImportRuns,
  markRunControlStatus,
  markRunFailure,
  persistPageFailure,
  reconcileRunProgress,
  resumeRunState,
} from './wigleImport/runRepository';

export {};

type WigleImportRunStatus = 'running' | 'paused' | 'failed' | 'completed' | 'cancelled';

type WiglePageResponse = {
  success?: boolean;
  totalResults?: number;
  search_after?: string | null;
  results?: any[];
};

const IMPORT_ALL_PAGE_DELAY_MS = 1500;
const IMPORT_ALL_MAX_RETRIES = 4;
const RESUMABLE_STATUSES: WigleImportRunStatus[] = ['running', 'paused', 'failed'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getEncodedAuth = (): string => {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');
  if (!wigleApiName || !wigleApiToken) {
    throw new Error(
      'WiGLE API credentials not configured. Set wigle_api_name and wigle_api_token secrets.'
    );
  }
  return Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
};

const fetchWiglePage = async (
  encodedAuth: string,
  requestParams: WigleImportParams,
  searchAfter: string | null
): Promise<WiglePageResponse> => {
  const params = buildSearchParams(requestParams, searchAfter);
  const apiUrl = `https://api.wigle.net/api/v2/network/search?${params.toString()}`;

  logger.info(`[WiGLE Import] Fetch page request ${apiUrl.replace(/netid=[^&]+/, 'netid=***')}`, {
    searchAfter: searchAfter || null,
  });

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${encodedAuth}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error: any = new Error(`WiGLE API request failed with status ${response.status}`);
    error.status = response.status;
    error.details = errorText;
    throw error;
  }

  const data = await response.json();
  if (!data || typeof data !== 'object') {
    throw new Error('WiGLE API returned a malformed response');
  }
  return data;
};

const executeImportLoop = async (runId: number) => {
  const encodedAuth = getEncodedAuth();
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
      for (let attempt = 0; ; attempt++) {
        try {
          data = await fetchWiglePage(encodedAuth, requestParams, requestCursor);
          break;
        } catch (error: any) {
          const retriable =
            error.status === 429 ||
            (typeof error.status === 'number' && error.status >= 500 && error.status < 600);
          if (!retriable || attempt >= IMPORT_ALL_MAX_RETRIES) {
            throw error;
          }
          const backoffMs = IMPORT_ALL_PAGE_DELAY_MS * Math.pow(2, attempt + 1);
          logger.warn('[WiGLE Import] Page retry scheduled', {
            runId,
            pageNumber,
            attempt: attempt + 1,
            status: error.status,
            backoffMs,
          });
          await sleep(backoffMs);
        }
      }

      const results = Array.isArray(data?.results) ? data.results : [];
      const totalResults =
        data?.totalResults !== undefined && data?.totalResults !== null
          ? Number(data.totalResults)
          : run.api_total_results !== null
            ? Number(run.api_total_results)
            : null;
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
        run = await completeRun(runId);
        return run;
      }

      run = await processSuccessfulPage(
        runId,
        pageNumber,
        requestCursor,
        nextCursor,
        results,
        totalResults,
        requestParams.resultsPerPage || DEFAULT_RESULTS_PER_PAGE
      );

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

      if (isComplete) {
        run = await completeRun(runId);
        return run;
      }

      await sleep(IMPORT_ALL_PAGE_DELAY_MS);
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

const startImportRun = async (rawQuery: Record<string, unknown>) => {
  const validationError = validateImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
  }
  const existing = await findLatestResumableRun(rawQuery, RESUMABLE_STATUSES);
  if (existing) {
    logger.info('[WiGLE Import] Resuming existing run instead of creating duplicate', {
      runId: existing.id,
      status: existing.status,
      nextPage: existing.next_page,
    });
    return resumeImportRun(Number(existing.id));
  }
  const run = await createImportRun(rawQuery);
  logger.info('[WiGLE Import] Created run', {
    runId: run?.id,
    state: run?.state,
    searchTerm: run?.search_term,
  });
  const finalRun = await executeImportLoop(Number(run.id));
  return getImportRun(Number(finalRun.id));
};

const resumeImportRun = async (runId: number) => {
  const run = await getRunOrThrow(runId);
  if (run.status === 'completed') {
    return getImportRun(runId);
  }
  if (run.status === 'cancelled') {
    throw new Error('Cannot resume a cancelled WiGLE import run');
  }
  await reconcileRunProgress(runId);
  await resumeRunState(runId);
  const finalRun = await executeImportLoop(runId);
  return getImportRun(Number(finalRun.id));
};

const resumeLatestImportRun = async (rawQuery: Record<string, unknown>) => {
  const validationError = validateImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
  }
  const latest = await findLatestResumableRun(rawQuery, RESUMABLE_STATUSES);
  if (!latest) {
    return startImportRun(rawQuery);
  }
  return resumeImportRun(Number(latest.id));
};

const getLatestResumableImportRunForQuery = async (rawQuery: Record<string, unknown>) => {
  const validationError = validateImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
  }
  return getLatestResumableImportRun(rawQuery, RESUMABLE_STATUSES);
};

const pauseImportRun = async (runId: number) => {
  const run = await markRunControlStatus(runId, 'paused');
  if (!run) {
    throw new Error(`WiGLE import run ${runId} not found or not pausable`);
  }
  logger.info('[WiGLE Import] Run paused', { runId });
  return getImportRun(runId);
};

const cancelImportRun = async (runId: number) => {
  const run = await markRunControlStatus(runId, 'cancelled');
  if (!run) {
    throw new Error(`WiGLE import run ${runId} not found or not cancellable`);
  }
  logger.info('[WiGLE Import] Run cancelled', { runId });
  return getImportRun(runId);
};

const getImportCompletenessReport = async (options: { searchTerm?: string; state?: string }) => {
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

export {
  cancelImportRun,
  getImportRun,
  getImportCompletenessReport,
  getLatestResumableImportRunForQuery as getLatestResumableImportRun,
  listImportRuns,
  pauseImportRun,
  resumeImportRun,
  resumeLatestImportRun,
  startImportRun,
  validateImportQuery,
};
