/**
 * Network Service Layer
 * Encapsulates database queries for network operations
 */

const { CONFIG } = require('../config/database');
const logger = require('../logging/logger');
const { getHomeLocation } = require('./networking/homeLocation');
const { buildNetworkQueryParts } = require('./networking/queryParts');
const {
  explainQuery,
  getManufacturerByBSSID,
  getNetworkCount,
  listNetworks,
  searchNetworksBySSID,
} = require('./networking/repository');
const { parseNetworkSort } = require('./networking/sorting');
const { buildNetworkDataQuery } = require('./networking/sql');

import type { NetworkFilterOptions } from './networking/types';

export async function getFilteredNetworks(opts: NetworkFilterOptions): Promise<any> {
  const { limit, offset, planCheck, sort, order } = opts;

  let homeLocation: { lat: number; lon: number } | null = null;
  try {
    homeLocation = await getHomeLocation();
  } catch (err: any) {
    logger.warn('Could not fetch home location', { error: err.message });
  }

  const { queryParts, channelExpr, threatLevelExpr } = buildNetworkQueryParts(
    opts,
    homeLocation,
    CONFIG.SIMPLE_RULE_SCORING_ENABLED
  );
  const { sortEntries, sortClauses, ignoredSorts, expensiveSort } = parseNetworkSort(
    sort,
    order,
    channelExpr,
    threatLevelExpr
  );

  if (expensiveSort && limit > 2000) {
    return {
      status: 400,
      error:
        'Query plan check would be too expensive. Please reduce limit to <= 2000 for expensive sorts, or use an indexed sort column (bssid, last_seen, first_observed_at, observed_at, ssid, signal, obs_count, distance_from_home_km, max_distance_meters).',
    };
  }
  const { columnsWithDistance, joins, conditions, params, paramIndex, appliedFilters } = queryParts;

  const total = await getNetworkCount(conditions, params, joins);
  const rows = await listNetworks(
    columnsWithDistance,
    joins,
    conditions,
    params,
    sortClauses,
    limit,
    offset,
    paramIndex
  );

  if (planCheck) {
    const plan = await explainQuery(
      columnsWithDistance,
      joins,
      conditions,
      params,
      sortClauses,
      limit,
      offset,
      paramIndex
    );
    const dataQuery = buildNetworkDataQuery(
      columnsWithDistance,
      joins,
      conditions,
      sortClauses,
      paramIndex
    );
    const dataParams = [...params, limit, offset];
    return {
      query: dataQuery,
      params: dataParams,
      plan,
      total,
      count: rows.length,
      applied_filters: [...appliedFilters, ...sortEntries],
      ignoredSorts,
    };
  }

  return {
    networks: rows,
    total,
    count: rows.length,
    limit,
    offset,
    appliedFilters: [...appliedFilters, ...sortEntries],
    ignoredSorts,
  };
}

module.exports = {
  getHomeLocation,
  getFilteredNetworks,
  getNetworkCount,
  listNetworks,
  explainQuery,
  searchNetworksBySSID,
  getManufacturerByBSSID,
};
