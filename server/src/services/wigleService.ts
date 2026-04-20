/**
 * WiGLE Service Layer
 * Encapsulates database queries for WiGLE operations
 */

import { query } from '../config/database';
import {
  buildWigleNetworksMvQuery,
  buildWiglePageLocalMatchQuery,
  buildWiglePageV2SummaryQuery,
  buildWiglePageV3DetailQuery,
  buildWiglePageV3TemporalQuery,
  buildKmlPointsCountQuery,
  buildKmlPointsQuery,
  buildRecentWigleDetailImportQuery,
  buildWigleNetworkByBssidQuery,
  buildWigleObservationsQuery,
  buildWigleObservationsCountQuery,
  buildWigleSearchQuery,
  buildWigleV2CountQuery,
  buildWigleV2NetworksQuery,
  buildWigleV3TableExistsQuery,
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
import secretsManager from './secretsManager';
import { fetchWigle } from './wigleClient';
import { hashRecord } from './wigleRequestUtils';

type QueryExecutor = {
  query: (text: string, params?: any[]) => Promise<any>;
};

const databaseExecutor: QueryExecutor = { query };

export async function getWigleNetworkByBSSID(bssid: string): Promise<any | null> {
  const { sql, queryParams } = buildWigleNetworkByBssidQuery(bssid);
  const { rows } = await query(sql, queryParams);
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
  const { sql, queryParams } = buildWigleV3TableExistsQuery();
  const tableCheck = await query(sql, queryParams);
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

export async function getWiglePageNetwork(netid: string): Promise<{
  wigle: Record<string, unknown>;
  localLinkage: { has_local_match: boolean; local_observation_count: number };
} | null> {
  const normalizedNetid = netid.trim().toUpperCase();
  const v3DetailQuery = buildWiglePageV3DetailQuery(normalizedNetid);
  const v2SummaryQuery = buildWiglePageV2SummaryQuery(normalizedNetid);
  const localMatchQuery = buildWiglePageLocalMatchQuery(normalizedNetid);
  const v3TemporalQuery = buildWiglePageV3TemporalQuery(normalizedNetid);

  const [v3Result, v2Result, localMatchResult, v3TemporalResult] = await Promise.all([
    query(v3DetailQuery.sql, v3DetailQuery.queryParams),
    query(v2SummaryQuery.sql, v2SummaryQuery.queryParams),
    query(localMatchQuery.sql, localMatchQuery.queryParams),
    query(v3TemporalQuery.sql, v3TemporalQuery.queryParams),
  ]);

  const v3 = v3Result.rows[0] ?? null;
  const v2 = v2Result.rows[0] ?? null;

  if (!v3 && !v2) {
    return null;
  }

  const lm = localMatchResult.rows[0] ?? {};
  const t = v3TemporalResult.rows[0] ?? {};

  const hasV3Obs = (t.wigle_v3_observation_count ?? 0) > 0;
  const manufacturer = v3?.oui_manufacturer ?? v2?.oui_manufacturer ?? null;

  // Display coordinate: v2 trilaterated → v3 centroid (obs-derived) → v3 summary point
  let displayLat: number | null = null;
  let displayLon: number | null = null;
  let displayCoordinateSource: string | null = null;

  if (v2?.trilat != null && v2?.trilong != null) {
    displayLat = v2.trilat;
    displayLon = v2.trilong;
    displayCoordinateSource = 'wigle-v2-trilat';
  } else if (hasV3Obs && t.wigle_v3_centroid_lat != null) {
    displayLat = t.wigle_v3_centroid_lat;
    displayLon = t.wigle_v3_centroid_lon;
    displayCoordinateSource = 'wigle-v3-centroid';
  } else if (v3?.trilat != null) {
    displayLat = v3.trilat;
    displayLon = v3.trilon;
    displayCoordinateSource = 'wigle-v3-summary';
  }

  const spreadM = t.wigle_v3_spread_m ?? null;

  return {
    wigle: {
      bssid: normalizedNetid,
      ssid: v3?.ssid ?? v3?.name ?? v2?.ssid ?? null,
      name: v3?.name ?? null,
      type: v2?.type ?? v3?.type ?? null,
      encryption: v2?.encryption ?? v3?.encryption ?? null,
      channel: v2?.channel ?? v3?.channel ?? null,
      frequency: v2?.frequency ?? null,
      qos: v2?.qos ?? v3?.qos ?? null,
      comment: v3?.comment ?? null,
      wigle_source: v3 ? 'wigle-v3' : 'wigle-v2',
      // v2 provenance
      wigle_v2_firsttime: v2?.firsttime ?? null,
      wigle_v2_lasttime: v2?.lasttime ?? null,
      wigle_v2_trilat: v2?.trilat ?? null,
      wigle_v2_trilong: v2?.trilong ?? null,
      wigle_v2_city: v2?.city ?? null,
      wigle_v2_region: v2?.region ?? null,
      wigle_v2_road: v2?.road ?? null,
      wigle_v2_housenumber: v2?.housenumber ?? null,
      has_wigle_v2_record: v2 !== null,
      // v3-derived temporal — from observations, not the summary row
      wigle_v3_first_seen: hasV3Obs ? (t.wigle_v3_first_seen ?? null) : null,
      wigle_v3_last_seen: hasV3Obs ? (t.wigle_v3_last_seen ?? null) : null,
      wigle_v3_observation_count: hasV3Obs ? (t.wigle_v3_observation_count ?? null) : null,
      wigle_v3_centroid_lat: hasV3Obs ? (t.wigle_v3_centroid_lat ?? null) : null,
      wigle_v3_centroid_lon: hasV3Obs ? (t.wigle_v3_centroid_lon ?? null) : null,
      wigle_v3_spread_m: hasV3Obs ? spreadM : null,
      has_wigle_v3_observations: hasV3Obs,
      // Chosen display coordinate
      display_lat: displayLat,
      display_lon: displayLon,
      display_coordinate_source: displayCoordinateSource,
      // Enrichment
      manufacturer,
      // Public-pattern signals (observable, not inference)
      public_nonstationary_flag: hasV3Obs && spreadM !== null && spreadM > 500,
      public_ssid_variant_flag: hasV3Obs && (t.wigle_v3_ssid_variant_count ?? 0) > 1,
      // Precision caveat
      wigle_precision_warning: hasV3Obs ? (t.wigle_precision_warning ?? false) : false,
    },
    localLinkage: {
      has_local_match: lm.has_local_match ?? false,
      local_observation_count: lm.local_observation_count ?? 0,
    },
  };
}

/**
 * MV-backed lookup — single-row read from api_wigle_networks_mv.
 * Returns the same { wigle, localLinkage } shape as getWiglePageNetwork.
 * Returns null if the MV doesn't exist yet or the BSSID is not found.
 */
export async function getWiglePageNetworkFromMv(bssid: string): Promise<{
  wigle: Record<string, unknown>;
  localLinkage: { has_local_match: boolean; local_observation_count: number };
} | null> {
  const normalizedBssid = bssid.trim().toUpperCase();
  const { sql, queryParams } = buildWigleNetworksMvQuery(normalizedBssid);
  let row: any;
  try {
    const result = await query(sql, queryParams);
    row = result.rows[0] ?? null;
  } catch {
    // MV may not exist on older deployments; caller falls back to fan-out path.
    return null;
  }
  if (!row) return null;

  return {
    wigle: {
      bssid: row.bssid,
      ssid: row.ssid_display,
      name: row.network_name,
      type: row.network_type,
      encryption: row.encryption,
      channel: row.channel,
      frequency: row.frequency,
      qos: row.qos,
      comment: row.comment,
      wigle_source: row.wigle_source,
      wigle_v2_firsttime: row.wigle_v2_firsttime,
      wigle_v2_lasttime: row.wigle_v2_lasttime,
      wigle_v2_trilat: row.wigle_v2_trilat_lat,
      wigle_v2_trilong: row.wigle_v2_trilat_lon,
      wigle_v2_city: row.wigle_v2_city,
      wigle_v2_region: row.wigle_v2_region,
      wigle_v2_road: row.wigle_v2_road,
      wigle_v2_housenumber: row.wigle_v2_housenumber,
      has_wigle_v2_record: row.has_wigle_v2_record,
      wigle_v3_first_seen: row.wigle_v3_first_seen,
      wigle_v3_last_seen: row.wigle_v3_last_seen,
      wigle_v3_observation_count: row.wigle_v3_observation_count,
      wigle_v3_centroid_lat: row.wigle_v3_centroid_lat,
      wigle_v3_centroid_lon: row.wigle_v3_centroid_lon,
      wigle_v3_spread_m: row.wigle_v3_spread_m,
      has_wigle_v3_observations: row.has_wigle_v3_observations,
      display_lat: row.display_lat,
      display_lon: row.display_lon,
      display_coordinate_source: row.display_coordinate_source,
      manufacturer: row.manufacturer,
      public_nonstationary_flag: row.public_nonstationary_flag ?? false,
      public_ssid_variant_flag: row.public_ssid_variant_flag ?? false,
      wigle_precision_warning: row.wigle_precision_warning ?? false,
    },
    localLinkage: {
      has_local_match: row.has_local_match ?? false,
      local_observation_count: 0,
    },
  };
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
  await persistWigleV3NetworkDetail(databaseExecutor, data);
}

export async function importWigleV3Observation(
  netid: string,
  loc: any,
  ssid: string | null
): Promise<number> {
  return persistWigleV3Observation(databaseExecutor, netid, loc, ssid);
}

export async function getWigleV3Observations(netid: string): Promise<any[]> {
  return getStoredWigleV3Observations(databaseExecutor, netid);
}

export async function importWigleV2SearchResult(
  network: any,
  executor: QueryExecutor = databaseExecutor
): Promise<number> {
  return insertWigleV2SearchResult(executor, network);
}

// ── Unified higher-level helpers ──────────────────────────────────────────

export interface WigleDatabaseFilters {
  /** 'v2' queries wigle_v2_networks_search; 'v3' queries wigle_v3_observations */
  version?: 'v2' | 'v3';
  ssid?: string;
  bssid?: string;
  /** Encryption filter (e.g. 'WPA2', 'Open') */
  encryption?: string;
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
    encryption,
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
      where.push(`obs.ssid ILIKE $${idx++}`);
      params.push(`%${ssid}%`);
    }
    if (bssid) {
      where.push(`obs.netid ILIKE $${idx++}`);
      params.push(`${bssid}%`);
    }
    if (encryption) {
      where.push(`obs.encryption ILIKE $${idx++}`);
      params.push(`%${encryption}%`);
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
  if (encryption) {
    where.push(`encryption ILIKE $${idx++}`);
    params.push(`%${encryption}%`);
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
  const rows = await getStoredWigleDetail(databaseExecutor, netid);

  if (rows.length > 0) return rows[0];

  // Fall back to v2 enriched view
  return getWigleNetworkByBSSID(netid);
}

export async function getRecentWigleDetailImport(
  netid: string,
  withinHours: number
): Promise<any | null> {
  const hours = Number.isFinite(withinHours) && withinHours > 0 ? withinHours : 24;
  const { sql, queryParams } = buildRecentWigleDetailImportQuery(netid, hours);
  const { rows } = await query(sql, queryParams);

  return rows[0] || null;
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
  const observationsQuery = buildWigleObservationsQuery(netid, limit, offset);
  const countQuery = buildWigleObservationsCountQuery(netid);

  const [{ rows }, countResult] = await Promise.all([
    query(observationsQuery.sql, observationsQuery.queryParams),
    query(countQuery.sql, countQuery.queryParams),
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
  const pointsQuery = buildKmlPointsQuery({ bssid, limit, offset });
  const { rows } = await query(pointsQuery.sql, pointsQuery.queryParams);

  let total: number | null = null;
  if (includeTotal) {
    const countQuery = buildKmlPointsCountQuery(bssid);
    const { rows: countRows } = await query(countQuery.sql, countQuery.queryParams);
    total = parseInt(countRows[0]?.total || '0', 10);
  }

  return { rows, total };
}

/**
 * Fetch current user statistics from WiGLE API
 */
export async function getUserStats(): Promise<any> {
  const name = secretsManager.get('wigle_api_name');
  const token = secretsManager.get('wigle_api_token');

  if (!name || !token) {
    throw new Error('WiGLE API credentials not configured');
  }

  const encoded = Buffer.from(`${name}:${token}`).toString('base64');

  const response = await fetchWigle({
    kind: 'stats',
    url: 'https://api.wigle.net/api/v2/stats/user',
    timeoutMs: 15000,
    maxRetries: 0,
    label: 'WiGLE User Stats',
    entrypoint: 'stats',
    paramsHash: hashRecord({ endpoint: 'v2/stats/user' }),
    endpointType: 'v2/stats/user',
    init: {
      headers: {
        Authorization: `Basic ${encoded}`,
      },
    },
  });

  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `WiGLE API error: ${response.status}`);
  }

  return response.json();
}
