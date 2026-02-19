/**
 * Network Service Layer
 * Encapsulates database queries for network operations
 */

const { query } = require('../config/database');
const logger = require('../logging/logger');

export async function getHomeLocation(): Promise<{ lat: number; lon: number } | null> {
  try {
    const result = await query(
      "SELECT latitude, longitude FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
    );
    if (result.rows.length > 0) {
      const { latitude, longitude } = result.rows[0];
      if (latitude !== null && longitude !== null) {
        return { lat: parseFloat(latitude), lon: parseFloat(longitude) };
      }
    }
    return null;
  } catch (err: any) {
    logger.warn('Could not fetch home location:', err.message);
    return null;
  }
}

export async function getNetworkCount(
  conditions: string[],
  params: unknown[],
  joins: string[]
): Promise<number> {
  const totalCountQuery = `
    SELECT COUNT(DISTINCT ne.bssid) AS total
    FROM app.network_entries ne
    ${joins.join('\n')}
    ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
  `;

  const totalResult = await query(totalCountQuery, params);
  return parseInt(totalResult.rows[0]?.total || '0', 10);
}

export async function listNetworks(
  selectColumns: string[],
  joins: string[],
  conditions: string[],
  params: unknown[],
  sortClauses: string,
  limit: number,
  offset: number,
  paramIndex: number
): Promise<any[]> {
  const dataQuery = `
    SELECT
      ${selectColumns.join(',\n')}
    FROM app.network_entries ne
    ${joins.join('\n')}
    ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
    ORDER BY ${sortClauses}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataParams = [...params, limit, offset];
  const dataResult = await query(dataQuery, dataParams);
  return dataResult.rows.map((row: any) => {
    const typedRow = { ...row };
    if (row.type === '?') {
      typedRow.type = null;
    }
    return typedRow;
  });
}

export async function explainQuery(
  selectColumns: string[],
  joins: string[],
  conditions: string[],
  params: unknown[],
  sortClauses: string,
  limit: number,
  offset: number,
  paramIndex: number
): Promise<any> {
  const dataQuery = `
    SELECT
      ${selectColumns.join(',\n')}
    FROM app.network_entries ne
    ${joins.join('\n')}
    ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
    ORDER BY ${sortClauses}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataParams = [...params, limit, offset];
  const explained = await query(`EXPLAIN (FORMAT JSON) ${dataQuery}`, dataParams);
  return explained.rows;
}

export async function searchNetworksBySSID(searchPattern: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT n.unified_id, n.ssid, n.bssid, n.type, n.encryption, n.bestlevel as signal, n.lasttime,
            COUNT(DISTINCT l.unified_id) as observation_count
     FROM app.networks n
     LEFT JOIN app.observations l ON n.bssid = l.bssid
     WHERE n.ssid ILIKE $1
     GROUP BY n.unified_id, n.ssid, n.bssid, n.type, n.encryption, n.bestlevel, n.lasttime
     ORDER BY observation_count DESC LIMIT 50`,
    [searchPattern]
  );
  return rows;
}

export async function getManufacturerByBSSID(prefix: string): Promise<any | null> {
  const { rows } = await query(
    `SELECT oui_prefix_24bit as prefix, organization_name as manufacturer, organization_address as address
     FROM app.radio_manufacturers WHERE oui_prefix_24bit = $1 LIMIT 1`,
    [prefix]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getTaggedNetworks(
  tagType: string,
  limit: number,
  offset: number
): Promise<{ rows: any[]; totalCount: number }> {
  const { rows } = await query(
    `SELECT t.bssid, n.ssid, t.tag_type, t.confidence, t.notes, t.tagged_at, t.updated_at,
            COUNT(*) OVER() as total_count
     FROM app.network_tags t
     LEFT JOIN app.networks n ON t.bssid = n.bssid
     WHERE t.tag_type = $1
     ORDER BY t.updated_at DESC LIMIT $2 OFFSET $3`,
    [tagType, limit, offset]
  );

  const totalCount = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
  return { rows, totalCount };
}

export async function checkNetworkExists(bssid: string): Promise<boolean> {
  const result = await query(`SELECT ssid FROM app.networks WHERE bssid = $1 LIMIT 1`, [bssid]);
  return result.rowCount > 0;
}

export async function deleteNetworkTag(bssid: string): Promise<void> {
  await query(`DELETE FROM app.network_tags WHERE bssid = $1`, [bssid]);
}

export async function insertNetworkTag(
  bssid: string,
  tagType: string,
  confidence: number,
  notes: string | null
): Promise<any> {
  const result = await query(
    `INSERT INTO app.network_tags (bssid, tag_type, confidence, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING bssid, tag_type, confidence, threat_score, ml_confidence`,
    [bssid, tagType, confidence, notes]
  );
  return result.rows[0];
}

export async function deleteNetworkTagReturning(bssid: string): Promise<number> {
  const result = await query(`DELETE FROM app.network_tags WHERE bssid = $1 RETURNING bssid`, [
    bssid,
  ]);
  return result.rowCount || 0;
}

export async function upsertThreatTag(bssid: string, notes: string): Promise<any> {
  const result = await query(
    `INSERT INTO app.network_tags (bssid, tag_type, confidence, threat_score, notes)
     VALUES ($1, 'THREAT', 0.9, 0.8, $2)
     ON CONFLICT (bssid) DO UPDATE SET
       tag_type = 'THREAT', confidence = 0.9, threat_score = 0.8, notes = $2
     RETURNING bssid, tag_type, confidence, threat_score`,
    [bssid, notes]
  );
  return result.rows[0];
}

export async function getNetworkTagByBssid(bssid: string): Promise<any | null> {
  const result = await query(
    `SELECT bssid, is_ignored, ignore_reason, threat_tag, threat_confidence, notes,
            wigle_lookup_requested, wigle_lookup_at, wigle_result, created_at, updated_at, tag_history
     FROM app.network_tags WHERE bssid = $1`,
    [bssid]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function listNetworkTags(
  whereClauses: string[],
  params: any[],
  limit: number,
  offset: number
): Promise<{ rows: any[]; totalCount: number }> {
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  params.push(limit, offset);

  const result = await query(
    `SELECT nt.*, n.ssid, n.type as network_type, n.frequency, n.bestlevel as signal_dbm,
            n.bestlat as latitude, n.bestlon as longitude, COUNT(*) OVER() as total_count
     FROM app.network_tags nt
     LEFT JOIN app.networks n ON nt.bssid = n.bssid
     ${whereClause}
     ORDER BY nt.updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
  return { rows: result.rows, totalCount };
}

export async function getManualThreatTags(): Promise<any[]> {
  const result = await query(
    `SELECT bssid, threat_tag, threat_confidence, notes
     FROM app.network_tags 
     WHERE threat_tag IS NOT NULL`
  );
  return result.rows;
}

module.exports = {
  getHomeLocation,
  getNetworkCount,
  listNetworks,
  explainQuery,
  searchNetworksBySSID,
  getManufacturerByBSSID,
  getTaggedNetworks,
  checkNetworkExists,
  deleteNetworkTag,
  insertNetworkTag,
  deleteNetworkTagReturning,
  upsertThreatTag,
  getNetworkTagByBssid,
  listNetworkTags,
  getManualThreatTags,
};
