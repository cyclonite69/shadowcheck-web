/**
 * Analytics Routes (v1)
 * Modular endpoint definitions for analytics operations
 * Part of Phase 1 Modernization: Modular Architecture
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../../errors/errorHandler');
const { validateTimeRange } = require('../../../validation/schemas');
const { ValidationError } = require('../../../errors/AppError');
const analyticsService = require('../../../services/analyticsService');
const { CONFIG } = require('../../../config/database');

/**
 * GET /api/analytics/network-types
 * Get distribution of network types (WiFi, BLE, BT, LTE, GSM, etc.)
 */
router.get(
  '/network-types',
  asyncHandler(async (req, res) => {
    req.logger?.info('Retrieving network type distribution');

    const data = await analyticsService.getNetworkTypes();

    req.logger?.info('Network type distribution retrieved', {
      count: data.length,
    });

    res.json({
      ok: true,
      data,
    });
  })
);

/**
 * GET /api/analytics/signal-strength
 * Get signal strength distribution across all networks
 */
router.get(
  '/signal-strength',
  asyncHandler(async (req, res) => {
    req.logger?.info('Retrieving signal strength distribution');

    const data = await analyticsService.getSignalStrengthDistribution();

    req.logger?.info('Signal strength distribution retrieved', {
      ranges: data.length,
    });

    res.json({
      ok: true,
      data,
    });
  })
);

/**
 * GET /api/analytics/temporal-activity
 * Get hourly distribution of network activity
 */
router.get(
  '/temporal-activity',
  asyncHandler(async (req, res) => {
    req.logger?.info('Retrieving temporal activity distribution');

    const data = await analyticsService.getTemporalActivity(CONFIG.MIN_VALID_TIMESTAMP);

    req.logger?.info('Temporal activity distribution retrieved', {
      hours: data.length,
    });

    res.json({
      ok: true,
      data,
    });
  })
);

/**
 * GET /api/analytics/radio-type-over-time
 * Get radio type distribution over a time period
 *
 * Query parameters:
 * - range: '24h' | '7d' | '30d' | '90d' | 'all' (default: '30d')
 */
router.get(
  '/radio-type-over-time',
  asyncHandler(async (req, res) => {
    const range = req.query.range || '30d';

    // Validate range parameter
    const rangeValidation = validateTimeRange(range);
    if (!rangeValidation.valid) {
      throw new ValidationError('Invalid range parameter', [
        { parameter: 'range', error: rangeValidation.error },
      ]);
    }

    req.logger?.info('Retrieving radio type over time', { range });

    const data = await analyticsService.getRadioTypeOverTime(
      rangeValidation.value,
      CONFIG.MIN_VALID_TIMESTAMP
    );

    req.logger?.info('Radio type over time retrieved', {
      range,
      dataPoints: data.length,
    });

    res.json({
      ok: true,
      range: rangeValidation.value,
      data,
    });
  })
);

/**
 * GET /api/analytics/security
 * Get security protocol distribution (WPA3, WPA2, WEP, Open, etc.)
 */
router.get(
  '/security',
  asyncHandler(async (req, res) => {
    req.logger?.info('Retrieving security distribution');

    const data = await analyticsService.getSecurityDistribution();

    req.logger?.info('Security distribution retrieved', {
      types: data.length,
    });

    res.json({
      ok: true,
      data,
    });
  })
);

/**
 * GET /api/analytics/top-networks
 * Get top networks by observation count
 *
 * Query parameters:
 * - limit: Number of results (default: 100, max: 500)
 */
router.get(
  '/top-networks',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    if (isNaN(limit) || limit < 1) {
      throw new ValidationError('Invalid limit parameter', [
        { parameter: 'limit', error: 'Must be a positive integer' },
      ]);
    }

    req.logger?.info('Retrieving top networks', { limit });

    const data = await analyticsService.getTopNetworks(limit);

    req.logger?.info('Top networks retrieved', {
      count: data.length,
    });

    res.json({
      ok: true,
      limit,
      count: data.length,
      data,
    });
  })
);

/**
 * GET /api/analytics/dashboard
 * Get aggregated dashboard statistics
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    req.logger?.info('Retrieving dashboard statistics');

    const data = await analyticsService.getDashboardStats();

    req.logger?.info('Dashboard statistics retrieved');

    res.json({
      ok: true,
      data,
    });
  })
);

/**
 * GET /api/analytics/bulk
 * Get all analytics data in one request (optimized for initial page load)
 */
router.get(
  '/bulk',
  asyncHandler(async (req, res) => {
    req.logger?.info('Retrieving bulk analytics');

    const data = await analyticsService.getBulkAnalytics();

    req.logger?.info('Bulk analytics retrieved', {
      generatedAt: data.generatedAt,
    });

    res.json({
      ok: true,
      data,
    });
  })
);

/**
 * GET /api/analytics/threat-distribution
 * Get distribution of threat scores across ranges
 */
router.get(
  '/threat-distribution',
  asyncHandler(async (req, res) => {
    req.logger?.info('Retrieving threat score distribution');

    const data = await analyticsService.getThreatDistribution();

    req.logger?.info('Threat score distribution retrieved', {
      ranges: data.length,
    });

    res.json({
      ok: true,
      data,
    });
  })
);

/**
 * GET /api/analytics/threat-trends
 * Get threat score trends over time
 *
 * Query parameters:
 * - range: '24h' | '7d' | '30d' | '90d' | 'all' (default: '30d')
 */
router.get(
  '/threat-trends',
  asyncHandler(async (req, res) => {
    const range = req.query.range || '30d';

    // Validate range parameter
    const rangeValidation = validateTimeRange(range);
    if (!rangeValidation.valid) {
      throw new ValidationError('Invalid range parameter', [
        { parameter: 'range', error: rangeValidation.error },
      ]);
    }

    req.logger?.info('Retrieving threat trends', { range });

    const data = await analyticsService.getThreatTrends(
      rangeValidation.value,
      CONFIG.MIN_VALID_TIMESTAMP
    );

    req.logger?.info('Threat trends retrieved', {
      range,
      dataPoints: data.length,
    });

    res.json({
      ok: true,
      range: rangeValidation.value,
      data,
    });
  })
);

module.exports = router;
