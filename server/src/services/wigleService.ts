/**
 * WiGLE Service Layer
 * Encapsulates database queries for WiGLE operations
 */

const { query } = require('../config/database');

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
  const queryParams: any[] = [];
  let searchQuery: string;

  if (params.bssid) {
    searchQuery = `SELECT bssid, ssid, encryption, trilat, trilong, lasttime
                   FROM app.wigle_v2_networks_search WHERE bssid ILIKE $1 ORDER BY lasttime DESC`;
    queryParams.push(`%${params.bssid}%`);
  } else {
    searchQuery = `SELECT bssid, ssid, encryption, trilat, trilong, lasttime
                   FROM app.wigle_v2_networks_search WHERE ssid ILIKE $1 ORDER BY lasttime DESC`;
    queryParams.push(`%${params.ssid}%`);
  }

  if (params.limit !== null) {
    queryParams.push(params.limit);
    searchQuery += ` LIMIT $${queryParams.length}`;
  }

  const { rows } = await query(searchQuery, queryParams);
  return rows;
}

export async function getWigleV2Networks(params: {
  limit: number | null;
  offset: number | null;
  type?: string;
  whereClauses: string[];
  queryParams: any[];
}): Promise<any[]> {
  const whereSql =
    params.whereClauses.length > 0 ? `WHERE ${params.whereClauses.join(' AND ')}` : '';
  const paginationClauses: string[] = [];
  const allParams = [...params.queryParams];

  if (params.limit !== null) {
    allParams.push(params.limit);
    paginationClauses.push(`LIMIT $${allParams.length}`);
  }
  if (params.offset !== null) {
    allParams.push(params.offset);
    paginationClauses.push(`OFFSET $${allParams.length}`);
  }

  const paginationSql = paginationClauses.join(' ');
  const dataQuery = `SELECT bssid, ssid, encryption, trilat, trilong, lasttime, type
                     FROM app.wigle_v2_networks_search ${whereSql} ORDER BY lasttime DESC ${paginationSql}`;
  const { rows } = await query(dataQuery, allParams);
  return rows;
}

export async function getWigleV2NetworksCount(
  whereClauses: string[],
  queryParams: any[]
): Promise<number> {
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countQuery = `SELECT COUNT(*) as total FROM app.wigle_v2_networks_search ${whereSql}`;
  const countResult = await query(countQuery, queryParams);
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
  const whereSql =
    params.whereClauses && params.whereClauses.length > 0
      ? `WHERE ${params.whereClauses.join(' AND ')}`
      : '';
  const paginationClauses: string[] = [];
  const allParams = params.queryParams ? [...params.queryParams] : [];

  if (params.limit !== null) {
    allParams.push(params.limit);
    paginationClauses.push(`LIMIT $${allParams.length}`);
  }
  if (params.offset !== null) {
    allParams.push(params.offset);
    paginationClauses.push(`OFFSET $${allParams.length}`);
  }

  const paginationSql = paginationClauses.join(' ');
  const dataQuery = `SELECT netid, ssid, encryption, latitude, longitude, observed_at
                    FROM app.wigle_v3_observations ${whereSql} ORDER BY observed_at DESC ${paginationSql}`;
  const { rows } = await query(dataQuery, allParams);
  return rows;
}

export async function getWigleV3NetworksCount(
  whereClauses: string[] = [],
  queryParams: any[] = []
): Promise<number> {
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countQuery = `SELECT COUNT(*) as total FROM app.wigle_v3_observations ${whereSql}`;
  const countResult = await query(countQuery, queryParams);
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

export async function importWigleV2SearchResult(network: any): Promise<number> {
  const result = await query(
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
};
