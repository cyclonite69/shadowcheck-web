const crypto = require('crypto');
const logger = require('../logging/logger');
const { pool, query } = require('../config/database');
const secretsManager = require('./secretsManager').default;
const wigleService = require('./wigleService');

export {};

type WigleImportRunStatus = 'running' | 'paused' | 'failed' | 'completed' | 'cancelled';

type WigleImportParams = {
  ssid?: string;
  bssid?: string;
  latrange1?: string;
  latrange2?: string;
  longrange1?: string;
  longrange2?: string;
  country?: string;
  region?: string;
  city?: string;
  resultsPerPage?: number;
  version?: 'v2';
};

type WiglePageResponse = {
  success?: boolean;
  totalResults?: number;
  search_after?: string | null;
  results?: any[];
};

const DEFAULT_RESULTS_PER_PAGE = 100;
const MAX_RESULTS_PER_PAGE = 1000;
const IMPORT_ALL_PAGE_DELAY_MS = 1500;
const IMPORT_ALL_MAX_RETRIES = 4;
const RESUMABLE_STATUSES: WigleImportRunStatus[] = ['running', 'paused', 'failed'];

const allowedParams = [
  'ssid',
  'bssid',
  'latrange1',
  'latrange2',
  'longrange1',
  'longrange2',
  'country',
  'region',
  'city',
  'resultsPerPage',
  'version',
] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const normalizeImportParams = (raw: Record<string, unknown>): WigleImportParams => {
  const normalized: WigleImportParams = {};
  for (const key of allowedParams) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') continue;
    if (key === 'resultsPerPage') {
      normalized.resultsPerPage = Math.min(
        Math.max(parseInt(String(value), 10) || DEFAULT_RESULTS_PER_PAGE, 1),
        MAX_RESULTS_PER_PAGE
      );
      continue;
    }
    if (key === 'version') {
      normalized.version = 'v2';
      continue;
    }
    normalized[key] = String(value);
  }
  if (!normalized.country) normalized.country = 'US';
  if (!normalized.resultsPerPage) normalized.resultsPerPage = DEFAULT_RESULTS_PER_PAGE;
  if (!normalized.version) normalized.version = 'v2';
  return normalized;
};

const validateImportQuery = (queryInput: Record<string, unknown>): string | null => {
  const query = normalizeImportParams(queryInput);
  if (query.version && query.version !== 'v2') {
    return 'Resumable WiGLE imports currently support only the v2 search API.';
  }
  if (
    !query.ssid &&
    !query.bssid &&
    !query.latrange1 &&
    !query.country &&
    !query.region &&
    !query.city
  ) {
    return 'At least one search parameter required (ssid, bssid, latrange, country, region, or city)';
  }
  return null;
};

const buildSearchParams = (
  query: WigleImportParams,
  searchAfter?: string | null
): URLSearchParams => {
  const params = new URLSearchParams();
  if (query.ssid) params.append('ssidlike', query.ssid);
  if (query.bssid) params.append('netid', query.bssid);
  if (query.latrange1) params.append('latrange1', query.latrange1);
  if (query.latrange2) params.append('latrange2', query.latrange2);
  if (query.longrange1) params.append('longrange1', query.longrange1);
  if (query.longrange2) params.append('longrange2', query.longrange2);
  if (query.country) params.append('country', query.country);
  if (query.region) params.append('region', query.region);
  if (query.city) params.append('city', query.city);
  params.append('resultsPerPage', String(query.resultsPerPage || DEFAULT_RESULTS_PER_PAGE));
  if (searchAfter) params.append('searchAfter', searchAfter);
  return params;
};

const getSearchTerm = (query: WigleImportParams): string =>
  query.ssid || query.bssid || query.city || query.country || '';

const getRequestFingerprint = (query: WigleImportParams): string =>
  crypto.createHash('sha256').update(stableStringify(query)).digest('hex');

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

const computeProgress = (row: any) => {
  const apiTotalResults = row.api_total_results === null ? null : Number(row.api_total_results);
  const totalPages = row.total_pages === null ? null : Number(row.total_pages);
  const rowsReturned = Number(row.rows_returned || 0);
  const rowsInserted = Number(row.rows_inserted || 0);
  const pagesFetched = Number(row.pages_fetched || 0);
  const rowCompletenessPct =
    apiTotalResults && apiTotalResults > 0
      ? Number(((rowsReturned / apiTotalResults) * 100).toFixed(2))
      : null;
  const insertedRowCompletenessPct =
    apiTotalResults && apiTotalResults > 0
      ? Number(((rowsInserted / apiTotalResults) * 100).toFixed(2))
      : null;
  const pageCompletenessPct =
    totalPages && totalPages > 0 ? Number(((pagesFetched / totalPages) * 100).toFixed(2)) : null;

  return {
    apiTotalResults,
    totalPages,
    pageSize: Number(row.page_size || DEFAULT_RESULTS_PER_PAGE),
    pagesFetched,
    rowsReturned,
    rowsInserted,
    rowCompletenessPct,
    insertedRowCompletenessPct,
    pageCompletenessPct,
    rowCompletenessNote:
      'rowsReturned tracks API rows successfully paged; rowsInserted can be lower because duplicate-safe upserts skip already imported rows.',
  };
};

