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

export {
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
};
