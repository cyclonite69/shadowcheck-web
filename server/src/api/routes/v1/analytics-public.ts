import type { Request, Response } from 'express';
import {
  parseAndValidateFilters,
  isParseValidatedFiltersError,
  assertHomeExistsIfNeeded,
} from '../v2/filteredHelpers';

const express = require('express');
const router = express.Router();
const { filterQueryBuilder, filteredAnalyticsService } = require('../../../config/container');
const { validateFilterPayload } = filterQueryBuilder;
const { getFilteredAnalytics } = filteredAnalyticsService;

// GET /api/analytics-public/filtered
router.get('/filtered', async (req: Request, res: Response) => {
  try {
    const parsed = parseAndValidateFilters(req, validateFilterPayload);
    if (isParseValidatedFiltersError(parsed)) {
      return res.status(parsed.status).json(parsed.body);
    }
    const { filters, enabled } = parsed;

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
