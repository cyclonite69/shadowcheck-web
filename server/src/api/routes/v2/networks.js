const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// Map frontend sort keys to SQL columns
const SORT_MAP = {
  observed_at: 'latest_time',
  ssid: 'ssid',
  bssid: 'bssid',
  signal: 'latest_signal',
  frequency: 'frequency',
  observations: 'obs_count',
  threat_score: 'final_threat_score',
  threat_level: 'final_threat_level',
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
      where.push(
        `(obs_latest.ssid ILIKE $${params.length - 1} OR obs_latest.bssid ILIKE $${params.length})`
      );
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit, offset);

    const sql = `
      WITH obs_latest AS (
        SELECT DISTINCT ON (bssid)
          bssid,
          ssid,
          lat,
          lon,
          level as signal,
          accuracy,
          time as latest_time,
          radio_frequency as frequency,
          radio_capabilities as capabilities
        FROM app.observations
        ORDER BY bssid, time DESC
      ),
      obs_agg AS (
        SELECT
          o.bssid,
          COUNT(*) as obs_count,
          MAX(o.time) as last_seen,
          MIN(o.time) as first_seen
        FROM app.observations o
        GROUP BY o.bssid
      )
      SELECT
        obs_latest.bssid,
        obs_latest.ssid,
        obs_latest.lat,
        obs_latest.lon,
        obs_latest.signal as latest_signal,
        obs_latest.accuracy,
        obs_latest.latest_time,
        obs_latest.frequency,
        obs_latest.capabilities,
        obs_agg.obs_count,
        obs_agg.first_seen,
        obs_agg.last_seen,
        nts.final_threat_score,
        nts.final_threat_level,
        nts.model_version,
        COUNT(*) OVER() as total
      FROM obs_latest
      LEFT JOIN obs_agg ON obs_agg.bssid = obs_latest.bssid
      LEFT JOIN app.network_threat_scores nts ON nts.bssid = obs_latest.bssid
      ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    const result = await query(sql, params);
    res.json({
      total: result.rows[0]?.total || 0,
      rows: result.rows.map((row) => ({
        bssid: row.bssid,
        ssid: row.ssid || '(hidden)',
        observed_at: row.latest_time,
        signal: row.latest_signal,
        lat: row.lat,
        lon: row.lon,
        observations: parseInt(row.obs_count) || 0,
        first_seen: row.first_seen,
        last_seen: row.last_seen,
        frequency: row.frequency,
        capabilities: row.capabilities,
        accuracy_meters: row.accuracy,
        threat_score: row.final_threat_score ? parseFloat(row.final_threat_score) : 0,
        threat_level: row.final_threat_level || 'NONE',
        model_version: row.model_version || 'rule-v3.1',
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/v2/networks/:bssid', async (req, res, next) => {
  try {
    const bssid = String(req.params.bssid || '').toUpperCase();

    const [latest, timeline, threatData] = await Promise.all([
      query(
        `
        SELECT DISTINCT ON (bssid)
          bssid,
          ssid,
          lat,
          lon,
          level as signal,
          accuracy,
          time as observed_at,
          radio_frequency as frequency,
          radio_capabilities as capabilities,
          altitude
        FROM app.observations
        WHERE bssid = $1
        ORDER BY bssid, time DESC
        LIMIT 1
        `,
        [bssid]
      ),
      query(
        `
        SELECT
          DATE_TRUNC('hour', time) as bucket,
          COUNT(*) as obs_count,
          AVG(level) as avg_signal,
          MIN(level) as min_signal,
          MAX(level) as max_signal
        FROM app.observations
        WHERE bssid = $1
        GROUP BY DATE_TRUNC('hour', time)
        ORDER BY bucket DESC
        LIMIT 168
        `,
        [bssid]
      ),
      query(
        `
        SELECT
          bssid,
          final_threat_score,
          final_threat_level,
          model_version,
          ml_threat_probability,
          created_at,
          updated_at
        FROM app.network_threat_scores
        WHERE bssid = $1
        `,
        [bssid]
      ),
    ]);

    const obsCount = await query(
      'SELECT COUNT(*) as count FROM app.observations WHERE bssid = $1',
      [bssid]
    );

    const firstLast = await query(
      `
      SELECT MIN(time) as first_seen, MAX(time) as last_seen
      FROM app.observations
      WHERE bssid = $1
      `,
      [bssid]
    );

    res.json({
      latest: latest.rows[0] || null,
      timeline: timeline.rows,
      threat: threatData.rows[0] || null,
      observation_count: parseInt(obsCount.rows[0]?.count) || 0,
      first_seen: firstLast.rows[0]?.first_seen || null,
      last_seen: firstLast.rows[0]?.last_seen || null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/v2/dashboard/metrics', async (_req, res, next) => {
  try {
    const threatCounts = await query(
      `
      SELECT
        SUM(CASE WHEN nts.final_threat_level = 'CRITICAL' THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN nts.final_threat_level = 'HIGH' THEN 1 ELSE 0 END) AS high,
        SUM(CASE WHEN nts.final_threat_level = 'MED' THEN 1 ELSE 0 END) AS medium,
        SUM(CASE WHEN nts.final_threat_level IN ('LOW', 'NONE') THEN 1 ELSE 0 END) AS low
      FROM app.network_threat_scores nts
      WHERE nts.final_threat_level IS NOT NULL
      `
    );

    const counts = await query(
      `
      SELECT
        (SELECT COUNT(DISTINCT bssid) FROM app.observations) as total_networks,
        (SELECT COUNT(*) FROM app.observations) as observations
      `
    );

    res.json({
      networks: {
        total: parseInt(counts.rows[0]?.total_networks) || 0,
        hidden: 0,
        wifi: parseInt(counts.rows[0]?.total_networks) || 0,
      },
      threats: {
        critical: parseInt(threatCounts.rows[0]?.critical) || 0,
        high: parseInt(threatCounts.rows[0]?.high) || 0,
        medium: parseInt(threatCounts.rows[0]?.medium) || 0,
        low: parseInt(threatCounts.rows[0]?.low) || 0,
      },
      observations: parseInt(counts.rows[0]?.observations) || 0,
      ssid_history: 0,
      enriched: null,
      surveillance: null,
    });
  } catch (err) {
    next(err);
  }
});

// Threat + observation map payload
router.get('/v2/threats/map', async (req, res, next) => {
  try {
    const severity = (req.query.severity || '').toLowerCase();
    const allowedSeverities = ['critical', 'high', 'med', 'low', 'none'];
    const severityFilter =
      severity && allowedSeverities.includes(severity) ? 'AND nts.final_threat_level = $1' : '';
    const params = severityFilter ? [severity.toUpperCase()] : [];

    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 180);
    params.push(days);

    const threatsSql = `
      SELECT
        ne.bssid,
        ne.ssid,
        LOWER(ne.threat->>'level') AS severity,
        (ne.threat->>'score')::numeric AS threat_score,
        ne.first_seen,
        ne.last_seen,
        ne.lat,
        ne.lon,
        ne.observations AS observation_count
      FROM app.api_network_explorer_mv ne
      WHERE ne.threat->>'level' IS NOT NULL
        AND ne.threat->>'level' != 'NONE'
        ${severityFilter ? "AND ne.threat->>'level' = $1" : ''}
      ORDER BY (ne.threat->>'score')::numeric DESC
      LIMIT 5000
    `;

    const observationsSql = `
      SELECT
        o.bssid,
        o.lat,
        o.lon,
        o.time as observed_at,
        o.level AS rssi,
        LOWER(ne.threat->>'level') AS severity
      FROM app.observations o
      JOIN app.api_network_explorer_mv ne ON ne.bssid = o.bssid
      WHERE ne.threat->>'level' IS NOT NULL
        AND ne.threat->>'level' != 'NONE'
        AND o.time >= NOW() - ($${params.length} || ' days')::interval
        ${severityFilter ? "AND ne.threat->>'level' = $1" : ''}
      LIMIT 100000
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
        model_version: 'rule-v3.1',
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
