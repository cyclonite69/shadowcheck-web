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
} from './wigleQueries';

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
  await query(
    `INSERT INTO app.wigle_v3_network_details (
      netid, name, type, comment, ssid, trilat, trilon, encryption, channel,
      bcninterval, freenet, dhcp, paynet, qos, first_seen, last_seen, last_update,
      street_address, location_clusters
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (netid) DO UPDATE SET
      name = EXCLUDED.name, type = EXCLUDED.type, comment = EXCLUDED.comment,
      ssid = EXCLUDED.ssid, trilat = EXCLUDED.trilat, trilon = EXCLUDED.trilon,
      encryption = EXCLUDED.encryption, channel = EXCLUDED.channel,
      bcninterval = EXCLUDED.bcninterval, freenet = EXCLUDED.freenet,
      dhcp = EXCLUDED.dhcp, paynet = EXCLUDED.paynet, qos = EXCLUDED.qos,
      first_seen = EXCLUDED.first_seen, last_seen = EXCLUDED.last_seen,
      last_update = EXCLUDED.last_update, street_address = EXCLUDED.street_address,
      location_clusters = EXCLUDED.location_clusters, imported_at = NOW()`,
    [
      data.netid,
      data.name,
      data.type,
      data.comment,
      data.ssid,
      data.trilat,
      data.trilon,
      data.encryption,
      data.channel,
      data.bcninterval,
      data.freenet,
      data.dhcp,
      data.paynet,
      data.qos,
      data.first_seen,
      data.last_seen,
      data.last_update,
      data.street_address,
      data.location_clusters,
    ]
  );
}

export async function importWigleV3Observation(
  netid: string,
  loc: any,
  ssid: string | null
): Promise<number> {
  const result = await query(
    `INSERT INTO app.wigle_v3_observations (
      netid, latitude, longitude, altitude, accuracy,
      signal, observed_at, last_update, ssid,
      frequency, channel, encryption, noise, snr, month, location
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      ST_SetSRID(ST_MakePoint($3, $2), 4326)
    ) ON CONFLICT DO NOTHING`,
    [
      netid,
      parseFloat(loc.latitude),
      parseFloat(loc.longitude),
      parseFloat(loc.alt) || null,
      parseFloat(loc.accuracy) || null,
      parseInt(loc.signal) || null,
      loc.time,
      loc.lastupdt,
      ssid,
      parseInt(loc.frequency) || null,
      parseInt(loc.channel) || null,
      loc.encryptionValue,
      parseInt(loc.noise) || null,
      parseInt(loc.snr) || null,
      loc.month,
    ]
  );
  return result.rowCount || 0;
}

export async function getWigleV3Observations(netid: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT id, netid, latitude, longitude, altitude, accuracy,
            signal, observed_at, last_update, ssid,
            frequency, channel, encryption, noise, snr, month
     FROM app.wigle_v3_observations
     WHERE netid = $1
     ORDER BY observed_at DESC`,
    [netid]
  );
  return rows;
}

async function insertWigleV2SearchResult(executor: QueryExecutor, network: any): Promise<number> {
  const result = await executor.query(
    `INSERT INTO app.wigle_v2_networks_search (
      bssid, ssid, trilat, trilong, location, firsttime, lasttime, lastupdt,
      type, encryption, channel, frequency, qos, wep, bcninterval, freenet,
      dhcp, paynet, transid, rcois, name, comment, userfound, source,
      country, region, city, road, housenumber, postalcode
    ) VALUES (
      $1, $2, $3::numeric, $4::numeric, ST_SetSRID(ST_MakePoint($5::numeric, $3::numeric), 4326),
      $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, 'wigle_api_search',
      $24, $25, $26, $27, $28, $29
    ) ON CONFLICT (bssid, trilat, trilong, lastupdt) DO NOTHING`,
    [
      network.netid || network.bssid,
      network.ssid,
      network.trilat ? parseFloat(network.trilat) : null,
      network.trilong ? parseFloat(network.trilong) : null,
      network.trilong ? parseFloat(network.trilong) : null,
      network.firsttime,
      network.lasttime,
      network.lastupdt,
      network.type || 'wifi',
      network.encryption,
      network.channel,
      network.frequency,
      network.qos || 0,
      network.wep,
      network.bcninterval,
      network.freenet,
      network.dhcp,
      network.paynet,
      network.transid,
      network.rcois,
      network.name,
      network.comment,
      network.userfound === true,
      network.country,
      network.region,
      network.city,
      network.road,
      network.housenumber,
      network.postalcode,
    ]
  );
  return result.rowCount || 0;
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
  const { rows } = await query(
    `SELECT
       nd.netid, nd.ssid, nd.type, nd.encryption, nd.channel,
       nd.trilat, nd.trilon, nd.first_seen, nd.last_seen,
       nd.street_address, nd.location_clusters,
       nd.name, nd.comment, nd.qos,
       obs.latitude  AS last_lat,
       obs.longitude AS last_lon,
       obs.observed_at AS last_observed_at
     FROM app.wigle_v3_network_details nd
     LEFT JOIN LATERAL (
       SELECT latitude, longitude, observed_at
       FROM app.wigle_v3_observations
       WHERE netid = nd.netid
       ORDER BY observed_at DESC
       LIMIT 1
     ) obs ON true
     WHERE nd.netid = $1
     LIMIT 1`,
    [netid]
  );

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
  getUserStats,
};
