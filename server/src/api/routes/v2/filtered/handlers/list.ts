import type { Request, Response } from 'express';
import type { FilterQueryResult, NetworkRow } from '../../filteredHelpers';
import {
  parseAndValidateFilters,
  isParseValidatedFiltersError,
  normalizeThreatTransparency,
  buildOrderBy,
  assertHomeExistsIfNeeded,
} from '../../filteredHelpers';
import type { HandlerDeps } from '../types';
import { resolvePageType, applyEffectiveThreat } from '../utils';
import { ROUTE_CONFIG } from '../../../../../config/routeConfig';

export const createListHandler = (deps: HandlerDeps) => async (req: Request, res: Response) => {
  const { filterQueryBuilder, v2Service, logger, validators } = deps;
  const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;

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
  const rawLocationMode = req.query.location_mode as string | undefined;
  const locationMode = ['centroid', 'weighted_centroid'].includes(rawLocationMode ?? '')
    ? (rawLocationMode as 'centroid' | 'weighted_centroid')
    : 'latest_observation';

  const trackPerformance = process.env.TRACK_QUERY_PERFORMANCE === 'true';
  const builder = new UniversalFilterQueryBuilder(filters, enabled, {
    pageType: resolvePageType(req),
    trackPerformance,
  });

  const buildStart = Date.now();
  const { sql, params, appliedFilters, ignoredFilters, warnings }: FilterQueryResult =
    builder.buildNetworkListQuery({ limit, offset, orderBy, locationMode });
  const buildTime = Date.now() - buildStart;
  let queryTime = 0;
  let rows: NetworkRow[] = [];
  let enriched: NetworkRow[] = [];
  let enrichedSiblings: NetworkRow[] = [];
  let allEnriched: NetworkRow[] = [];
  let total: number | null = null;
  let totalUnavailable = false;

  await v2Service.withFilteredNetworkRequest(async (executor) => {
    const queryStart = Date.now();
    const result = await executor.executeV2Query(sql, params);
    queryTime = Date.now() - queryStart;
    rows = result.rows || [];

    enriched = rows.map((row: NetworkRow) => {
      const effectiveRow = applyEffectiveThreat(row);
      const transparency = normalizeThreatTransparency(effectiveRow.threat);
      return {
        ...effectiveRow,
        threatReasons: transparency.threatReasons,
        threatEvidence: transparency.threatEvidence,
        threatTransparencyError: transparency.transparencyError,
      };
    });

    const siblingRows = await executor.fetchMissingSiblingRows(
      rows.map((r: NetworkRow) => r.bssid),
      locationMode
    );
    enrichedSiblings = siblingRows.map((row: NetworkRow) => {
      const effectiveRow = applyEffectiveThreat(row);
      const transparency = normalizeThreatTransparency(effectiveRow.threat);
      return {
        ...effectiveRow,
        threatReasons: transparency.threatReasons,
        threatEvidence: transparency.threatEvidence,
        threatTransparencyError: transparency.transparencyError,
        _siblingSupplemented: true,
      };
    });
    allEnriched = enrichedSiblings.length > 0 ? [...enriched, ...enrichedSiblings] : enriched;

    if (includeTotal) {
      const countBuilder = new UniversalFilterQueryBuilder(filters, enabled, {
        pageType: resolvePageType(req),
      });
      const countQuery: FilterQueryResult = countBuilder.buildNetworkCountQuery();
      const countResult = await executor.executeOptionalCount(countQuery.sql, countQuery.params);
      if (countResult === null) {
        totalUnavailable = true;
      } else {
        const countRow = countResult.rows?.[0];
        total = parseInt(countRow?.total || '0', 10);
      }
    }
  }, startTime);

  const enabledCount = Object.values(enabled).filter(Boolean).length;
  const threatIssues = allEnriched.filter((r) => r.threatTransparencyError).length;
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
      siblingCount: enrichedSiblings.length,
      filterCount: appliedFilters.length,
      enabledCount,
      warnings: warnings.length,
    });
  }

  res.json({
    ok: true,
    data: allEnriched,
    pagination: {
      total,
      limit,
      offset,
      totalUnavailable,
      hasMore: total === null ? rows.length === limit : offset + limit < total,
    },
    filterTransparency: {
      appliedFilters,
      ignoredFilters,
      warnings,
      filterCount: appliedFilters.length,
      enabledCount,
      validation: {
        threatsWithoutReasons: threatIssues,
        totalThreats: allEnriched.filter(
          (r) => r.threat && r.threat.level && r.threat.level !== 'NONE'
        ).length,
      },
    },
    performance: trackPerformance
      ? { totalTimeMs: totalTime, buildTimeMs: buildTime, queryTimeMs: queryTime }
      : undefined,
    forensicIntegrity: {
      queryTime: new Date().toISOString(),
      resultCount: allEnriched.length,
      noImplicitFiltering: enabledCount === appliedFilters.length,
      explicitFiltersOnly: true,
    },
  });
};
