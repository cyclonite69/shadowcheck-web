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
      SELECT
        ne.bssid,
        ne.ssid,
        ne.type as radio_type,
        ne.frequency as channel,
        ne.signal as signal_dbm,
        ne.security as encryption,
        ne.lat as latitude,
        ne.lon as longitude,
        ne.observations,
        ne.unique_days,
        ne.unique_locations,
        ne.first_seen,
        ne.last_seen,
        (ne.max_distance_meters / 1000.0) as distance_range_km,
        COALESCE(nts.final_threat_score, 0) as threat_score,
        COALESCE(nts.final_threat_level, 'NONE') as threat_level,
        COUNT(*) OVER() as total_count
      FROM app.api_network_explorer_mv ne
      LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
      WHERE ne.last_seen >= to_timestamp($1 / 1000.0)
        AND ne.observations >= $4
        AND ne.unique_days >= $5
        AND ne.unique_locations >= $6
        AND (ne.max_distance_meters / 1000.0) >= $7
        AND COALESCE(nts.final_threat_score, 0) >= $8
        AND (ne.type NOT IN ('L', 'N', 'G') OR ne.max_distance_meters > 50000)
      ORDER BY COALESCE(nts.final_threat_score, 0) DESC
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
          maxSignal: row.signal_dbm,
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
          distanceRangeKm:
            row.distance_range_km !== null ? parseFloat(row.distance_range_km).toFixed(2) : null,
          threatScore: row.threat_score !== null ? parseFloat(row.threat_score) : 0,
          threatLevel: String(row.threat_level || 'NONE').toLowerCase(),
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
      SELECT
        ne.bssid,
        ne.ssid,
        ne.type,
        ne.security as encryption,
        ne.frequency,
        ne.signal as signal_dbm,
        ne.lat as network_latitude,
        ne.lon as network_longitude,
        ne.observations as total_observations,
        nts.final_threat_score,
        nts.final_threat_level,
        nts.rule_based_flags
      FROM app.api_network_explorer_mv ne
      LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
      WHERE COALESCE(nts.final_threat_score, 0) >= 30
        AND (
          ne.type NOT IN ('G', 'L', 'N')
          OR ne.max_distance_meters > 5000
        )
      ORDER BY COALESCE(nts.final_threat_score, 0) DESC, ne.observations DESC
    `
    );

    res.json({
      ok: true,
      threats: rows.map((row) => {
        const details = row.rule_based_flags || {};
        const metrics = details.metrics || {};
        const factors = details.factors || {};
        const flags = details.flags || [];
        const confidence =
          details.confidence !== undefined
            ? (parseFloat(details.confidence) * 100).toFixed(0)
            : null;

        return {
          // Network identification
          bssid: row.bssid,
          ssid: row.ssid,
          type: row.type,

          // Network properties
          encryption: row.encryption,
          channel: row.frequency,
          signal: row.signal_dbm,
          signalDbm: row.signal_dbm,

          // Location
          latitude: row.network_latitude,
          longitude: row.network_longitude,

          // Observations
          totalObservations: row.total_observations,
          observations: row.total_observations,

          // Threat analysis
          threatScore: parseFloat(row.final_threat_score || 0),
          threatType: details.summary || 'Unified threat score',
          threatLevel: String(row.final_threat_level || 'NONE').toLowerCase(),
          confidence: confidence,

          // Threat patterns
          patterns: {
            metrics,
            factors,
            flags,
          },
        };
      }),
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