const serializeRun = (row: any, pages: any[] = []) => ({
  id: Number(row.id),
  source: row.source,
  apiVersion: row.api_version,
  searchTerm: row.search_term,
  state: row.state,
  requestFingerprint: row.request_fingerprint,
  requestParams: row.request_params || {},
  status: row.status,
  apiCursor: row.api_cursor,
  lastError: row.last_error,
  startedAt: row.started_at,
  lastAttemptedAt: row.last_attempted_at,
  completedAt: row.completed_at,
  lastSuccessfulPage: Number(row.last_successful_page || 0),
  nextPage: Number(row.next_page || 1),
  ...computeProgress(row),
  pages: pages.map((page) => ({
    id: Number(page.id),
    pageNumber: Number(page.page_number),
    requestCursor: page.request_cursor,
    nextCursor: page.next_cursor,
    fetchedAt: page.fetched_at,
    rowsReturned: Number(page.rows_returned || 0),
    rowsInserted: Number(page.rows_inserted || 0),
    success: Boolean(page.success),
    errorMessage: page.error_message || null,
  })),
});

const getRunRow = async (runId: number) => {
  const result = await query('SELECT * FROM app.wigle_import_runs WHERE id = $1', [runId]);
  return result.rows[0] || null;
};

const getRunPages = async (runId: number, limit = 50) => {
  const result = await query(
    `SELECT *
       FROM app.wigle_import_run_pages
      WHERE run_id = $1
      ORDER BY page_number DESC
      LIMIT $2`,
    [runId, limit]
  );
  return result.rows;
};

const reconcileRunProgress = async (runId: number): Promise<any> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pageSummary = await client.query(
      `SELECT
          COUNT(*) FILTER (WHERE success) AS pages_fetched,
          COALESCE(SUM(rows_returned) FILTER (WHERE success), 0) AS rows_returned,
          COALESCE(SUM(rows_inserted) FILTER (WHERE success), 0) AS rows_inserted,
          COALESCE(MAX(page_number) FILTER (WHERE success), 0) AS last_successful_page
       FROM app.wigle_import_run_pages
       WHERE run_id = $1`,
      [runId]
    );
    const summary = pageSummary.rows[0];
    const lastSuccessfulPage = Number(summary?.last_successful_page || 0);
    const latestCursorResult = await client.query(
      `SELECT next_cursor
         FROM app.wigle_import_run_pages
        WHERE run_id = $1
          AND success = TRUE
          AND page_number = $2
        LIMIT 1`,
      [runId, lastSuccessfulPage]
    );
    const latestCursor = latestCursorResult.rows[0]?.next_cursor || null;
    const runResult = await client.query(
      `UPDATE app.wigle_import_runs
          SET pages_fetched = $2,
              rows_returned = $3,
              rows_inserted = $4,
              last_successful_page = $5,
              next_page = CASE WHEN status = 'completed' THEN GREATEST(next_page, $5 + 1) ELSE GREATEST($5 + 1, next_page) END,
              api_cursor = CASE WHEN $5 > 0 THEN $6 ELSE api_cursor END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        runId,
        Number(summary?.pages_fetched || 0),
        Number(summary?.rows_returned || 0),
        Number(summary?.rows_inserted || 0),
        lastSuccessfulPage,
        latestCursor,
      ]
    );
    await client.query('COMMIT');
    return runResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const createImportRun = async (rawQuery: Record<string, unknown>) => {
  const normalized = normalizeImportParams(rawQuery);
  const result = await query(
    `INSERT INTO app.wigle_import_runs (
        source,
        api_version,
        search_term,
        state,
        request_fingerprint,
        request_params,
        status,
        page_size
      ) VALUES ('wigle', $1, $2, $3, $4, $5::jsonb, 'running', $6)
      RETURNING *`,
    [
      normalized.version || 'v2',
      getSearchTerm(normalized),
      normalized.region || null,
      getRequestFingerprint(normalized),
      JSON.stringify(normalized),
      normalized.resultsPerPage || DEFAULT_RESULTS_PER_PAGE,
    ]
  );
  logger.info('[WiGLE Import] Created run', {
    runId: result.rows[0]?.id,
    state: normalized.region || null,
    searchTerm: getSearchTerm(normalized),
  });
  return result.rows[0];
};

const findLatestResumableRun = async (rawQuery: Record<string, unknown>) => {
  const normalized = normalizeImportParams(rawQuery);
  const result = await query(
    `SELECT *
       FROM app.wigle_import_runs
      WHERE request_fingerprint = $1
        AND status = ANY($2::text[])
      ORDER BY started_at DESC
      LIMIT 1`,
    [getRequestFingerprint(normalized), RESUMABLE_STATUSES]
  );
  return result.rows[0] || null;
};

const markRunFailure = async (runId: number, message: string) => {
  const result = await query(
    `UPDATE app.wigle_import_runs
        SET status = 'failed',
            last_error = $2,
            last_attempted_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [runId, message]
  );
  logger.warn('[WiGLE Import] Run failed', { runId, error: message });
  return result.rows[0];
};

