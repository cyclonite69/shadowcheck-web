const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// Basic input guards
function parseIntParam(value, defaultValue, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) {
    return defaultValue;
  }
  return max ? Math.min(n, max) : n;
}

// GET /api/explorer/networks
// Returns latest snapshot per BSSID from mv_network_latest + metadata
router.get('/explorer/networks', async (req, res, next) => {
  try {
    const limit = parseIntParam(req.query.limit, 500, 5000);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const sort = (req.query.sort || 'observed_at').toLowerCase();
    const order = (req.query.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sortMap = {
      observed_at: 'ml.observed_at',
      last_seen: 'ml.observed_at',
      ssid: 'ml.ssid',
      bssid: 'ml.bssid',
      signal: 'ml.level',
      frequency: 'sn.frequency',
      observations: 'COALESCE(ap.total_observations, 0)',
    };
    const sortColumn = sortMap[sort] || sortMap.observed_at;

    const params = [];
    const where = [];
    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      where.push(`(ml.ssid ILIKE $${params.length - 1} OR ml.bssid ILIKE $${params.length})`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${sortColumn} ${order}`;
    params.push(limit, offset);

    const sql = `
      WITH base AS (
        SELECT
          ml.bssid,
          COALESCE(NULLIF(ml.ssid, ''), ap.latest_ssid) AS ssid,
          ml.device_id,
          ml.source_tag,
          ml.observed_at,
          ml.level,
          ml.lat,
          ml.lon,
          ml.external,
          COALESCE(ap.total_observations, 0) AS observations,
          ap.first_seen,
          ap.last_seen,
          ap.is_5ghz,
          ap.is_6ghz,
          ap.is_hidden,
          sn.type,
          sn.frequency,
          sn.capabilities
        FROM mv_network_latest ml
        LEFT JOIN access_points ap ON ap.bssid = ml.bssid
        LEFT JOIN LATERAL (
          SELECT type, frequency, capabilities
          FROM staging_networks s
          WHERE s.bssid = ml.bssid
          ORDER BY s.lasttime DESC
          LIMIT 1
        ) sn ON true
        ${whereClause}
      )
      SELECT
        *,
        COUNT(*) OVER() AS total
      FROM base
      ${orderClause}
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    const result = await query(sql, params);
    res.json({
      total: result.rows[0]?.total || 0,
      rows: result.rows.map((row) => ({
        bssid: row.bssid,
        ssid: row.ssid || '(hidden)',
        device_id: row.device_id,
        source_tag: row.source_tag,
        observed_at: row.observed_at,
        signal: row.level,
        lat: row.lat,
        lon: row.lon,
        external: row.external,
        observations: row.observations,
        first_seen: row.first_seen,
        last_seen: row.last_seen,
        is_5ghz: row.is_5ghz,
        is_6ghz: row.is_6ghz,
        is_hidden: row.is_hidden,
        type: row.type || 'W',
        frequency: row.frequency,
        capabilities: row.capabilities,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/explorer/timeline/:bssid
router.get('/explorer/timeline/:bssid', async (req, res, next) => {
  try {
    const bssid = String(req.params.bssid || '').toLowerCase();
    const data = await query(
      `
        SELECT bucket, obs_count, avg_level, min_level, max_level
        FROM mv_network_timeline
        WHERE bssid = $1
        ORDER BY bucket ASC
      `,
      [bssid]
    );
    res.json(data.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/explorer/heatmap
router.get('/explorer/heatmap', async (_req, res, next) => {
  try {
    const data = await query(
      `
        SELECT
          ST_AsGeoJSON(tile_geom)::json AS geometry,
          obs_count,
          avg_level,
          min_level,
          max_level,
          first_seen,
          last_seen
        FROM mv_heatmap_tiles
      `
    );
    res.json(data.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/explorer/routes
router.get('/explorer/routes', async (_req, res, next) => {
  try {
    const data = await query(
      `
        SELECT
          device_id,
          point_count,
          start_at,
          end_at,
          ST_AsGeoJSON(route_geom)::json AS geometry
        FROM mv_device_routes
      `
    );
    res.json(data.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
