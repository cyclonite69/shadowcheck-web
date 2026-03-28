/**
 * Network List Service Layer
 * Paginated network listing by manufacturer OUI and SSID search.
 */

const { query } = require('../config/database');
const { searchNetworksBySSID } = require('./networking/repository');

const SORT_MAP: Record<string, string> = {
  last_seen: 'n.lasttime DESC',
  ssid: 'n.ssid ASC',
  obs_count: 'observation_count DESC',
  signal: 'n.bestlevel DESC',
  bssid: 'n.bssid ASC',
};

export async function listByManufacturer(
  manufacturerOui: string,
  limit: number | null,
  offset: number | null,
  sort?: string
): Promise<{ rows: any[]; total: number }> {
  const ouiPrefix = manufacturerOui.replace(/:/g, '').substring(0, 6).toUpperCase();
  const sortClause = SORT_MAP[sort ?? ''] ?? SORT_MAP.last_seen;
  const likePattern = `${ouiPrefix}%`;

  const params: any[] = [likePattern];
  let sql = `SELECT n.unified_id, n.ssid, n.bssid, n.type, n.encryption,
                    n.bestlevel AS signal, n.lasttime,
                    n.bestlat AS latitude, n.bestlon AS longitude,
                    COUNT(DISTINCT l.unified_id) AS observation_count
             FROM app.networks n
             LEFT JOIN app.observations l ON n.bssid = l.bssid
             WHERE REPLACE(n.bssid, ':', '') ILIKE $1
             GROUP BY n.unified_id, n.ssid, n.bssid, n.type, n.encryption,
                      n.bestlevel, n.lasttime, n.bestlat, n.bestlon
             ORDER BY ${sortClause}`;

  if (limit !== null && limit !== undefined) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  if (offset !== null && offset !== undefined) {
    params.push(offset);
    sql += ` OFFSET $${params.length}`;
  }

  const [{ rows }, countResult] = await Promise.all([
    query(sql, params),
    query(
      `SELECT COUNT(DISTINCT n.bssid) AS total FROM app.networks n
       WHERE REPLACE(n.bssid, ':', '') ILIKE $1`,
      [likePattern]
    ),
  ]);

  return { rows, total: parseInt(countResult.rows[0]?.total || '0', 10) };
}

export async function searchNetworks(
  searchPattern: string,
  limit: number | null,
  offset: number | null
): Promise<{ rows: any[]; total: number }> {
  return searchNetworksBySSID(searchPattern, limit, offset) as Promise<{
    rows: any[];
    total: number;
  }>;
}

module.exports = { listByManufacturer, searchNetworks };
