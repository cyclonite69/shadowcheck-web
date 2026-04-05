export {};

const { adminQuery } = require('./adminDbService');

type ListOrphanNetworksOptions = {
  search?: string;
  limit?: number;
};

async function listOrphanNetworks(opts: ListOrphanNetworksOptions = {}): Promise<any[]> {
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 500);
  const search = String(opts.search || '').trim();
  const params: any[] = [];
  const where: string[] = [];

  if (search) {
    params.push(`%${search}%`, `%${search}%`);
    where.push(`(o.bssid ILIKE $${params.length - 1} OR o.ssid ILIKE $${params.length})`);
  }

  params.push(limit);

  const sql = `
    SELECT
      o.bssid,
      o.ssid,
      o.type,
      o.frequency,
      o.capabilities,
      o.source_device,
      o.lasttime_ms,
      o.lastlat,
      o.lastlon,
      o.bestlevel,
      o.bestlat,
      o.bestlon,
      o.unique_days,
      o.unique_locations,
      o.is_sentinel,
      o.wigle_v3_observation_count,
      o.wigle_v3_last_import_at,
      o.moved_at,
      o.move_reason
    FROM app.networks_orphans o
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY o.moved_at DESC, o.bssid ASC
    LIMIT $${params.length}
  `;

  const { rows } = await adminQuery(sql, params);
  return rows;
}

async function getOrphanNetworkCounts(): Promise<{ total: number }> {
  const { rows } = await adminQuery('SELECT COUNT(*)::int AS total FROM app.networks_orphans');
  return { total: rows[0]?.total || 0 };
}

module.exports = {
  listOrphanNetworks,
  getOrphanNetworkCounts,
};
