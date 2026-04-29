import type { Filters, EnabledFlags, FilterQueryResult } from '../filteredHelpers';
import { DEBUG_GEOSPATIAL } from '../filteredHelpers';
import type { HandlerDeps } from './types';
import { ROUTE_CONFIG } from '../../../../config/routeConfig';

export const buildFilteredObservationsResponse = async (
  UniversalFilterQueryBuilder: HandlerDeps['filterQueryBuilder']['UniversalFilterQueryBuilder'],
  v2Service: HandlerDeps['v2Service'],
  logger: HandlerDeps['logger'],
  filters: Filters,
  enabled: EnabledFlags,
  limit: number,
  offset: number = 0,
  selectedBssids: string[] = [],
  pageType: 'geospatial' | 'wigle' = 'geospatial',
  includeTotalAndTruncation: boolean = false
) => {
  const builder = new UniversalFilterQueryBuilder(filters, enabled, { pageType });

  const fetchLimit = includeTotalAndTruncation ? limit + 1 : limit;
  const { sql, params, appliedFilters }: FilterQueryResult = builder.buildGeospatialQuery({
    limit: fetchLimit,
    offset,
    selectedBssids,
  });
  const start = Date.now();
  const result = await v2Service.executeV2Query(sql, params);
  const durationMs = Date.now() - start;

  const isTruncated = includeTotalAndTruncation && (result.rows?.length || 0) > limit;
  const dataRows =
    isTruncated && includeTotalAndTruncation
      ? (result.rows || []).slice(0, limit)
      : result.rows || [];
  const rowCount = dataRows.length;

  if (DEBUG_GEOSPATIAL || durationMs > ROUTE_CONFIG.slowGeospatialQueryMs) {
    logger.info('[geospatial] filtered/observations query', {
      durationMs,
      rows: rowCount,
      limit,
      offset,
      truncated: isTruncated,
      selectedBssids: Array.isArray(selectedBssids) ? selectedBssids.length : 0,
      enabledCount: Object.values(enabled).filter(Boolean).length,
      appliedCount: appliedFilters.length,
    });
  }

  const response: any = {
    ok: true,
    data: dataRows,
    meta: {
      queryTime: Date.now(),
      queryDurationMs: durationMs,
      resultCount: rowCount,
    },
  };

  if (includeTotalAndTruncation) {
    response.truncated = isTruncated;
    response.offset = offset;
    response.limit = limit;
  }

  return response;
};
