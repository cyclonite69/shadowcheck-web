import type { NetworkFilters } from '../types/filters';

export interface FilterStatePayload {
  filters: NetworkFilters;
  enabled: Record<string, boolean>;
}

export interface BuildFilteredParamsOptions {
  payload: FilterStatePayload;
  limit: number;
  offset: number;
  includeTotal?: boolean;
  sort?: string;
  order?: string;
  orderBy?: string;
  pageType?: 'geospatial' | 'wigle';
  locationMode?: string;
  selectedBssids?: string[];
  planCheck?: boolean;
}

export function buildFilteredRequestParams(options: BuildFilteredParamsOptions): URLSearchParams {
  const {
    payload,
    limit,
    offset,
    includeTotal,
    sort,
    order,
    orderBy,
    pageType,
    locationMode,
    selectedBssids,
    planCheck,
  } = options;

  const params = new URLSearchParams({
    filters: JSON.stringify(payload.filters),
    enabled: JSON.stringify(payload.enabled),
    limit: String(limit),
    offset: String(offset),
  });

  if (typeof includeTotal === 'boolean') {
    params.set('includeTotal', includeTotal ? '1' : '0');
  }
  if (sort) params.set('sort', sort);
  if (order) params.set('order', order);
  if (orderBy) params.set('orderBy', orderBy);
  if (pageType) params.set('pageType', pageType);
  if (locationMode && locationMode !== 'latest_observation')
    params.set('location_mode', locationMode);
  if (planCheck) params.set('planCheck', '1');
  if (Array.isArray(selectedBssids) && selectedBssids.length > 0) {
    params.set('bssids', JSON.stringify(selectedBssids));
  }

  return params;
}
