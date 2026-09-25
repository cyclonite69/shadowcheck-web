/**
 * WiGLE enrichment read repository.
 * All SELECT/adminQuery access for catalog browsing, orphan detection, and run polling.
 */

import { escapeLikePattern } from '../../../utils/escapeSQL';

function adminQuery(text: string, params: any[] = []) {
  return require('../../../config/container').adminDbService.adminQuery(text, params);
}

const BATCH_SIZE = 100;

/**
 * Count v2 catalog networks awaiting v3 detail enrichment.
 */
export async function getPendingEnrichmentCount(): Promise<number> {
  const { rows } = await adminQuery(
    'SELECT COUNT(DISTINCT bssid)::int AS count FROM app.wigle_v2_networks_search'
  );
  return rows[0]?.count || 0;
}

/**
 * Browse the v2 catalog with per-BSSID v3 enrichment stats.
 */
export async function getEnrichmentCatalog(options: {
  page?: number;
  limit?: number;
  region?: string;
  city?: string;
  ssid?: string;
  bssid?: string;
  sortBy?: string;
  sortDir?: string;
}) {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  const filterParams: any[] = [];
  const getWhere = (startIndex: number) => {
    const w: string[] = [];
    let idx = startIndex;
    if (options.region) {
      filterParams.push(`${escapeLikePattern(options.region.trim())}%`);
      w.push(`TRIM(region) ILIKE $${idx++} ESCAPE '\\'`);
    }
    if (options.city) {
      filterParams.push(`${escapeLikePattern(options.city.trim())}%`);
      w.push(`TRIM(city) ILIKE $${idx++} ESCAPE '\\'`);
    }
    if (options.ssid) {
      filterParams.push(`%${escapeLikePattern(options.ssid.trim())}%`);
      w.push(`ssid ILIKE $${idx++} ESCAPE '\\'`);
    }
    if (options.bssid) {
      filterParams.push(`${escapeLikePattern(options.bssid.trim())}%`);
      w.push(`bssid ILIKE $${idx} ESCAPE '\\'`);
    }
    return w.length > 0 ? `WHERE ${w.join(' AND ')}` : '';
  };

  const countWhere = getWhere(1);
  const countParams = [...filterParams];
  filterParams.length = 0;
  const mainWhere = getWhere(3);

  const SORT_ALLOWLIST: Record<string, string | string[]> = {
    ssid: 'v2.ssid',
    firsttime: 'v2.firsttime',
    lasttime: 'v2.lasttime',
    last_v3_import: 'v3.imported_at',
    signal: 'signal',
    channel: 'v3.channel',
    encryption: 'v3.encryption',
    status: 'v3_obs_count',
    location: ['v2.city', 'v2.region'],
  };

  const sortKeys = (options.sortBy || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const sortDirs = (options.sortDir || '').split(',').map((s) => s.trim().toLowerCase());

  const orderTerms: string[] = [];
  sortKeys.forEach((key, i) => {
    const col = SORT_ALLOWLIST[key];
    if (!col) {
      return;
    }
    const dir = sortDirs[i] === 'desc' ? 'DESC' : 'ASC';
    if (Array.isArray(col)) {
      col.forEach((c) => orderTerms.push(`${c} ${dir}`));
    } else {
      orderTerms.push(`${col} ${dir}`);
    }
  });

  const orderBy = orderTerms.length > 0 ? orderTerms.join(', ') : 'v2.lasttime DESC, v2.bssid ASC';

  const [dataResult, countResult] = await Promise.all([
    adminQuery(
      `SELECT
         v2.bssid, v2.ssid, v2.region, v2.city, v2.type, v2.firsttime, v2.lasttime,
         v3.imported_at AS last_v3_import,
         v3.channel,
         v3.encryption,
         (SELECT COUNT(*)::int FROM app.wigle_v3_observations o WHERE o.netid = v2.bssid) AS v3_obs_count,
         (SELECT ROUND(AVG(o.signal))::int FROM app.wigle_v3_observations o WHERE o.netid = v2.bssid AND o.signal IS NOT NULL) AS signal
       FROM (
         SELECT DISTINCT ON (bssid) bssid, ssid, region, city, type, firsttime, lasttime
         FROM app.wigle_v2_networks_search
         ${mainWhere}
         ORDER BY bssid, lasttime DESC
       ) v2
       LEFT JOIN app.wigle_v3_network_details v3 ON v3.netid = v2.bssid
       ORDER BY ${orderBy}
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

/**
 * Next batch of BSSIDs to enrich (v2 rows missing v3 network details, or from a manual list).
 */
export async function getNextEnrichmentBatch(
  limit = BATCH_SIZE,
  manualList?: string[]
): Promise<Array<{ bssid: string; type: string }>> {
  if (manualList && manualList.length > 0) {
    const normalizedList = manualList.map((b) => b.trim().toUpperCase());
    const { rows } = await adminQuery(
      `SELECT DISTINCT ON (bssid) bssid, type
       FROM app.wigle_v2_networks_search
       WHERE TRIM(UPPER(bssid)) = ANY($2::text[])
       ORDER BY bssid, lasttime DESC
       LIMIT $1`,
      [limit, normalizedList]
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
 * Field observations whose BSSID has no matching v3 network detail row.
 */
export async function countFieldObservationsMissingV3Detail(): Promise<number> {
  const { rows } = await adminQuery(
    `SELECT COUNT(DISTINCT o.bssid)::int AS count
       FROM app.observations o
       LEFT JOIN app.wigle_v3_network_details v3 ON v3.netid = TRIM(UPPER(o.bssid))
      WHERE o.bssid IS NOT NULL
        AND v3.netid IS NULL`
  );
  return rows[0]?.count || 0;
}

/** Returns the id of any v3 enrichment run currently in 'running' state, or null. */
export async function getActiveEnrichmentRunId(excludeRunId?: number): Promise<number | null> {
  const hasExclude = excludeRunId !== null && excludeRunId !== undefined;
  const { rows } = await adminQuery(
    hasExclude
      ? `SELECT id FROM app.wigle_import_runs
         WHERE status = 'running' AND source IN ('v3_manual', 'v3_batch') AND id != $1 LIMIT 1`
      : `SELECT id FROM app.wigle_import_runs
         WHERE status = 'running' AND source IN ('v3_manual', 'v3_batch') LIMIT 1`,
    hasExclude ? [excludeRunId] : []
  );
  return rows[0]?.id ?? null;
}

/** Check current run status (for pause/cancel polling). */
export async function getRunStatus(runId: number): Promise<string | null> {
  const { rows } = await adminQuery('SELECT status FROM app.wigle_import_runs WHERE id = $1', [
    runId,
  ]);
  return rows[0]?.status ?? null;
}
