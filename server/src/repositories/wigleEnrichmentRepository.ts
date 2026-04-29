/**
 * WiGLE Enrichment Repository
 * All adminQuery data access for the v3 batch enrichment pipeline.
 */

import * as container from '../config/container';

const { adminDbService } = container as any;
const { adminQuery } = adminDbService;

const BATCH_SIZE = 100;

/** Count of unique BSSIDs in v2 search results awaiting v3 enrichment. */
export async function getPendingEnrichmentCount(): Promise<number> {
  const { rows } = await adminQuery(
    `SELECT COUNT(DISTINCT bssid)::int AS count FROM app.wigle_v2_networks_search`
  );
  return rows[0]?.count || 0;
}

/** Browse the v2 catalog with per-BSSID v3 enrichment stats. */
export async function getEnrichmentCatalog(options: {
  page?: number;
  limit?: number;
  region?: string;
  city?: string;
  ssid?: string;
  bssid?: string;
}) {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  const filterParams: any[] = [];
  const getWhere = (startIndex: number) => {
    const w: string[] = [];
    let idx = startIndex;
    if (options.region) {
      filterParams.push(options.region.trim() + '%');
      w.push(`TRIM(region) ILIKE $${idx++}`);
    }
    if (options.city) {
      filterParams.push(options.city.trim() + '%');
      w.push(`TRIM(city) ILIKE $${idx++}`);
    }
    if (options.ssid) {
      filterParams.push('%' + options.ssid.trim() + '%');
      w.push(`ssid ILIKE $${idx++}`);
    }
    if (options.bssid) {
      filterParams.push(options.bssid.trim() + '%');
      w.push(`bssid ILIKE $${idx++}`);
    }
    return w.length > 0 ? `WHERE ${w.join(' AND ')}` : '';
  };

  // Build filter params once for count query, then reuse for main query
  const countWhere = getWhere(1);
  const countParams = [...filterParams];
  filterParams.length = 0; // reset for main query
  const mainWhere = getWhere(3);

  const [dataResult, countResult] = await Promise.all([
    adminQuery(
      `SELECT
         v2.bssid, v2.ssid, v2.region, v2.city, v2.type, v2.firsttime, v2.lasttime,
         v3.imported_at AS last_v3_import,
         (SELECT COUNT(*)::int FROM app.wigle_v3_observations o WHERE o.netid = v2.bssid) AS v3_obs_count
       FROM (
         SELECT DISTINCT ON (bssid) bssid, ssid, region, city, type, firsttime, lasttime
         FROM app.wigle_v2_networks_search
         ${mainWhere}
         ORDER BY bssid, lasttime DESC
       ) v2
       LEFT JOIN app.wigle_v3_network_details v3 ON v3.netid = v2.bssid
       ORDER BY v2.lasttime DESC, v2.bssid ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset, ...filterParams]
    ),
    adminQuery(
      `SELECT COUNT(DISTINCT bssid)::int FROM app.wigle_v2_networks_search ${countWhere}`,
      countParams
    ),
  ]);

  return { data: dataResult.rows, total: countResult.rows[0]?.count || 0, page, limit };
}

/** Next batch of BSSIDs to enrich (missing v3 details first, or from a manual list). */
export async function getNextEnrichmentBatch(
  limit = BATCH_SIZE,
  manualList?: string[]
): Promise<any[]> {
  if (manualList && manualList.length > 0) {
    const { rows } = await adminQuery(
      `SELECT DISTINCT ON (bssid) bssid, type
       FROM app.wigle_v2_networks_search
       WHERE bssid = ANY($2::text[])
       ORDER BY bssid, lasttime DESC
       LIMIT $1`,
      [limit, manualList]
    );
    return rows;
  }

  const { rows } = await adminQuery(
    `SELECT DISTINCT ON (v2.bssid) v2.bssid, v2.type
     FROM app.wigle_v2_networks_search v2
     LEFT JOIN app.wigle_v3_network_details v3 ON v3.netid = v2.bssid
     WHERE v3.netid IS NULL
     ORDER BY v2.bssid, v2.lasttime DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

/**
 * Returns the id of any v3 enrichment run currently in 'running' state, or null.
 * Pass excludeRunId to ignore a specific run (used by resumeEnrichment).
 */
export async function getActiveEnrichmentRunId(excludeRunId?: number): Promise<number | null> {
  const { rows } = await adminQuery(
    excludeRunId != null
      ? `SELECT id FROM app.wigle_import_runs
         WHERE status = 'running' AND source IN ('v3_manual', 'v3_batch') AND id != $1 LIMIT 1`
      : `SELECT id FROM app.wigle_import_runs
         WHERE status = 'running' AND source IN ('v3_manual', 'v3_batch') LIMIT 1`,
    excludeRunId != null ? [excludeRunId] : []
  );
  return rows[0]?.id ?? null;
}

/** Set api_total_results on a run (used for progress bar). */
export async function setRunTotalItems(runId: number, total: number): Promise<void> {
  await adminQuery(`UPDATE app.wigle_import_runs SET api_total_results = $1 WHERE id = $2`, [
    total,
    runId,
  ]);
}

/** Increment rows_inserted and pages_fetched by 1 for a run. */
export async function incrementRunProgress(runId: number): Promise<void> {
  await adminQuery(
    `UPDATE app.wigle_import_runs
     SET rows_inserted = rows_inserted + 1, pages_fetched = pages_fetched + 1, updated_at = NOW()
     WHERE id = $1`,
    [runId]
  );
}

/** Check current run status (for pause/cancel polling). */
export async function getRunStatus(runId: number): Promise<string | null> {
  const { rows } = await adminQuery(`SELECT status FROM app.wigle_import_runs WHERE id = $1`, [
    runId,
  ]);
  return rows[0]?.status ?? null;
}

/** Reset a run to 'running' and clear last_error (for resume). Returns the updated row. */
export async function resetRunForResume(runId: number): Promise<any | null> {
  const { rows } = await adminQuery(
    `UPDATE app.wigle_import_runs SET status = 'running', last_error = NULL WHERE id = $1 RETURNING *`,
    [runId]
  );
  return rows[0] ?? null;
}

/** Trigger the WiGLE networks materialized view refresh. */
export async function refreshWigleNetworksMv(): Promise<void> {
  await adminQuery(`SELECT app.refresh_wigle_networks_mv()`);
}
