export {};

const NETWORKS_SORT_MAP: Record<string, string> = {
  observed_at: 'observed_at',
  last_seen: 'last_seen',
  ssid: 'ssid',
  bssid: 'bssid',
  signal: 'level',
  frequency: 'frequency',
  observations: 'observations',
  distance_from_home_km: 'distance_from_home_km',
  accuracy_meters: 'accuracy_meters',
};

const NETWORKS_V2_SORT_MAP: Record<string, string> = {
  observed_at: 'observed_at',
  last_seen: 'last_seen',
  first_seen: 'first_seen',
  ssid: 'ssid',
  bssid: 'bssid',
  signal: 'signal',
  frequency: 'frequency',
  observations: 'observations',
  distance: 'distance_from_home_km',
  distancefromhome: 'distance_from_home_km',
  distance_from_home_km: 'distance_from_home_km',
  accuracy: 'accuracy_meters',
  accuracy_meters: 'accuracy_meters',
  type: 'type',
  security: 'security',
  manufacturer: 'manufacturer',
  threat_score: "(threat->>'score')::numeric",
  'threat.score': "(threat->>'score')::numeric",
  min_altitude_m: 'min_altitude_m',
  max_altitude_m: 'max_altitude_m',
  altitude_span_m: 'altitude_span_m',
  max_distance_meters: 'max_distance_meters',
  maxdistancemeters: 'max_distance_meters',
  max_distance: 'max_distance_meters',
  last_altitude_m: 'last_altitude_m',
  is_sentinel: 'is_sentinel',
  lastseen: 'last_seen',
  lastSeen: 'last_seen',
  distanceFromHome: 'distance_from_home_km',
};

const getThreatLevelSort = (order: string): string =>
  order === 'asc'
    ? "CASE WHEN threat->>'level' = 'NONE' THEN 1 WHEN threat->>'level' = 'LOW' THEN 2 WHEN threat->>'level' = 'MED' THEN 3 WHEN threat->>'level' = 'HIGH' THEN 4 WHEN threat->>'level' = 'CRITICAL' THEN 5 ELSE 0 END"
    : "CASE WHEN threat->>'level' = 'CRITICAL' THEN 1 WHEN threat->>'level' = 'HIGH' THEN 2 WHEN threat->>'level' = 'MED' THEN 3 WHEN threat->>'level' = 'LOW' THEN 4 WHEN threat->>'level' = 'NONE' THEN 5 ELSE 6 END";

const resolveLegacySortColumn = (sort: string): string => NETWORKS_SORT_MAP[sort] || 'last_seen';

const buildExplorerV2OrderClause = (sort: string, order: string): string => {
  const sortColumns = String(sort)
    .toLowerCase()
    .split(',')
    .map((s) => s.trim());
  const sortOrders = String(order)
    .toLowerCase()
    .split(',')
    .map((o) => o.trim());

  return sortColumns
    .map((col, idx) => {
      const dir = sortOrders[idx] === 'asc' ? 'ASC' : 'DESC';
      if (col === 'threat') {
        return `${getThreatLevelSort(sortOrders[idx])} ${dir}`;
      }
      if (col === 'threat_score') {
        return `(threat->>'score')::numeric ${dir} NULLS LAST`;
      }
      const mappedCol = NETWORKS_V2_SORT_MAP[col] || 'last_seen';
      return `${mappedCol} ${dir} NULLS LAST`;
    })
    .join(', ');
};

export {
  buildExplorerV2OrderClause,
  getThreatLevelSort,
  NETWORKS_SORT_MAP,
  NETWORKS_V2_SORT_MAP,
  resolveLegacySortColumn,
};
