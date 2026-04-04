/**
 * WiGLE Service Layer
 * Encapsulates database queries for WiGLE operations
 */

const { query } = require('../config/database');
import {
  buildWigleObservationsQuery,
  buildWigleSearchQuery,
  buildWigleV2CountQuery,
  buildWigleV2NetworksQuery,
  buildWigleV3CountQuery,
  buildWigleV3NetworksQuery,
} from '../repositories/wigleQueriesRepository';
import {
  getWigleDetail as getStoredWigleDetail,
  getWigleV3Observations as getStoredWigleV3Observations,
  importWigleV3NetworkDetail as persistWigleV3NetworkDetail,
  importWigleV3Observation as persistWigleV3Observation,
  insertWigleV2SearchResult,
} from '../repositories/wiglePersistenceRepository';

type QueryExecutor = {
  query: (text: string, params?: any[]) => Promise<any>;
};

export async function getWigleNetworkByBSSID(bssid: string): Promise<any | null> {
  const { rows } = await query(
    `SELECT bssid, ssid, encryption, country, region, city, trilat, trilon, first_seen, last_seen
     FROM app.wigle_networks_enriched WHERE bssid = $1 LIMIT 1`,
    [bssid]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function searchWigleDatabase(params: {
  ssid?: string;
  bssid?: string;
  limit: number | null;
}): Promise<any[]> {
  const { sql, queryParams } = buildWigleSearchQuery(params);
  const { rows } = await query(sql, queryParams);
  return rows;
}

export async function getWigleV2Networks(params: {
  limit: number | null;
  offset: number | null;
  type?: string;
  whereClauses: string[];
  queryParams: any[];
}): Promise<any[]> {
  const { sql, queryParams } = buildWigleV2NetworksQuery(params);
  const { rows } = await query(sql, queryParams);
  return rows;
}

export async function getWigleV2NetworksCount(
  whereClauses: string[],
  queryParams: any[]
): Promise<number> {
  const { sql, queryParams: resolvedParams } = buildWigleV2CountQuery(whereClauses, queryParams);
  const countResult = await query(sql, resolvedParams);
  return parseInt(countResult.rows[0].total, 10);
}

export async function checkWigleV3TableExists(): Promise<boolean> {
  const tableCheck = await query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'app' AND table_name = 'wigle_v3_observations'
     ) as exists`
  );
  return tableCheck.rows[0]?.exists || false;
}

export async function getWigleV3Networks(params: {
  limit: number | null;
  offset: number | null;
  whereClauses?: string[];
  queryParams?: any[];
}): Promise<any[]> {
  const { sql, queryParams } = buildWigleV3NetworksQuery(params);
  const { rows } = await query(sql, queryParams);
  return rows;
}

export async function getWigleV3NetworksCount(
  whereClauses: string[] = [],
  queryParams: any[] = []
): Promise<number> {
  const { sql, queryParams: resolvedParams } = buildWigleV3CountQuery(whereClauses, queryParams);
  const countResult = await query(sql, resolvedParams);
  return parseInt(countResult.rows[0].total, 10);
}

export async function importWigleV3NetworkDetail(data: any): Promise<void> {
  await persistWigleV3NetworkDetail({ query }, data);
}

export async function importWigleV3Observation(
  netid: string,
  loc: any,
  ssid: string | null
): Promise<number> {
  return persistWigleV3Observation({ query }, netid, loc, ssid);
}

export async function getWigleV3Observations(netid: string): Promise<any[]> {
  return getStoredWigleV3Observations({ query }, netid);
}

export async function importWigleV2SearchResult(
  network: any,
  executor: QueryExecutor = { query }
): Promise<number> {
  return insertWigleV2SearchResult(executor, network);
}

// ── Unified higher-level helpers ──────────────────────────────────────────

export interface WigleDatabaseFilters {
  /** 'v2' queries wigle_v2_networks_search; 'v3' queries wigle_v3_observations */
  version?: 'v2' | 'v3';
  ssid?: string;
  bssid?: string;
  /** Network type filter (v2 only, e.g. 'wifi', 'bt') */
  type?: string;
  limit?: number | null;
  offset?: number | null;
  /** When true, also return the total count for pagination */
  includeTotal?: boolean;
}

/**
 * Unified paginated list of WiGLE networks.
 *
 * Builds WHERE clauses internally so routes deal only with typed filter
 * values rather than SQL fragment arrays.
 */
export async function getWigleDatabase(
  filters: WigleDatabaseFilters = {}
): Promise<{ rows: any[]; total: number | null }> {
  const {
    version = 'v2',
    ssid,
    bssid,
    type,
    limit = null,
    offset = null,
    includeTotal = false,
  } = filters;

  if (version === 'v3') {
    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (ssid) {
      where.push(`ssid ILIKE $${idx++}`);
      params.push(`%${ssid}%`);
    }
    if (bssid) {
      where.push(`netid ILIKE $${idx++}`);
      params.push(`${bssid}%`);
    }

    const rows = await getWigleV3Networks({
      limit,
      offset,
      whereClauses: where,
      queryParams: params,
    });
    const total = includeTotal ? await getWigleV3NetworksCount(where, params) : null;
    return { rows, total };
  }

  // v2 (default) — requires valid coordinates
  const where = ['trilat IS NOT NULL', 'trilong IS NOT NULL'];
  const params: any[] = [];
  let idx = 1;

  if (type && String(type).trim()) {
    where.push(`type = $${idx++}`);
    params.push(String(type).trim());
  }
  if (ssid) {
    where.push(`ssid ILIKE $${idx++}`);
    params.push(`%${ssid}%`);
  }
  if (bssid) {
    where.push(`bssid ILIKE $${idx++}`);
    params.push(`${bssid}%`);
  }

  const rows = await getWigleV2Networks({
    limit,
    offset,
    type,
    whereClauses: where,
    queryParams: params,
  });
  const total = includeTotal ? await getWigleV2NetworksCount(where, params) : null;
  return { rows, total };
}

/**
 * Full detail for a single network by netid / BSSID.
 *
 * Queries `wigle_v3_network_details` (enriched with latest observation) first,
 * then falls back to the `wigle_networks_enriched` view for v2-only imports.
 */
export async function getWigleDetail(netid: string): Promise<any | null> {
  const rows = await getStoredWigleDetail({ query }, netid);

  if (rows.length > 0) return rows[0];

  // Fall back to v2 enriched view
  return getWigleNetworkByBSSID(netid);
}

/**
 * Paginated observation timeline for a network.
 *
 * Unlike the original `getWigleV3Observations`, this variant accepts
 * `limit` and `offset` for cursor-style pagination and also returns
 * the total observation count.
 */
export async function getWigleObservations(
  netid: string,
  limit?: number | null,
  offset?: number | null
): Promise<{ rows: any[]; total: number }> {
  const { sql, queryParams } = buildWigleObservationsQuery(netid, limit, offset);

  const [{ rows }, countResult] = await Promise.all([
    query(sql, queryParams),
    query(`SELECT COUNT(*) AS total FROM app.wigle_v3_observations WHERE netid = $1`, [netid]),
  ]);

  return { rows, total: parseInt(countResult.rows[0]?.total || '0', 10) };
}

export async function getKmlPointsForMap(params: {
  bssid?: string;
  limit?: number | null;
  offset?: number | null;
  includeTotal?: boolean;
}): Promise<{ rows: any[]; total: number | null }> {
  const { bssid, limit = null, offset = null, includeTotal = false } = params;
  const queryParams: any[] = [];
  const whereClauses = ['kp.location IS NOT NULL'];

  if (bssid) {
    queryParams.push(`${bssid}%`);
    whereClauses.push(`kp.bssid ILIKE $${queryParams.length}`);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  let pagingSql = '';

  if (limit !== null) {
    queryParams.push(limit);
    pagingSql += ` LIMIT $${queryParams.length}`;
  }
  if (offset !== null && offset > 0) {
    queryParams.push(offset);
    pagingSql += ` OFFSET $${queryParams.length}`;
  }

  const { rows } = await query(
    `
      SELECT
        kp.id,
        kp.bssid,
        NULLIF(kp.name, '') AS ssid,
        kp.network_id,
        kp.name,
        kp.network_type,
        kp.observed_at,
        kp.accuracy_m,
        kp.signal_dbm,
        kf.source_file,
        kp.folder_name,
        ST_Y(kp.location) AS latitude,
        ST_X(kp.location) AS longitude
      FROM app.kml_points kp
      JOIN app.kml_files kf ON kf.id = kp.kml_file_id
      ${whereSql}
      ORDER BY kp.observed_at DESC NULLS LAST, kp.id DESC
      ${pagingSql}
    `,
    queryParams
  );

  let total: number | null = null;
  if (includeTotal) {
    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM app.kml_points kp
       ${whereSql}`,
      queryParams.slice(0, bssid ? 1 : 0)
    );
    total = parseInt(countResult.rows[0]?.total || '0', 10);
  }

  return { rows, total };
}

/**
 * Fetch current user statistics from WiGLE API
 */
export async function getUserStats(): Promise<any> {
  const secretsManager = require('./secretsManager').default;
  const encoded = secretsManager.get('wigle_api_encoded');

  if (!encoded) {
    throw new Error('WiGLE API credentials not configured');
  }

  const response = await fetch('https://api.wigle.net/api/v2/stats/user', {
    headers: {
      Authorization: `Basic ${encoded}`,
    },
  });

  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `WiGLE API error: ${response.status}`);
  }

  return response.json();
}

module.exports = {
  getWigleNetworkByBSSID,
  searchWigleDatabase,
  getWigleV2Networks,
  getWigleV2NetworksCount,
  checkWigleV3TableExists,
  getWigleV3Networks,
  getWigleV3NetworksCount,
  importWigleV3NetworkDetail,
  importWigleV3Observation,
  getWigleV3Observations,
  importWigleV2SearchResult,
  getWigleDatabase,
  getWigleDetail,
  getWigleObservations,
  getKmlPointsForMap,
  getUserStats,
};
