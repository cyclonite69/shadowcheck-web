/**
 * Network List Service Layer
 * Paginated network listing by manufacturer OUI and SSID search with pagination.
 */

const { query } = require('../config/database');

const SORT_MAP: Record<string, string> = {
  last_seen: 'n.lasttime DESC',
  ssid: 'n.ssid ASC',
  obs_count: 'observation_count DESC',
  signal: 'n.bestlevel DESC',
  bssid: 'n.bssid ASC',
};

/**
 * List all networks belonging to a given OUI/manufacturer prefix with pagination.
 *
 * @param manufacturerOui  6-char hex OUI prefix (e.g. 'AABBCC') – colons stripped internally
 */
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

/**
 * Paginated SSID search across app.networks.
 *
 * @param searchPattern  Already-escaped ILIKE pattern (e.g. '%home%')
 */
export async function searchNetworks(
  searchPattern: string,
  limit: number | null,
  offset: number | null
): Promise<{ rows: any[]; total: number }> {
  const params: any[] = [searchPattern];
  let sql = `SELECT n.unified_id, n.ssid, n.bssid, n.type, n.encryption,
                    n.bestlevel AS signal, n.lasttime,
                    COUNT(DISTINCT l.unified_id) AS observation_count
             FROM app.networks n
             LEFT JOIN app.observations l ON n.bssid = l.bssid
             WHERE n.ssid ILIKE $1
             GROUP BY n.unified_id, n.ssid, n.bssid, n.type, n.encryption,
                      n.bestlevel, n.lasttime
             ORDER BY observation_count DESC`;

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
    query(`SELECT COUNT(DISTINCT n.bssid) AS total FROM app.networks n WHERE n.ssid ILIKE $1`, [
      searchPattern,
    ]),
  ]);

  return { rows, total: parseInt(countResult.rows[0]?.total || '0', 10) };
}

module.exports = { listByManufacturer, searchNetworks };
