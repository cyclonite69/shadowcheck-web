const { query } = require('../../../config/database');

import { getRequestFingerprint, normalizeImportParams } from '../params';
import { ALLOWED_WIFI_SEARCH_SOURCES } from '../sourceGuards';

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
        AND source = ANY($3::text[])
      ORDER BY started_at DESC
      LIMIT 1`,
    [getRequestFingerprint(normalized), resumableStatuses, [...ALLOWED_WIFI_SEARCH_SOURCES]]
  );
  return result.rows[0] || null;
};

const countRecentCancelledByFingerprint = async (
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

const findGlobalCancelledClusterIds = async (): Promise<number[]> => {
  const result = await query(
    `SELECT id
       FROM app.wigle_import_runs
      WHERE status = 'cancelled'
        AND state IS NULL
      ORDER BY started_at`
  );
  return result.rows.map((r: any) => Number(r.id));
};

const findRunByRawFingerprint = async (
  fingerprint: string,
  resumableStatuses: string[]
): Promise<any | null> => {
  const result = await query(
    `SELECT *
       FROM app.wigle_import_runs
      WHERE request_fingerprint = $1
        AND status = ANY($2::text[])
      ORDER BY started_at DESC
      LIMIT 1`,
    [fingerprint, resumableStatuses]
  );
  return result.rows[0] || null;
};

export {
  countRecentCancelledByFingerprint,
  findGlobalCancelledClusterIds,
  findLatestResumableRun,
  findRunByRawFingerprint,
  getRunPages,
  getRunRow,
};
