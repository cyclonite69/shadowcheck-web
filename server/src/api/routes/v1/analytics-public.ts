import type { Request, Response } from 'express';
import type { EnabledFlags, Filters, ValidationResult } from '../v2/filteredHelpers';
import { parseJsonParam, assertHomeExistsIfNeeded } from '../v2/filteredHelpers';

const express = require('express');
const router = express.Router();
const { filterQueryBuilder, filteredAnalyticsService } = require('../../../config/container');
const { validateFilterPayload } = filterQueryBuilder;
const { getFilteredAnalytics } = filteredAnalyticsService;

// GET /api/analytics-public/filtered
router.get('/filtered', async (req: Request, res: Response) => {
  try {
    let filters: Filters;
    let enabled: EnabledFlags;
    try {
      filters = parseJsonParam(req.query.filters as string | undefined, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled as string | undefined, {}, 'enabled');
    } catch (err) {
      const error = err as Error;
      return res.status(400).json({ ok: false, error: error.message });
    }

    const { errors }: ValidationResult = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const analytics = await getFilteredAnalytics(filters, enabled, 'geospatial');
    return res.json({
      ok: true,
      data: analytics.data,
      meta: {
        queryTime: Date.now(),
        queryDurationMs: analytics.queryDurationMs,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown analytics error';
    return res.status(500).json({ ok: false, error: message });
  }
});

module.exports = router;
