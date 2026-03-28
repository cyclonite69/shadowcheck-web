const logger = require('../logging/logger');
const { pool } = require('../config/database');
const secretsManager = require('./secretsManager').default;
const wigleService = require('./wigleService');
import {
  buildSearchParams,
  DEFAULT_RESULTS_PER_PAGE,
  normalizeImportParams,
  type WigleImportParams,
  validateImportQuery,
} from './wigleImport/params';
import {
  completeRun,
  createImportRun,
  findLatestResumableRun,
  getImportRun,
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

const processSuccessfulPage = async (
  runId: number,
  pageNumber: number,
  requestCursor: string | null,
  nextCursor: string | null,
  results: any[],
  apiTotalResults: number | null,
  pageSize: number
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let rowsInserted = 0;
    for (const network of results) {
      rowsInserted += await wigleService.importWigleV2SearchResult(network, client);
    }

    const totalPages =
      apiTotalResults !== null && apiTotalResults >= 0
        ? Math.max(1, Math.ceil(apiTotalResults / pageSize))
        : null;

    await client.query(
      `INSERT INTO app.wigle_import_run_pages (
          run_id, page_number, request_cursor, next_cursor, rows_returned, rows_inserted, success, error_message, fetched_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NULL, NOW(), NOW())
        ON CONFLICT (run_id, page_number) DO UPDATE
          SET request_cursor = EXCLUDED.request_cursor,
              next_cursor = EXCLUDED.next_cursor,
              rows_returned = EXCLUDED.rows_returned,
              rows_inserted = EXCLUDED.rows_inserted,
              success = TRUE,
              error_message = NULL,
              fetched_at = NOW(),
              updated_at = NOW()`,
      [runId, pageNumber, requestCursor, nextCursor, results.length, rowsInserted]
    );

    const runResult = await client.query(
      `UPDATE app.wigle_import_runs
          SET api_total_results = COALESCE($2, api_total_results),
              page_size = $3,
              total_pages = COALESCE($4, total_pages),
              last_successful_page = GREATEST(last_successful_page, $5),
              next_page = GREATEST(next_page, $5 + 1),
              pages_fetched = (
                SELECT COUNT(*)
                FROM app.wigle_import_run_pages
                WHERE run_id = $1 AND success = TRUE
              ),
              rows_returned = (
                SELECT COALESCE(SUM(rows_returned), 0)
                FROM app.wigle_import_run_pages
                WHERE run_id = $1 AND success = TRUE
              ),
              rows_inserted = (
                SELECT COALESCE(SUM(rows_inserted), 0)
                FROM app.wigle_import_run_pages
                WHERE run_id = $1 AND success = TRUE
              ),
              api_cursor = $6,
              last_attempted_at = NOW(),
              last_error = NULL,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [runId, apiTotalResults, pageSize, totalPages, pageNumber, nextCursor]
    );

    await client.query('COMMIT');
    logger.info('[WiGLE Import] Page committed', {
      runId,
      pageNumber,
      rowsReturned: results.length,
      rowsInserted,
      nextCursor,
    });
    return runResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
      run = await markRunFailure(runId, errorMessage);
      return run;
    }
  }
};

const startImportRun = async (rawQuery: Record<string, unknown>) => {
  const validationError = validateImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
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
    throw new Error('No resumable WiGLE import run found for that query');
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

module.exports = {
  cancelImportRun,
  getImportRun,
  getLatestResumableImportRun: getLatestResumableImportRunForQuery,
  listImportRuns,
  pauseImportRun,
  resumeImportRun,
  resumeLatestImportRun,
  startImportRun,
  validateImportQuery,
};
