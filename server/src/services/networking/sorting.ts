const { safeJsonParse } = require('../../utils/safeJsonParse');

export {};

import type { SortEntry } from './types';

const parseOrderColumns = (value: unknown): string[] =>
  String(value)
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

const getSortColumnMap = (
  channelExpr: string,
  threatLevelExpr: string
): Record<string, string> => ({
  last_seen: 'ne.last_seen',
  last_observed_at: 'ne.last_seen',
  first_observed_at: 'ne.first_seen',
  observed_at: 'ne.last_seen',
  ssid: 'lower(ne.ssid)',
  bssid: 'ne.bssid',
  type: 'ne.type',
  security: 'ne.capabilities',
  signal: 'ne.bestlevel',
  frequency: 'ne.frequency',
  channel: channelExpr,
  obs_count: 'ne.observations',
  observations: 'ne.observations',
  distance_from_home_km: 'ne.distance_from_home_km',
  accuracy_meters: 'n.accuracy_meters',
  avg_signal: 'ne.bestlevel',
  min_signal: 'ne.bestlevel',
  max_signal: 'ne.bestlevel',
  unique_days: 'n.unique_days',
  unique_locations: 'n.unique_locations',
  threat: 'ne.threat_score',
  threat_score: 'ne.threat_score',
  threat_rule_score: "COALESCE((nts.ml_feature_values->>'rule_score')::numeric, 0)",
  threat_ml_score: "COALESCE((nts.ml_feature_values->>'ml_score')::numeric, 0)",
  threat_ml_weight: "COALESCE((nts.ml_feature_values->>'evidence_weight')::numeric, 0)",
  threat_ml_boost: "COALESCE((nts.ml_feature_values->>'ml_boost')::numeric, 0)",
  threat_level: 'ne.threat_level',
  lat: 'ne.bestlat',
  lon: 'ne.bestlon',
  manufacturer: 'lower(ne.manufacturer)',
  manufacturer_address: 'lower(rm.address)',
  capabilities: 'ne.capabilities',
  min_altitude_m: 'n.min_altitude_m',
  max_altitude_m: 'n.max_altitude_m',
  altitude_span_m: 'n.altitude_span_m',
  max_distance_meters: 'ne.max_distance_meters',
  last_altitude_m: 'n.last_altitude_m',
  is_sentinel: 'n.is_sentinel',
  timespan_days: 'EXTRACT(EPOCH FROM (ne.last_seen - ne.first_seen)) / 86400.0',
  threat_order: `CASE ${threatLevelExpr}
      WHEN 'CRITICAL' THEN 4
      WHEN 'HIGH' THEN 3
      WHEN 'MED' THEN 2
      WHEN 'LOW' THEN 1
      ELSE 0
    END`,
});

const parseNetworkSort = (
  sort: unknown,
  order: unknown,
  channelExpr: string,
  threatLevelExpr: string
): {
  sortEntries: SortEntry[];
  sortClauses: string;
  ignoredSorts: string[];
  expensiveSort: boolean;
} => {
  const sortColumnMap = getSortColumnMap(channelExpr, threatLevelExpr);
  const parsedSortJson = safeJsonParse(sort);
  const parsedOrderJson = safeJsonParse(order);
  const sortEntries: SortEntry[] = [];
  const ignoredSorts: string[] = [];

  if (Array.isArray(parsedSortJson) || (parsedSortJson && typeof parsedSortJson === 'object')) {
    const entries = Array.isArray(parsedSortJson) ? parsedSortJson : [parsedSortJson];
    entries.forEach((entry: any) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const column = String(entry.column || '')
        .trim()
        .toLowerCase();
      if (!sortColumnMap[column]) {
        if (column) {
          ignoredSorts.push(column);
        }
        return;
      }
      const dir = String(entry.direction || 'ASC')
        .trim()
        .toUpperCase();
      sortEntries.push({
        column,
        direction: ['ASC', 'DESC'].includes(dir) ? (dir as 'ASC' | 'DESC') : 'ASC',
      });
    });
  } else {
    const sortColumns = String(sort)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const orderColumns = Array.isArray(parsedOrderJson)
      ? parsedOrderJson.map((value) => String(value).trim().toUpperCase())
      : parseOrderColumns(order);

    const normalizedOrders =
      orderColumns.length === 1 ? sortColumns.map(() => orderColumns[0]) : orderColumns;

    sortColumns.forEach((column, idx) => {
      if (!sortColumnMap[column]) {
        ignoredSorts.push(column);
        return;
      }
      const dir = normalizedOrders[idx] || 'ASC';
      sortEntries.push({
        column,
        direction: ['ASC', 'DESC'].includes(dir) ? (dir as 'ASC' | 'DESC') : 'ASC',
      });
    });
  }

  if (sortEntries.length === 0) {
    sortEntries.push({ column: 'last_seen', direction: 'DESC' });
  }

  const indexedSorts = new Set([
    'bssid',
    'last_seen',
    'first_observed_at',
    'observed_at',
    'ssid',
    'signal',
    'obs_count',
    'distance_from_home_km',
    'max_distance_meters',
  ]);
  const expensiveSort = !(sortEntries.length === 1 && indexedSorts.has(sortEntries[0].column));
  const sortClauses = sortEntries
    .map((entry) => `${sortColumnMap[entry.column]} ${entry.direction}`)
    .join(', ');

  return {
    sortEntries,
    sortClauses,
    ignoredSorts,
    expensiveSort,
  };
};

export { parseNetworkSort };
