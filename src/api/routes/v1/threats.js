const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// Simple threat detection based on observation patterns
router.get('/quick', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await query(`
      WITH network_patterns AS (
        SELECT 
          o.bssid,
          COUNT(DISTINCT o.id) as obs_count,
          COUNT(DISTINCT DATE(o.observed_at)) as unique_days,
          COUNT(DISTINCT ST_SnapToGrid(o.location::geometry, 0.001)) as unique_locations,
          MAX(o.signal_dbm) as max_signal,
          MIN(o.observed_at) as first_seen,
          MAX(o.observed_at) as last_seen,
          ST_Distance(
            ST_MakePoint(MIN(o.longitude), MIN(o.latitude))::geography,
            ST_MakePoint(MAX(o.longitude), MAX(o.latitude))::geography
          ) / 1000.0 as distance_range_km
        FROM app.observations o
        WHERE o.observed_at >= NOW() - INTERVAL '30 days'
        GROUP BY o.bssid
        HAVING COUNT(DISTINCT o.id) >= 5
      )
      SELECT 
        np.bssid,
        n.ssid,
        n.type as radio_type,
        np.obs_count as observations,
        np.unique_days,
        np.unique_locations,
        np.max_signal,
        np.first_seen,
        np.last_seen,
        np.distance_range_km,
        (
          CASE WHEN np.unique_days >= 7 THEN 30 WHEN np.unique_days >= 3 THEN 20 ELSE 10 END +
          CASE WHEN np.distance_range_km > 1.0 THEN 40 WHEN np.distance_range_km > 0.5 THEN 25 ELSE 0 END +
          CASE WHEN np.obs_count >= 50 THEN 20 WHEN np.obs_count >= 20 THEN 10 ELSE 5 END +
          CASE WHEN np.unique_locations >= 10 THEN 15 WHEN np.unique_locations >= 5 THEN 10 ELSE 0 END
        ) as threat_score,
        COUNT(*) OVER() as total_count
      FROM network_patterns np
      LEFT JOIN app.networks n ON n.bssid = np.bssid
      WHERE (
        CASE WHEN np.unique_days >= 7 THEN 30 WHEN np.unique_days >= 3 THEN 20 ELSE 10 END +
        CASE WHEN np.distance_range_km > 1.0 THEN 40 WHEN np.distance_range_km > 0.5 THEN 25 ELSE 0 END +
        CASE WHEN np.obs_count >= 50 THEN 20 WHEN np.obs_count >= 20 THEN 10 ELSE 5 END +
        CASE WHEN np.unique_locations >= 10 THEN 15 WHEN np.unique_locations >= 5 THEN 10 ELSE 0 END
      ) >= 40
      ORDER BY threat_score DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    res.json({
      threats: result.rows.map(row => ({
        bssid: row.bssid,
        ssid: row.ssid || '<Hidden>',
        radioType: row.radio_type || 'wifi',
        observations: parseInt(row.observations),
        uniqueDays: parseInt(row.unique_days),
        uniqueLocations: parseInt(row.unique_locations),
        maxSignal: row.max_signal,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        distanceRangeKm: parseFloat(row.distance_range_km).toFixed(2),
        threatScore: parseInt(row.threat_score),
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Threat detection error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
