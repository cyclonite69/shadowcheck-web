const { pool, query } = require('../../config/database');
const adminDbService = require('../adminDbService');

import {
  buildCreateImportRunInput,
  type CreateImportRunOverrides,
} from './mappers/buildCreateImportRunInput';
import {
  countRecentCancelledByFingerprint,
  findGlobalCancelledClusterIds,
  findLatestResumableRun,
  findRunByRawFingerprint,
  getRunPages,
  getRunRow,
} from './repositories/runReadRepository';
import { serializeRun } from './serialization';

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
              status = CASE
                WHEN status <> 'cancelled'
                  AND $2 > 0
                  AND $6 IS NULL
                  AND (total_pages IS NULL OR $2 >= total_pages)
                THEN 'completed'
                ELSE status
              END,
              completed_at = CASE
                WHEN status <> 'cancelled'
                  AND $2 > 0
                  AND $6 IS NULL
                  AND (total_pages IS NULL OR $2 >= total_pages)
                THEN COALESCE(completed_at, NOW())
                ELSE completed_at
              END,
              last_error = CASE
                WHEN status <> 'cancelled'
                  AND $2 > 0
                  AND $6 IS NULL
                  AND (total_pages IS NULL OR $2 >= total_pages)
                THEN NULL
                ELSE last_error
              END,
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

const createImportRun = async (
  rawQuery: Record<string, unknown>,
  overrides: CreateImportRunOverrides = {}
) => {
  const input = buildCreateImportRunInput(rawQuery, overrides);
  const result = await adminDbService.adminQuery(
    `INSERT INTO app.wigle_import_runs (
        source,
        api_version,
        search_term,
        state,
        request_fingerprint,
        request_params,
        status,
        page_size
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'running', $7)
      RETURNING *`,
    [
      input.source,
      input.apiVersion,
      input.searchTerm,
      input.state,
      input.requestFingerprint,
      JSON.stringify(input.requestParams),
      input.pageSize,
    ]
  );
  return result.rows[0];
};

