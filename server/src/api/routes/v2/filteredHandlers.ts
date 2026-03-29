import type { Request, Response } from 'express';
import {
  type Filters,
  type EnabledFlags,
  type FilterQueryResult,
  type NetworkRow,
  type GeospatialRow,
  DEBUG_GEOSPATIAL,
  parseJsonParam,
  parseAndValidateFilters,
  isParseValidatedFiltersError,
  normalizeThreatTransparency,
  buildOrderBy,
  assertHomeExistsIfNeeded,
} from './filteredHelpers';
import { ROUTE_CONFIG } from '../../../config/routeConfig';

const resolvePageType = (req: Request): 'geospatial' | 'wigle' => {
  return req.query.pageType === 'wigle' ? 'wigle' : 'geospatial';
};

const resolveBodyPageType = (body: unknown): 'geospatial' | 'wigle' => {
  const pageType =
    body && typeof body === 'object' ? (body as { pageType?: unknown }).pageType : '';
  return pageType === 'wigle' ? 'wigle' : 'geospatial';
};

const isIgnoredRow = (row: { is_ignored?: unknown }): boolean => {
  const raw = row?.is_ignored;
  if (typeof raw === 'boolean') return raw;
  return String(raw).toLowerCase() === 'true';
};

const applyEffectiveThreat = <T extends { is_ignored?: unknown; threat?: unknown }>(row: T): T => {
  if (!isIgnoredRow(row)) {
    return row;
  }

  return {
    ...row,
    threat: {
      score: '0',
      level: 'NONE',
      flags: ['IGNORED'],
      signals: [],
    },
  };
};

const parseAndValidateBodyFilters = (
  body: unknown,
  validateFilterPayload: (filters: Filters, enabled: EnabledFlags) => { errors: string[] }
) => {
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const filters = (payload.filters as Filters | undefined) ?? {};
  const enabled = (payload.enabled as EnabledFlags | undefined) ?? {};
  const { errors } = validateFilterPayload(filters, enabled);

  if (errors.length > 0) {
    return {
      ok: false as const,
      status: 400,
      body: { ok: false as const, errors },
    };
  }

  return { ok: true as const, filters, enabled };
};

type HandlerDeps = {
  filterQueryBuilder: {
    UniversalFilterQueryBuilder: new (...args: any[]) => any;
    validateFilterPayload: (filters: Filters, enabled: EnabledFlags) => { errors: string[] };
  };
  v2Service: {
    executeV2Query: (sql: string, params: any[]) => Promise<{ rows?: any[]; rowCount?: number }>;
  };
  filteredAnalyticsService: {
    getFilteredAnalytics: (
      filters: Filters,
      enabled: EnabledFlags,
      pageType: 'geospatial' | 'wigle'
    ) => Promise<{ data: unknown; queryDurationMs: number }>;
  };
  logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  };
  validators: {
    limit: (value: string | undefined, min: number, max: number, fallback: number) => number;
    offset: (value: string | undefined) => number;
  };
};

const buildFilteredObservationsResponse = async (
  UniversalFilterQueryBuilder: HandlerDeps['filterQueryBuilder']['UniversalFilterQueryBuilder'],
  v2Service: HandlerDeps['v2Service'],
  logger: HandlerDeps['logger'],
  filters: Filters,
  enabled: EnabledFlags,
  limit: number,
  selectedBssids: string[],
  pageType: 'geospatial' | 'wigle'
) => {
  const builder = new UniversalFilterQueryBuilder(filters, enabled, {
    pageType,
  });
  const { sql, params, appliedFilters }: FilterQueryResult = builder.buildGeospatialQuery({
    limit,
    selectedBssids,
  });
  const start = Date.now();
  const result = await v2Service.executeV2Query(sql, params);
  const durationMs = Date.now() - start;

  if (DEBUG_GEOSPATIAL || durationMs > ROUTE_CONFIG.slowGeospatialQueryMs) {
    logger.info('[geospatial] filtered/observations query', {
      durationMs,
      rows: result.rowCount || 0,
      limit,
      selectedBssids: Array.isArray(selectedBssids) ? selectedBssids.length : 0,
      enabledCount: Object.values(enabled).filter(Boolean).length,
      appliedCount: appliedFilters.length,
    });
  }

  return {
    ok: true,
    data: result.rows || [],
    meta: {
      queryTime: Date.now(),
      queryDurationMs: durationMs,
      resultCount: result.rowCount || 0,
    },
  };
};

