/**
 * Threats Routes (v2)
 * Handles threat detection endpoints
 */

import type { Request, Response } from 'express';

const express = require('express');
const router = express.Router();
const { v2Service } = require('../../../config/container');
const logger = require('../../../logging/logger');

/**
 * GET /api/v2/threats/severity-counts
 * Returns the count of networks by threat severity.
 * Respects current filters including threat level filtering.
 */
router.get('/threats/severity-counts', async (req: Request, res: Response) => {
  try {
    const filtersParam = req.query.filters as string | undefined;
    const enabledParam = req.query.enabled as string | undefined;

    let filters: { threatCategories?: string[] } = {};
    let enabled: { threatCategories?: boolean } = {};

    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch (_e) {
        logger.warn('Invalid filters parameter:', filtersParam);
      }
    }

    if (enabledParam) {
      try {
        enabled = JSON.parse(enabledParam);
      } catch (_e) {
        logger.warn('Invalid enabled parameter:', enabledParam);
      }
    }

    const counts = await v2Service.getThreatSeverityCounts(filters, enabled);
    res.json({ counts });
  } catch (error) {
    const err = error as Error;
    logger.error(`Threat severity counts error: ${err.message}`, { error });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
