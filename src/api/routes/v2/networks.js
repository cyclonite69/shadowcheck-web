const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// Map frontend sort keys to SQL columns
const SORT_MAP = {
  observed_at: 'ml.observed_at',
  ssid: 'ml.ssid',
  bssid: 'ml.bssid',
  signal: 'ml.level',
  frequency: 'sn.frequency',
  observations: 'COALESCE(ap.total_observations, 0)',
};

router.get('/v2/networks', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const sort = (req.query.sort || 'observed_at').toLowerCase();
    const order = (req.query.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const sortColumn = SORT_MAP[sort] || SORT_MAP.observed_at;

    const params = [];
    const where = [];
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      where.push(`(ml.ssid ILIKE $${params.length - 1} OR ml.bssid ILIKE $${params.length})`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
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
      ORDER BY ${sortColumn} ${order}
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

router.get('/v2/networks/:bssid', async (req, res, next) => {
  try {
    const bssid = String(req.params.bssid || '').toLowerCase();
    const [latest, timeline, ssidHistory] = await Promise.all([
      query(
        `
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
        WHERE ml.bssid = $1
        LIMIT 1
        `,
        [bssid]
      ),
      query(
        `
        SELECT bucket, obs_count, avg_level, min_level, max_level
        FROM mv_network_timeline
        WHERE bssid = $1
        ORDER BY bucket ASC
        `,
        [bssid]
      ),
      query(
        `
        SELECT ssid, first_seen, last_seen
        FROM ssid_history
        WHERE bssid = $1
        ORDER BY last_seen DESC
        `,
        [bssid]
      ),
    ]);

    res.json({
      latest: latest.rows[0] || null,
      timeline: timeline.rows,
      ssid_history: ssidHistory.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/v2/dashboard/metrics', async (_req, res, next) => {
  try {
    const counts = await query(
      `
      SELECT
        (SELECT COUNT(*) FROM access_points) AS total_networks,
        (SELECT COUNT(*) FROM observations) AS observations,
        (SELECT COUNT(*) FROM ssid_history) AS ssid_history,
        (SELECT COUNT(*) FROM access_points WHERE is_hidden) AS hidden_networks
      `
    );
    const threatCounts = await query(
      `
      SELECT
        SUM(CASE WHEN level >= -50 THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN level BETWEEN -70 AND -51 THEN 1 ELSE 0 END) AS high,
        SUM(CASE WHEN level BETWEEN -80 AND -71 THEN 1 ELSE 0 END) AS medium,
        SUM(CASE WHEN level < -80 THEN 1 ELSE 0 END) AS low
      FROM mv_network_latest
      `
    );
    res.json({
      networks: {
        total: Number(counts.rows[0]?.total_networks || 0),
        hidden: Number(counts.rows[0]?.hidden_networks || 0),
        wifi: Number(counts.rows[0]?.total_networks || 0),
      },
      threats: {
        critical: Number(threatCounts.rows[0]?.critical || 0),
        high: Number(threatCounts.rows[0]?.high || 0),
        medium: Number(threatCounts.rows[0]?.medium || 0),
        low: Number(threatCounts.rows[0]?.low || 0),
      },
      observations: Number(counts.rows[0]?.observations || 0),
      ssid_history: Number(counts.rows[0]?.ssid_history || 0),
      enriched: null,
      surveillance: null,
    });
  } catch (err) {
    next(err);
  }
});

// Threat + observation map payload for Kepler
router.get('/v2/threats/map', async (req, res, next) => {
  try {
    const severity = (req.query.severity || '').toLowerCase();
    const allowedSeverities = ['critical', 'high', 'medium', 'low'];
    const severityFilter =
      severity && allowedSeverities.includes(severity) ? 'AND t.threat_level = $1' : '';
    const params = severityFilter ? [severity] : [];

    // Limit observations window to avoid huge payloads (default 30d, configurable)
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 180);
    params.push(days);

    const threatsSql = `
      SELECT
        t.bssid,
        COALESCE(t.ssid, '(hidden)') AS ssid,
        LOWER(COALESCE(t.threat_level, 'low')) AS severity,
        t.threat_score,
        t.first_seen,
        t.last_seen,
        t.lat,
        t.lon,
        t.observation_count
      FROM access_points t
      WHERE t.threat_level IS NOT NULL
        ${severityFilter}
      ORDER BY COALESCE(t.threat_score, 0) DESC
      LIMIT 5000
    `;

    const observationsSql = `
      SELECT
        o.bssid,
        o.lat,
        o.lon,
        o.observed_at,
        o.level AS rssi,
        o.device_code,
        LOWER(ap.threat_level) AS severity
      FROM observations o
      JOIN access_points ap ON ap.bssid = o.bssid
      WHERE ap.threat_level IS NOT NULL
        AND o.observed_at >= NOW() - ($${params.length} || ' days')::interval
        ${severityFilter ? 'AND ap.threat_level = $1' : ''}
      LIMIT 500000
    `;

    const [threats, observations] = await Promise.all([
      query(threatsSql, params),
      query(observationsSql, params),
    ]);

    res.json({
      threats: threats.rows,
      observations: observations.rows,
      meta: {
        severity: severityFilter ? severity : 'all',
        days,
        threat_count: threats.rowCount,
        observation_count: observations.rowCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
