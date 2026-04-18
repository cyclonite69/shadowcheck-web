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

      const { threats, totalCount } = await threatScoringService.getQuickThreats({
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
        threats,
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
    const threats = await threatScoringService.getDetailedThreats();

    res.json({
      ok: true,
      threats,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