const createHandlers = (deps: HandlerDeps) => {
  const { filterQueryBuilder, v2Service, filteredAnalyticsService, logger, validators } = deps;
  const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;

  const list = async (req: Request, res: Response) => {
    const startTime = Date.now();
    const parsed = parseAndValidateFilters(req, validateFilterPayload);
    if (isParseValidatedFiltersError(parsed)) {
      return res.status(parsed.status).json(parsed.body);
    }
    const { filters, enabled } = parsed;

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const limit = validators.limit(
      req.query.limit as string,
      1,
      ROUTE_CONFIG.maxPageSize,
      ROUTE_CONFIG.filteredDefaultLimit
    );
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
    const result = await v2Service.executeV2Query(sql, params);
    const queryTime = Date.now() - queryStart;
    const rows = result.rows || [];

    const enriched = rows.map((row: NetworkRow) => {
      const effectiveRow = applyEffectiveThreat(row);
      const transparency = normalizeThreatTransparency(effectiveRow.threat);
      return {
        ...effectiveRow,
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
      const countResult = await v2Service.executeV2Query(countQuery.sql, countQuery.params);
      const countRow = countResult.rows?.[0];
      total = parseInt(countRow?.total || '0', 10);
    }

    const enabledCount = Object.values(enabled).filter(Boolean).length;
    const threatIssues = enriched.filter((r) => r.threatTransparencyError).length;
    const totalTime = Date.now() - startTime;

    if (
      totalTime > ROUTE_CONFIG.slowFilteredTotalMs ||
      queryTime > ROUTE_CONFIG.slowFilteredQueryMs
    ) {
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
  };

  const geospatial = async (req: Request, res: Response) => {
    const parsed = parseAndValidateFilters(req, validateFilterPayload);
    if (isParseValidatedFiltersError(parsed)) {
      return res.status(parsed.status).json(parsed.body);
    }
    const { filters, enabled } = parsed;

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const limit = Math.min(
      parseInt(req.query.limit as string, 10) || ROUTE_CONFIG.geospatialDefaultLimit,
      ROUTE_CONFIG.geospatialMaxLimit
    );
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
    const result = await v2Service.executeV2Query(sql, params);
    const durationMs = Date.now() - start;

    if (DEBUG_GEOSPATIAL || durationMs > ROUTE_CONFIG.slowGeospatialQueryMs) {
      logger.info('[geospatial] filtered/geospatial query', {
        durationMs,
        rows: result.rowCount || 0,
        limit,
        selectedBssids: Array.isArray(selectedBssids) ? selectedBssids.length : 0,
        enabledCount: Object.values(enabled).filter(Boolean).length,
        appliedCount: appliedFilters.length,
      });
    }
    const features = (result.rows || []).map((row: GeospatialRow) => {
      const effectiveRow = applyEffectiveThreat(row);
      const transparency = normalizeThreatTransparency(effectiveRow.threat);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [effectiveRow.lon as number, effectiveRow.lat as number],
        },
        properties: {
          bssid: effectiveRow.bssid,
          ssid: effectiveRow.ssid,
          signal: effectiveRow.level,
          accuracy: effectiveRow.accuracy,
          altitude: effectiveRow.altitude,
          time: effectiveRow.time,
          number: effectiveRow.obs_number,
          radio_frequency: effectiveRow.radio_frequency,
          radio_capabilities: effectiveRow.radio_capabilities,
          radio_type: effectiveRow.radio_type,
          threat: effectiveRow.threat,
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
  };

  const getObservations = async (req: Request, res: Response) => {
    const parsed = parseAndValidateFilters(req, validateFilterPayload);
    if (isParseValidatedFiltersError(parsed)) {
      return res.status(parsed.status).json(parsed.body);
    }
    const { filters, enabled } = parsed;

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const limit = Math.min(
      parseInt(req.query.limit as string, 10) || ROUTE_CONFIG.observationsDefaultLimit,
      ROUTE_CONFIG.observationsMaxLimit
    );
    const selectedBssids = parseJsonParam<string[]>(
      req.query.bssids as string | undefined,
      [],
      'bssids'
    );

    res.json(
      await buildFilteredObservationsResponse(
        UniversalFilterQueryBuilder,
        v2Service,
        logger,
        filters,
        enabled,
        limit,
        selectedBssids,
        resolvePageType(req)
      )
    );
  };

  const postObservations = async (req: Request, res: Response) => {
    const parsed = parseAndValidateBodyFilters(req.body, validateFilterPayload);
    if (isParseValidatedFiltersError(parsed)) {
      return res.status(parsed.status).json(parsed.body);
    }
    const { filters, enabled } = parsed;

    if (!(await assertHomeExistsIfNeeded(enabled as EnabledFlags, res))) {
      return;
    }

    const payload =
      req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const rawLimit =
      typeof payload.limit === 'number' ? payload.limit : parseInt(String(payload.limit ?? ''), 10);
    const limit = Math.min(
      Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : ROUTE_CONFIG.observationsDefaultLimit,
      ROUTE_CONFIG.observationsMaxLimit
    );
    const selectedBssids = Array.isArray(payload.bssids)
      ? payload.bssids.filter((v): v is string => typeof v === 'string')
      : [];

    res.json(
      await buildFilteredObservationsResponse(
        UniversalFilterQueryBuilder,
        v2Service,
        logger,
        filters as Filters,
        enabled as EnabledFlags,
        limit,
        selectedBssids,
        resolveBodyPageType(req.body)
      )
    );
  };

  const analytics = async (req: Request, res: Response) => {
    const parsed = parseAndValidateFilters(req, validateFilterPayload);
    if (isParseValidatedFiltersError(parsed)) {
      return res.status(parsed.status).json(parsed.body);
    }
    const { filters = {}, enabled = {} } = parsed;

    if (!(await assertHomeExistsIfNeeded(enabled as EnabledFlags, res))) {
      return;
    }

    const analyticsResult = await filteredAnalyticsService.getFilteredAnalytics(
      filters as Filters,
      enabled as EnabledFlags,
      resolvePageType(req)
    );

    res.json({
      ok: true,
      data: analyticsResult.data,
      meta: {
        queryTime: Date.now(),
        queryDurationMs: analyticsResult.queryDurationMs,
        fastPath: false,
        threatThresholds: ROUTE_CONFIG.threatThresholds,
      },
    });
  };

  return {
    list,
    geospatial,
    getObservations,
    postObservations,
    analytics,
    debug: (_req: Request, res: Response) => {
      res.json({ message: 'Debug route works', timestamp: new Date().toISOString() });
    },
  };
};

export { createHandlers };