const markRunControlStatus = async (runId: number, status: 'paused' | 'cancelled') => {
  const result = await query(
    `UPDATE app.wigle_import_runs
        SET status = $2,
            last_attempted_at = NOW(),
            updated_at = NOW(),
            completed_at = CASE WHEN $2 = 'cancelled' THEN NOW() ELSE completed_at END
      WHERE id = $1
        AND status IN ('running', 'failed', 'paused')
      RETURNING *`,
    [runId, status]
  );
  return result.rows[0] || null;
};

const resumeRunState = async (runId: number) => {
  const result = await query(
    `UPDATE app.wigle_import_runs
        SET status = 'running',
            last_error = NULL,
            updated_at = NOW()
      WHERE id = $1
        AND status IN ('running', 'paused', 'failed')
      RETURNING *`,
    [runId]
  );
  return result.rows[0] || null;
};

const completeRun = async (runId: number) => {
  const result = await query(
    `UPDATE app.wigle_import_runs
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW(),
            last_error = NULL
      WHERE id = $1
      RETURNING *`,
    [runId]
  );
  logger.info('[WiGLE Import] Run completed', { runId });
  return result.rows[0];
};

const persistPageFailure = async (
  runId: number,
  pageNumber: number,
  requestCursor: string | null,
  errorMessage: string
) => {
  await query(
    `INSERT INTO app.wigle_import_run_pages (
        run_id, page_number, request_cursor, success, error_message, fetched_at, updated_at
      ) VALUES ($1, $2, $3, FALSE, $4, NOW(), NOW())
      ON CONFLICT (run_id, page_number) DO UPDATE
        SET request_cursor = EXCLUDED.request_cursor,
            success = FALSE,
            error_message = EXCLUDED.error_message,
            fetched_at = NOW(),
            updated_at = NOW()`,
    [runId, pageNumber, requestCursor, errorMessage]
  );
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

const getRunOrThrow = async (runId: number) => {
  const run = await getRunRow(runId);
  if (!run) {
    throw new Error(`WiGLE import run ${runId} not found`);
  }
  return run;
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
  const latest = await findLatestResumableRun(rawQuery);
  if (!latest) {
    throw new Error('No resumable WiGLE import run found for that query');
  }
  return resumeImportRun(Number(latest.id));
};

const listImportRuns = async (
  options: {
    limit?: number;
    status?: string;
    state?: string;
    searchTerm?: string;
    incompleteOnly?: boolean;
  } = {}
) => {
  const { limit = 20, status, state, searchTerm, incompleteOnly = false } = options;
  const params: any[] = [];
  const where: string[] = [];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (state) {
    params.push(state);
    where.push(`state = $${params.length}`);
  }
  if (searchTerm) {
    params.push(`%${searchTerm}%`);
    where.push(`search_term ILIKE $${params.length}`);
  }
  if (incompleteOnly) {
    where.push(`status IN ('running', 'paused', 'failed')`);
  }

  params.push(limit);
  const result = await query(
    `SELECT *
       FROM app.wigle_import_runs
       ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY started_at DESC
      LIMIT $${params.length}`,
    params
  );
  return result.rows.map((row: any) => serializeRun(row));
};

const getImportRun = async (runId: number) => {
  const run = await getRunOrThrow(runId);
  const pages = await getRunPages(runId);
  return serializeRun(run, pages);
};

const getLatestResumableImportRun = async (rawQuery: Record<string, unknown>) => {
  const validationError = validateImportQuery(rawQuery);
  if (validationError) {
    throw new Error(validationError);
  }
  const run = await findLatestResumableRun(rawQuery);
  if (!run) return null;
  return getImportRun(Number(run.id));
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
  getLatestResumableImportRun,
  listImportRuns,
  pauseImportRun,
  resumeImportRun,
  resumeLatestImportRun,
  startImportRun,
  validateImportQuery,
};
