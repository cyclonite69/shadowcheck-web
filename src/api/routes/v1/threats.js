/**
 * Threats Routes (v1)
 * Handles threat detection endpoints
 */

const express = require('express');
const router = express.Router();
const { query, CONFIG } = require('../../../config/database');
const { paginationMiddleware, validateQuery, optional } = require('../../../validation/middleware');
const {
  validateIntegerRange,
  validateNumberRange,
  validateSeverity,
} = require('../../../validation/schemas');
const logger = require('../../../logging/logger');

/**
 * Validates optional threat detection query parameters.
 * @type {function}
 */
const validateThreatsQuickQuery = validateQuery({
  minObs: optional((value) => validateIntegerRange(value, 1, 100000, 'minObs')),
  minDays: optional((value) => validateIntegerRange(value, 1, 3650, 'minDays')),
  minLocs: optional((value) => validateIntegerRange(value, 1, 100000, 'minLocs')),
  minRange: optional((value) => validateNumberRange(value, 0, 10000, 'minRange')),
  minScore: optional(validateSeverity),
});

// GET /api/threats/quick - Quick threat detection
router.get(
  '/threats/quick',
  paginationMiddleware(5000),
  validateThreatsQuickQuery,
  async (req, res) => {
    try {
      const { page, limit, offset } = req.pagination;
      const minTimestamp = CONFIG.MIN_VALID_TIMESTAMP;

      // Configurable thresholds
      const minObservations = req.validated?.minObs ?? 5;
      const minUniqueDays = req.validated?.minDays ?? 3;
      const minUniqueLocations = req.validated?.minLocs ?? 5;
      const minRangeKm = req.validated?.minRange ?? 0.5;
      const minThreatScore = req.validated?.minScore ?? 40;

      const result = await query(
        `
      WITH network_patterns AS (
        SELECT 
          o.bssid,
          COUNT(DISTINCT o.id) as obs_count,
          COUNT(DISTINCT DATE(o.observed_at)) as unique_days,
          COUNT(DISTINCT ST_SnapToGrid(o.geom, 0.001)) as unique_locations,
          MAX(o.level) as max_signal,
          MIN(o.observed_at) as first_seen,
          MAX(o.observed_at) as last_seen,
          ST_Distance(
            ST_MakePoint(MIN(o.lon), MIN(o.lat))::geography,
            ST_MakePoint(MAX(o.lon), MAX(o.lat))::geography
          ) / 1000.0 as distance_range_km
        FROM public.observations o
        WHERE o.observed_at >= to_timestamp($1 / 1000.0)
        GROUP BY o.bssid
        HAVING COUNT(DISTINCT o.id) >= $4
          AND COUNT(DISTINCT DATE(o.observed_at)) >= $5
          AND COUNT(DISTINCT ST_SnapToGrid(o.geom, 0.001)) >= $6
          AND ST_Distance(
            ST_MakePoint(MIN(o.lon), MIN(o.lat))::geography,
            ST_MakePoint(MAX(o.lon), MAX(o.lat))::geography
          ) / 1000.0 >= $7
      )
      SELECT 
        np.bssid,
        n.ssid,
        n.type as radio_type,
        n.frequency as channel,
        n.bestlevel as signal_dbm,
        n.capabilities as encryption,
        n.bestlat as latitude,
        n.bestlon as longitude,
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
      LEFT JOIN public.networks n ON n.bssid = np.bssid
      WHERE (
        CASE WHEN np.unique_days >= 7 THEN 30 WHEN np.unique_days >= 3 THEN 20 ELSE 10 END +
        CASE WHEN np.distance_range_km > 1.0 THEN 40 WHEN np.distance_range_km > 0.5 THEN 25 ELSE 0 END +
        CASE WHEN np.obs_count >= 50 THEN 20 WHEN np.obs_count >= 20 THEN 10 ELSE 5 END +
        CASE WHEN np.unique_locations >= 10 THEN 15 WHEN np.unique_locations >= 5 THEN 10 ELSE 0 END
      ) >= $8
      AND (n.type NOT IN ('L', 'N', 'G') OR np.distance_range_km > 50)
      ORDER BY threat_score DESC
      LIMIT $2 OFFSET $3
    `,
        [
          minTimestamp,
          limit,
          offset,
          minObservations,
          minUniqueDays,
          minUniqueLocations,
          minRangeKm,
          minThreatScore,
        ]
      );

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

      res.json({
        threats: result.rows.map((row) => ({
          // Network identification
          bssid: row.bssid,
          ssid: row.ssid || '<Hidden>',
          radioType: row.radio_type || 'wifi',
          type: row.radio_type || 'wifi',

          // Network properties
          channel: row.channel,
          signal: row.signal_dbm,
          signalDbm: row.signal_dbm,
          maxSignal: row.max_signal,
          encryption: row.encryption,

          // Location
          latitude: row.latitude,
          longitude: row.longitude,

          // Timestamps from observations
          firstSeen: row.first_seen,
          lastSeen: row.last_seen,

          // Observations
          observations: parseInt(row.observations),
          totalObservations: parseInt(row.observations),
          uniqueDays: parseInt(row.unique_days),
          uniqueLocations: parseInt(row.unique_locations),

          // Threat metrics
          distanceRangeKm: parseFloat(row.distance_range_km).toFixed(2),
          threatScore: parseInt(row.threat_score),
          threatLevel: row.threat_score >= 70 ? 'high' : row.threat_score >= 50 ? 'medium' : 'low',
        })),
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (error) {
      logger.error(`Threat detection error: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/threats/detect - Detailed threat analysis
router.get('/threats/detect', async (req, res, next) => {
  try {
    const { rows } = await query(
      `
      WITH home_location AS (
        SELECT
          ST_X(location::geometry) as home_lon,
          ST_Y(location::geometry) as home_lat,
          location::geography as home_point
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
      ),
      network_locations AS (
        SELECT
          n.bssid,
          n.ssid,
          n.type,
          n.encryption,
          l.latitude,
          l.longitude,
          EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 AS time,
          ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography as point,
          ROW_NUMBER() OVER (PARTITION BY n.bssid ORDER BY EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000) as obs_number,
          COUNT(*) OVER (PARTITION BY n.bssid) as total_observations
        FROM app.networks n
        JOIN app.observations l ON n.bssid = l.bssid
        WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
          AND EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 >= $1
          AND (l.accuracy_meters IS NULL OR l.accuracy_meters <= 100)
      ),
      threat_analysis AS (
        SELECT
          nl.bssid,
          nl.ssid,
          nl.type,
          nl.encryption,
          nl.total_observations,
          ARRAY_AGG(
            ROUND(ST_Distance(nl.point, h.home_point)::numeric / 1000, 3)
            ORDER BY nl.time
            LIMIT 500
          ) as distances_from_home_km,
          BOOL_OR(ST_Distance(nl.point, h.home_point) < 100) as seen_at_home,
          BOOL_OR(ST_Distance(nl.point, h.home_point) > 500) as seen_away_from_home,
          MAX(ST_Distance(nl1.point, nl2.point)) / 1000 as max_distance_between_obs_km,
          MAX(nl.time) - MIN(nl.time) as observation_timespan_ms,
          COUNT(DISTINCT DATE(to_timestamp(nl.time / 1000.0))) as unique_days_observed,
          CASE
            WHEN MAX(nl.time) > MIN(nl.time) THEN
              (MAX(ST_Distance(nl1.point, nl2.point)) / 1000.0) /
              (EXTRACT(EPOCH FROM (to_timestamp(MAX(nl.time) / 1000.0) - to_timestamp(MIN(nl.time) / 1000.0))) / 3600.0)
            ELSE 0
          END as max_speed_kmh
        FROM network_locations nl
        CROSS JOIN home_location h
        LEFT JOIN network_locations nl1 ON nl.bssid = nl1.bssid
        LEFT JOIN network_locations nl2 ON nl.bssid = nl2.bssid AND nl1.obs_number < nl2.obs_number
        WHERE nl.total_observations >= 2
        GROUP BY nl.bssid, nl.ssid, nl.type, nl.encryption, nl.total_observations
      ),
      threat_classification AS (
        SELECT
          ta.*,
          nt.tag_type as user_tag,
          nt.confidence as user_confidence,
          nt.notes as user_notes,
          nt.user_override,
          COALESCE(nt.threat_score * 100, (
            CASE WHEN ta.seen_at_home AND ta.seen_away_from_home THEN 40 ELSE 0 END +
            CASE WHEN ta.max_distance_between_obs_km > 0.2 THEN 25 ELSE 0 END +
            CASE
              WHEN ta.max_speed_kmh > 100 THEN 20
              WHEN ta.max_speed_kmh > 50 THEN 15
              WHEN ta.max_speed_kmh > 20 THEN 10
              ELSE 0
            END +
            CASE
              WHEN ta.unique_days_observed >= 7 THEN 15
              WHEN ta.unique_days_observed >= 3 THEN 10
              WHEN ta.unique_days_observed >= 2 THEN 5
              ELSE 0
            END +
            CASE
              WHEN ta.total_observations >= 50 THEN 10
              WHEN ta.total_observations >= 20 THEN 5
              ELSE 0
            END
          )) as threat_score,
          CASE
            WHEN nt.tag_type = 'THREAT' THEN 'User Tagged Threat'
            WHEN nt.tag_type = 'INVESTIGATE' THEN 'User Tagged Investigate'
            WHEN nt.tag_type = 'FALSE_POSITIVE' THEN 'User Tagged False Positive'
            WHEN ta.seen_at_home AND ta.seen_away_from_home AND ta.max_speed_kmh > 20 THEN 'Mobile Tracking Device'
            WHEN ta.seen_at_home AND ta.seen_away_from_home THEN 'Potential Stalking Device'
            WHEN ta.max_distance_between_obs_km > 1 AND ta.unique_days_observed > 1 THEN 'Following Pattern Detected'
            WHEN ta.max_speed_kmh > 100 THEN 'High-Speed Vehicle Tracker'
            WHEN NOT ta.seen_at_home AND ta.max_distance_between_obs_km > 0.5 THEN 'Mobile Device (Non-Home)'
            ELSE 'Low Risk Movement'
          END as threat_type,
          COALESCE(nt.ml_confidence, (CASE
            WHEN ta.total_observations >= 10 AND ta.unique_days_observed >= 3 THEN 0.9
            WHEN ta.total_observations >= 5 THEN 0.7
            ELSE 0.4
          END)) as confidence
        FROM threat_analysis ta
        LEFT JOIN app.network_tags nt ON ta.bssid = nt.bssid
      )
      SELECT
        tc.bssid,
        tc.ssid,
        tc.type,
        tc.encryption,
        tc.total_observations,
        tc.threat_score,
        tc.threat_type,
        tc.confidence,
        tc.seen_at_home,
        tc.seen_away_from_home,
        tc.max_distance_between_obs_km,
        tc.observation_timespan_ms,
        tc.unique_days_observed,
        ROUND(tc.max_speed_kmh::numeric, 2) as max_speed_kmh,
        tc.distances_from_home_km,
        tc.user_tag,
        tc.user_confidence,
        tc.user_notes,
        tc.user_override,
        n.channel,
        n.bestlevel as signal_dbm,
        n.bestlat as network_latitude,
        n.bestlon as network_longitude
      FROM threat_classification tc
      LEFT JOIN app.networks n ON tc.bssid = n.bssid
      WHERE tc.threat_score >= 30
        AND (
          tc.type NOT IN ('G', 'L', 'N')
          OR tc.max_distance_between_obs_km > 5
        )
      ORDER BY tc.threat_score DESC, tc.total_observations DESC
    `,
      [CONFIG.MIN_VALID_TIMESTAMP]
    );

    res.json({
      ok: true,
      threats: rows.map((row) => ({
        // Network identification
        bssid: row.bssid,
        ssid: row.ssid,
        type: row.type,

        // Network properties
        encryption: row.encryption,
        channel: row.channel,
        signal: row.signal_dbm,
        signalDbm: row.signal_dbm,

        // Location
        latitude: row.network_latitude,
        longitude: row.network_longitude,

        // Observations
        totalObservations: row.total_observations,
        observations: row.total_observations,

        // Threat analysis
        threatScore: parseInt(row.threat_score),
        threatType: row.threat_type,
        threatLevel: row.threat_score >= 70 ? 'high' : row.threat_score >= 50 ? 'medium' : 'low',
        confidence: (row.confidence * 100).toFixed(0),

        // Threat patterns
        patterns: {
          seenAtHome: row.seen_at_home,
          seenAwayFromHome: row.seen_away_from_home,
          maxDistanceBetweenObsKm: parseFloat(row.max_distance_between_obs_km),
          observationTimespanMs: row.observation_timespan_ms,
          uniqueDaysObserved: row.unique_days_observed,
          maxSpeedKmh: parseFloat(row.max_speed_kmh),
          distancesFromHomeKm: row.distances_from_home_km,
        },

        // User tags
        userTag: row.user_tag,
        userConfidence: row.user_confidence,
        userNotes: row.user_notes,
        userOverride: row.user_override,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/home-location - Get current home location
router.get('/home-location', async (req, res) => {
  try {
    const result = await query(`
      SELECT latitude, longitude, radius, created_at
      FROM app.location_markers
      WHERE marker_type = 'home'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({
        latitude: 43.02345147,
        longitude: -83.69682688,
        radius: 100,
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/home-location - Set home location and radius
router.post('/admin/home-location', async (req, res) => {
  try {
    const { latitude, longitude, radius = 100 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    await query("DELETE FROM app.location_markers WHERE marker_type = 'home'");

    await query(
      `
      INSERT INTO app.location_markers (marker_type, latitude, longitude, radius, location, created_at)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($3, $2), 4326), NOW())
    `,
      ['home', latitude, longitude, radius]
    );

    res.json({
      ok: true,
      message: 'Home location saved successfully',
      latitude,
      longitude,
      radius,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