const markRunFailure = async (runId: number, message: string) => {
  const result = await adminDbService.adminQuery(
    `UPDATE app.wigle_import_runs
        SET status = 'failed',
            last_error = $2,
            last_attempted_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [runId, message]
  );
  return result.rows[0];
};

const markRunControlStatus = async (runId: number, status: 'paused' | 'cancelled') => {
  const result = await adminDbService.adminQuery(
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
  const result = await adminDbService.adminQuery(
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

const completeRun = async (runId: number, note?: string) => {
  const result = await adminDbService.adminQuery(
    `UPDATE app.wigle_import_runs
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW(),
            last_error = $2
      WHERE id = $1
      RETURNING *`,
    [runId, note ?? null]
  );
  return result.rows[0];
};

const persistPageFailure = async (
  runId: number,
  pageNumber: number,
  requestCursor: string | null,
  errorMessage: string
) => {
  await adminDbService.adminQuery(
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

const getRunOrThrow = async (runId: number) => {
  const run = await getRunRow(runId);
  if (!run) {
    throw new Error(`WiGLE import run ${runId} not found`);
  }
  return run;
};

/**
 * List WiGLE import runs with pagination and server-side sort.
 * Returns { data, total, limit, offset } for paginated consumption.
 * Falls back to started_at DESC when sortBy is empty or invalid.
 */
const listImportRuns = async (
  options: {
    limit?: number;
    offset?: number;
    status?: string;
    state?: string;
    searchTerm?: string;
    incompleteOnly?: boolean;
    sortBy?: string;
    sortDir?: string;
  } = {}
) => {
  const {
    limit = 20,
    offset = 0,
    status,
    state,
    searchTerm,
    incompleteOnly = false,
    sortBy,
    sortDir,
  } = options;
  const params: any[] = [];
  const where: string[] = ["source NOT IN ('v3_manual', 'v3_batch', 'v3_auto')"];

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
    where.push("status IN ('running', 'paused', 'failed')");
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Dynamic ORDER BY with allowlist
  const SORT_ALLOWLIST: Record<string, string> = {
    started_at: 'started_at',
    updated_at: 'updated_at',
    completed_at: 'completed_at',
    status: 'status',
    state: 'state',
    search_term: 'search_term',
    rows_inserted: 'rows_inserted',
    rows_returned: 'rows_returned',
    pages_fetched: 'pages_fetched',
    total_pages: 'total_pages',
    source: 'source',
  };

  const sortKeys = (sortBy || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const sortDirs = (sortDir || '').split(',').map((s) => s.trim().toLowerCase());
  const orderTerms: string[] = [];
  sortKeys.forEach((key, i) => {
    const col = SORT_ALLOWLIST[key];
    if (!col) {
      return;
    }
    const dir = sortDirs[i] === 'desc' ? 'DESC' : 'ASC';
    orderTerms.push(`${col} ${dir}`);
  });
  const orderBy = orderTerms.length > 0 ? orderTerms.join(', ') : 'started_at DESC';

  const dataParams = [...params, limit, offset];
  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM app.wigle_import_runs ${whereClause} ORDER BY ${orderBy} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    ),
    query(`SELECT COUNT(*)::int AS total FROM app.wigle_import_runs ${whereClause}`, params),
  ]);

  return {
    data: dataResult.rows.map((row: any) => serializeRun(row)),
    total: countResult.rows[0]?.total || 0,
    limit,
    offset,
  };
};

/**
 * Return per-jurisdiction import metadata plus local WiGLE v2 coverage counts.
 *
 * Import metadata is matched to the exact selected term, case-insensitively.
 * Stored network `ssid` values use the same case-insensitive pattern semantics
 * as WiGLE's `ssidlike` parameter. Local coverage is calculated independently
 * of run progress so duplicate-safe imports cannot undercount stored data.
 */
const getImportCompletenessSummary = async (
  options: {
    searchTerm?: string;
    state?: string;
  } = {}
) => {
  const { searchTerm, state } = options;
  const params: any[] = [];
  const latestRunWhere = [
    "source IN ('wigle', 'wigle_v2', 'v3_batch', 'v3_manual')",
    'state IS NOT NULL',
  ];
  const tableCountWhere = ["country = 'US'", 'region IS NOT NULL', 'LENGTH(TRIM(region)) = 2'];
  const ledgerWhere = [
    "e.kind = 'search'",
    "e.phase = 'complete'",
    "e.query_params->>'region' IS NOT NULL",
    "LENGTH(TRIM(e.query_params->>'region')) = 2",
    "TRIM(UPPER(e.query_params->>'country')) = 'US'",
  ];

  if (searchTerm) {
    params.push(searchTerm);
    latestRunWhere.push(`LOWER(search_term) = LOWER($${params.length})`);
    tableCountWhere.push(`ssid ILIKE $${params.length}`);
    ledgerWhere.push(`LOWER(e.query_params->>'ssidlike') = LOWER($${params.length})`);
  } else {
    // Ledger availability is only meaningful for a selected SSID term.
    ledgerWhere.push('FALSE');
  }
  if (state) {
    params.push(state.trim().toUpperCase());
    latestRunWhere.push(`TRIM(UPPER(state)) = $${params.length}`);
    tableCountWhere.push(`TRIM(UPPER(region)) = $${params.length}`);
    ledgerWhere.push(`TRIM(UPPER(e.query_params->>'region')) = $${params.length}`);
  }

  const result = await query(
    `WITH latest_runs AS (
       SELECT
         id,
         TRIM(UPPER(state)) as state,
         search_term,
         request_params,
         request_fingerprint,
         status,
         api_total_results,
         total_pages,
         page_size,
         pages_fetched,
         rows_returned,
         rows_inserted,
         last_successful_page,
         next_page,
         api_cursor,
         last_error,
         started_at,
         updated_at,
         completed_at,
         ROW_NUMBER() OVER (PARTITION BY TRIM(UPPER(state)) ORDER BY started_at DESC, id DESC) AS rn
       FROM app.wigle_import_runs
       WHERE ${latestRunWhere.join(' AND ')}
     ),
     table_counts AS (
       SELECT
         TRIM(UPPER(region)) AS state,
         COUNT(*)::integer AS local_rows,
         COUNT(DISTINCT bssid)::integer AS local_unique_bssids
       FROM app.wigle_v2_networks_search
       WHERE ${tableCountWhere.join(' AND ')}
       GROUP BY TRIM(UPPER(region))
     ),
     ledger_events AS (
       SELECT
         TRIM(UPPER(e.query_params->>'region')) AS state,
         e.status AS ledger_status,
         e.requested_at AS ledger_requested_at,
         e.http_status AS ledger_http_status,
         e.result_count AS ledger_result_count,
         e.retry_after_hint AS ledger_retry_after_hint,
         e.error_message AS ledger_error,
         ROW_NUMBER() OVER (
           PARTITION BY TRIM(UPPER(e.query_params->>'region'))
           ORDER BY e.requested_at DESC, e.id DESC
         ) AS rn
       FROM app.wigle_ledger_events e
       WHERE ${ledgerWhere.join(' AND ')}
     ),
     states AS (
       SELECT state FROM latest_runs
       UNION
       SELECT state FROM table_counts
       UNION
       SELECT state FROM ledger_events
     )
     SELECT
       s.state,
       COALESCE(tc.local_rows, 0) AS local_rows,
       COALESCE(tc.local_unique_bssids, 0) AS local_unique_bssids,
       COALESCE(tc.local_unique_bssids, 0) AS stored_count,
       lr.id AS run_id,
       lr.search_term,
       lr.request_params,
       lr.request_fingerprint,
       lr.status,
       lr.api_total_results,
       lr.total_pages,
       lr.page_size,
       lr.pages_fetched,
       lr.rows_returned,
       lr.rows_inserted,
       lr.last_successful_page,
       lr.next_page,
       lr.api_cursor,
       lr.last_error,
       lr.started_at,
       lr.updated_at,
       lr.completed_at,
       le.ledger_status,
       le.ledger_requested_at,
       le.ledger_http_status,
       le.ledger_result_count,
       le.ledger_retry_after_hint,
       le.ledger_error,
       CASE
         WHEN lr.api_total_results IS NULL THEN NULL
         ELSE GREATEST(lr.api_total_results - COALESCE(lr.rows_returned, 0), 0)
       END AS missing_api_rows,
       CASE
         WHEN lr.api_total_results IS NULL THEN NULL
         ELSE GREATEST(lr.api_total_results - COALESCE(lr.rows_inserted, 0), 0)
       END AS missing_insert_rows
     FROM states s
     LEFT JOIN table_counts tc ON tc.state = s.state
     LEFT JOIN latest_runs lr ON lr.state = s.state AND lr.rn = 1
     LEFT JOIN ledger_events le ON le.state = s.state AND le.rn = 1
     ORDER BY s.state`,
    params
  );

  return result.rows;
};

const getImportRun = async (runId: number) => {
  const run = await getRunOrThrow(runId);
  const pages = await getRunPages(runId);
  return serializeRun(run, pages);
};

const getLatestResumableImportRun = async (
  rawQuery: Record<string, unknown>,
  resumableStatuses: string[]
) => {
  const run = await findLatestResumableRun(rawQuery, resumableStatuses);
  if (!run) {
    return null;
  }
  return getImportRun(Number(run.id));
};

// Hard-deletes cancelled runs by ID array; returns count deleted
export const bulkDeleteCancelledRunsByIds = async (ids: number[]): Promise<number> => {
  if (ids.length === 0) {
    return 0;
  }
  const result = await adminDbService.adminQuery(
    `DELETE FROM app.wigle_import_runs
      WHERE id = ANY($1::bigint[])
        AND status = 'cancelled'`,
    [ids]
  );
  return result.rowCount ?? 0;
};

// Hard-deletes a single import run by id; only allows completed/cancelled/failed
export const deleteImportRun = async (id: number): Promise<boolean> => {
  const result = await adminDbService.adminQuery(
    `DELETE FROM app.wigle_import_runs
      WHERE id = $1
        AND status IN ('completed', 'cancelled', 'failed')`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
};

export {
  countRecentCancelledByFingerprint,
  completeRun,
  createImportRun,
  findGlobalCancelledClusterIds,
  findLatestResumableRun,
  findRunByRawFingerprint,
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
};
