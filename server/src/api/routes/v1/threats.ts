export {};
import type { Request, Response, NextFunction } from 'express';
/**
 * Threats Routes (v1)
 * Handles threat detection endpoints
 */

const express = require('express');
const router = express.Router();
const { ROUTE_CONFIG } = require('../../../config/routeConfig');
const { threatScoringService } = require('../../../config/container');
const { paginationMiddleware, validateQuery, optional } = require('../../../validation/middleware');
const {
  validateIntegerRange,
  validateNumberRange,
  validateSeverity,
} = require('../../../validation/schemas');
const logger = require('../../../logging/logger');

interface ThreatRow {
  bssid: string | null;
  ssid: string | null;
  radio_type: string | null;
  channel: number | null;
  signal_dbm: number | null;
  encryption: string | null;
  latitude: number | null;
  longitude: number | null;
  first_seen: unknown;
  last_seen: unknown;
  observations: string;
  unique_days: string;
  unique_locations: string;
  distance_range_km: string | null;
  threat_score: string | null;
  threat_level: string | null;
  rule_based_flags: {
    metrics?: unknown;
    factors?: unknown;
    flags?: unknown[];
    summary?: string;
    confidence?: string;
  } | null;
  type: string | null;
  frequency: number | null;
  network_latitude: number | null;
  network_longitude: number | null;
  total_observations: number | null;
  final_threat_score: string | null;
  final_threat_level: string | null;
}

/**
 * Validates optional threat detection query parameters.
 * @type {function}
 */
const validateThreatsQuickQuery = validateQuery({
  minObs: optional((value: unknown) => validateIntegerRange(value, 1, 100000, 'minObs')),
  minDays: optional((value: unknown) => validateIntegerRange(value, 1, 3650, 'minDays')),
  minLocs: optional((value: unknown) => validateIntegerRange(value, 1, 100000, 'minLocs')),
  minRange: optional((value: unknown) => validateNumberRange(value, 0, 10000, 'minRange')),
  minScore: optional(validateSeverity),
});

// GET /api/threats/quick - Quick threat detection
router.get(
  '/threats/quick',
  paginationMiddleware(5000),
  validateThreatsQuickQuery,
  async (req: Request, res: Response) => {
    try {
      const { page, limit, offset } = req.pagination!;
      const minTimestamp = ROUTE_CONFIG.minValidTimestamp;

      // Configurable thresholds
      const minObservations = req.validated?.minObs ?? 5;
      const minUniqueDays = req.validated?.minDays ?? 3;
      const minUniqueLocations = req.validated?.minLocs ?? 5;
      const minRangeKm = req.validated?.minRange ?? 0.5;
      const minThreatScore = req.validated?.minScore ?? 40;

      const { rows, totalCount } = await threatScoringService.getQuickThreats({
        limit,
        offset,
        minObservations,
        minUniqueDays,
        minUniqueLocations,
        minRangeKm,
        minThreatScore,
        minTimestamp,
      });

      res.json({
        threats: rows.map((row: ThreatRow) => ({
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
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Threat detection error: ${msg}`, { error });
      res.status(500).json({ error: msg });
    }
  }
);

// GET /api/threats/detect - Detailed threat analysis
router.get('/threats/detect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await threatScoringService.getDetailedThreats();

    res.json({
      ok: true,
      threats: rows.map((row: ThreatRow) => {
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
          threatScore: parseFloat(row.final_threat_score ?? '0'),
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

module.exports = router;
