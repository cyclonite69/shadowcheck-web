const { pool, query } = require('../../config/database');

import {
  DEFAULT_RESULTS_PER_PAGE,
  getRequestFingerprint,
  getSearchTerm,
  normalizeImportParams,
} from './params';
import { serializeRun } from './serialization';

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
  return result.rows[0];
};

const findLatestResumableRun = async (
  rawQuery: Record<string, unknown>,
  resumableStatuses: string[]
) => {
  const normalized = normalizeImportParams(rawQuery);
  const result = await query(
    `SELECT *
       FROM app.wigle_import_runs
      WHERE request_fingerprint = $1
        AND status = ANY($2::text[])
      ORDER BY started_at DESC
      LIMIT 1`,
    [getRequestFingerprint(normalized), resumableStatuses]
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

const completeRun = async (runId: number, note?: string) => {
  const result = await query(
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

const getRunOrThrow = async (runId: number) => {
  const run = await getRunRow(runId);
  if (!run) {
    throw new Error(`WiGLE import run ${runId} not found`);
  }
  return run;
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

const getImportCompletenessSummary = async (
  options: {
    searchTerm?: string;
    state?: string;
  } = {}
) => {
  const { searchTerm, state } = options;
  const params: any[] = [];
  const latestRunWhere = [`source IN ('wigle', 'v3_batch', 'v3_manual')`, `state IS NOT NULL`];
  const tableCountWhere = [`country = 'US'`, `region IS NOT NULL`, `LENGTH(TRIM(region)) = 2`];

  if (searchTerm) {
    params.push(`%${searchTerm}%`);
    latestRunWhere.push(`search_term ILIKE $${params.length}`);
  }
  if (state) {
    params.push(state.trim().toUpperCase());
    latestRunWhere.push(`TRIM(UPPER(state)) = $${params.length}`);
    tableCountWhere.push(`TRIM(UPPER(region)) = $${params.length}`);
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
         COUNT(DISTINCT bssid)::integer AS stored_count
       FROM app.wigle_v2_networks_search
       WHERE ${tableCountWhere.join(' AND ')}
       GROUP BY TRIM(UPPER(region))
     ),
     states AS (
       SELECT state FROM latest_runs
       UNION
       SELECT state FROM table_counts
     )
     SELECT
       s.state,
       COALESCE(tc.stored_count, 0) AS stored_count,
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
  if (!run) return null;
  return getImportRun(Number(run.id));
};

// Returns count of cancelled runs with the same fingerprint created within windowSeconds
export const countRecentCancelledByFingerprint = async (
  fingerprint: string,
  windowSeconds = 60
): Promise<number> => {
  const result = await query(
    `SELECT COUNT(*)::int AS count
       FROM app.wigle_import_runs
      WHERE request_fingerprint = $1
        AND status = 'cancelled'
        AND started_at > NOW() - ($2 * INTERVAL '1 second')`,
    [fingerprint, windowSeconds]
  );
  return result.rows[0]?.count ?? 0;
};

// Finds IDs of cancelled Global (state IS NULL) runs that cluster within windowSeconds of each other
export const findGlobalCancelledClusterIds = async (windowSeconds = 60): Promise<number[]> => {
  const result = await query(
    `WITH ranked AS (
       SELECT id, started_at,
              FIRST_VALUE(started_at) OVER (ORDER BY started_at) AS earliest
       FROM app.wigle_import_runs
       WHERE status = 'cancelled'
         AND state IS NULL
     )
     SELECT id
       FROM ranked
      WHERE EXTRACT(EPOCH FROM (started_at - earliest)) <= $1
      ORDER BY started_at`,
    [windowSeconds]
  );
  return result.rows.map((r: any) => Number(r.id));
};

// Hard-deletes cancelled runs by ID array; returns count deleted
export const bulkDeleteCancelledRunsByIds = async (ids: number[]): Promise<number> => {
  if (ids.length === 0) return 0;
  const result = await query(
    `DELETE FROM app.wigle_import_runs
      WHERE id = ANY($1::bigint[])
        AND status = 'cancelled'`,
    [ids]
  );
  return result.rowCount ?? 0;
};

export {
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
};
