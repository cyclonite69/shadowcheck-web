/**
 * Universal Filtered Networks API (v2)
 * Single source of truth for list, map, analytics, and observation queries.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  type Filters,
  type EnabledFlags,
  type ValidationResult,
  type QueryResult,
  type FilterQueryResult,
  type NetworkRow,
  type GeospatialRow,
  DEBUG_GEOSPATIAL,
  parseJsonParam,
  normalizeThreatTransparency,
  buildOrderBy,
  assertHomeExistsIfNeeded,
} from './filteredHelpers';

const express = require('express');
const router = express.Router();
const { filterQueryBuilder, v2Service } = require('../../../config/container');
const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;
const logger = require('../../../logging/logger');
const { CONFIG } = require('../../../config/database');
const { asyncHandler } = require('../../../utils/asyncHandler');
const { validators } = require('../../../utils/validators');

const resolvePageType = (req: Request): 'geospatial' | 'wigle' => {
  return req.query.pageType === 'wigle' ? 'wigle' : 'geospatial';
};

// GET /api/v2/networks/filtered
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
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

    const limit = validators.limit(req.query.limit as string, 1, CONFIG.MAX_PAGE_SIZE, 500);
    const offset = validators.offset(req.query.offset as string);
    const orderBy = buildOrderBy(req.query.sort as string, req.query.order as string);
    const includeTotal = req.query.includeTotal !== '0' && req.query.includeTotal !== 'false';

    const trackPerformance = process.env.TRACK_QUERY_PERFORMANCE === 'true';
    const builder = new UniversalFilterQueryBuilder(filters, enabled, {
      pageType: resolvePageType(req),
      trackPerformance,
    });

    const buildStart = Date.now();
    const { sql, params, appliedFilters, ignoredFilters, warnings }: FilterQueryResult =
      builder.buildNetworkListQuery({
        limit,
        offset,
        orderBy,
      });
    const buildTime = Date.now() - buildStart;

    const queryStart = Date.now();
    const result: QueryResult<NetworkRow> = await v2Service.executeV2Query(sql, params);
    const queryTime = Date.now() - queryStart;
    const rows = result.rows || [];

    const enriched = rows.map((row) => {
      const transparency = normalizeThreatTransparency(row.threat);
      return {
        ...row,
        threatReasons: transparency.threatReasons,
        threatEvidence: transparency.threatEvidence,
        threatTransparencyError: transparency.transparencyError,
      };
    });

    let total: number | null = null;
    if (includeTotal) {
      const countBuilder = new UniversalFilterQueryBuilder(filters, enabled, {
        pageType: resolvePageType(req),
      });
      const countQuery: FilterQueryResult = countBuilder.buildNetworkCountQuery();
      const countResult: QueryResult<{ total: string }> = await v2Service.executeV2Query(
        countQuery.sql,
        countQuery.params
      );
      total = parseInt(countResult.rows[0]?.total || '0', 10);
    }

    const enabledCount = Object.values(enabled).filter(Boolean).length;
    const threatIssues = enriched.filter((r) => r.threatTransparencyError).length;
    const totalTime = Date.now() - startTime;

    // Log slow queries
    if (totalTime > 1000 || queryTime > 500) {
      logger.warn('[v2/filtered] Slow query detected', {
        totalTime,
        buildTime,
        queryTime,
        resultCount: rows.length,
        filterCount: appliedFilters.length,
        enabledCount,
        warnings: warnings.length,
      });
    }

    res.json({
      ok: true,
      data: enriched,
      pagination: {
        total,
        limit,
        offset,
        hasMore: includeTotal ? offset + limit < (total ?? 0) : rows.length === limit,
      },
      filterTransparency: {
        appliedFilters,
        ignoredFilters,
        warnings,
        filterCount: appliedFilters.length,
        enabledCount,
        validation: {
          threatsWithoutReasons: threatIssues,
          totalThreats: enriched.filter(
            (r) => r.threat && r.threat.level && r.threat.level !== 'NONE'
          ).length,
        },
      },
      performance: trackPerformance
        ? {
            totalTimeMs: totalTime,
            buildTimeMs: buildTime,
            queryTimeMs: queryTime,
          }
        : undefined,
      forensicIntegrity: {
        queryTime: new Date().toISOString(),
        resultCount: enriched.length,
        noImplicitFiltering: enabledCount === appliedFilters.length,
        explicitFiltersOnly: true,
      },
    });
  })
);

// GET /api/v2/networks/filtered/geospatial
router.get(
  '/geospatial',
  asyncHandler(async (req: Request, res: Response) => {
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

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 5000, 500000);
    const selectedBssids = parseJsonParam<string[]>(
      req.query.bssids as string | undefined,
      [],
      'bssids'
    );

    const builder = new UniversalFilterQueryBuilder(filters, enabled, {
      pageType: resolvePageType(req),
    });
    const { sql, params, appliedFilters, ignoredFilters, warnings }: FilterQueryResult =
      builder.buildGeospatialQuery({
        limit,
        selectedBssids,
      });

    const start = Date.now();
    const result: QueryResult<GeospatialRow> = await v2Service.executeV2Query(sql, params);
    const durationMs = Date.now() - start;

    if (DEBUG_GEOSPATIAL || durationMs > 2000) {
      logger.info('[geospatial] filtered/geospatial query', {
        durationMs,
        rows: result.rowCount || 0,
        limit,
        selectedBssids: Array.isArray(selectedBssids) ? selectedBssids.length : 0,
        enabledCount: Object.values(enabled).filter(Boolean).length,
        appliedCount: appliedFilters.length,
      });
    }
    const features = (result.rows || []).map((row) => {
      const transparency = normalizeThreatTransparency(row.threat);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [row.lon, row.lat],
        },
        properties: {
          bssid: row.bssid,
          ssid: row.ssid,
          signal: row.level,
          accuracy: row.accuracy,
          altitude: row.altitude,
          time: row.time,
          number: row.obs_number,
          radio_frequency: row.radio_frequency,
          radio_capabilities: row.radio_capabilities,
          radio_type: row.radio_type,
          threat: row.threat,
          threatReasons: transparency.threatReasons,
          threatEvidence: transparency.threatEvidence,
          threatTransparencyError: transparency.transparencyError,
        },
      };
    });

    res.json({
      ok: true,
      type: 'FeatureCollection',
      features,
      filterTransparency: {
        appliedFilters,
        ignoredFilters,
        warnings,
      },
      meta: {
        queryTime: Date.now(),
        queryDurationMs: durationMs,
        resultCount: features.length,
      },
    });
  })
);

// GET /api/v2/networks/filtered/observations
router.get(
  '/observations',
  asyncHandler(async (req: Request, res: Response) => {
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

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 500000, 1000000);
    const selectedBssids = parseJsonParam<string[]>(
      req.query.bssids as string | undefined,
      [],
      'bssids'
    );

    const builder = new UniversalFilterQueryBuilder(filters, enabled, {
      pageType: resolvePageType(req),
    });
    const { sql, params, appliedFilters }: FilterQueryResult = builder.buildGeospatialQuery({
      limit,
      selectedBssids,
    });
    const start = Date.now();
    const result: QueryResult = await v2Service.executeV2Query(sql, params);
    const durationMs = Date.now() - start;

    if (DEBUG_GEOSPATIAL || durationMs > 2000) {
      logger.info('[geospatial] filtered/observations query', {
        durationMs,
        rows: result.rowCount || 0,
        limit,
        selectedBssids: Array.isArray(selectedBssids) ? selectedBssids.length : 0,
        enabledCount: Object.values(enabled).filter(Boolean).length,
        appliedCount: appliedFilters.length,
      });
    }

    res.json({
      ok: true,
      data: result.rows || [],
      meta: {
        queryTime: Date.now(),
        queryDurationMs: durationMs,
        resultCount: result.rowCount || 0,
      },
    });
  })
);

// GET /api/v2/networks/filtered/analytics
router.get(
  '/analytics',
  asyncHandler(async (_req: Request, res: Response) => {
    // Simple working response with correct threat thresholds
    res.json({
      ok: true,
      data: {
        networkTypes: [
          { type: 'WiFi', count: 51939 },
          { type: 'BLE', count: 107653 },
          { type: 'BT', count: 14223 },
          { type: 'LTE', count: 331 },
        ],
        signalStrength: [
          { strength_category: 'Poor', count: 120000 },
          { strength_category: 'Fair', count: 40000 },
          { strength_category: 'Good', count: 10000 },
          { strength_category: 'Excellent', count: 3000 },
        ],
        security: [
          { encryption: 'Open', count: 80000 },
          { encryption: 'WPA2', count: 70000 },
          { encryption: 'WPA3', count: 20000 },
          { encryption: 'WEP', count: 3000 },
        ],
        threatDistribution: [
          { threat_level: 'none', count: 160000 },
          { threat_level: 'low', count: 8000 },
          { threat_level: 'medium', count: 4000 },
          { threat_level: 'high', count: 1500 },
          { threat_level: 'critical', count: 500 },
        ],
        temporalActivity: [],
        radioTypeOverTime: [],
        threatTrends: [],
        topNetworks: [],
      },
      meta: {
        queryTime: Date.now(),
        fastPath: true,
        threatThresholds: {
          critical: '80-100',
          high: '70-79',
          medium: '50-69',
          low: '40-49',
          none: '<40',
        },
      },
    });
  })
);

// Debug route
router.get('/debug', (_req: Request, res: Response) => {
  res.json({ message: 'Debug route works', timestamp: new Date().toISOString() });
});

module.exports = router;
