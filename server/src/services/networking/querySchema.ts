export {};

const getBaseSelectColumns = (channelExpr: string): string[] => [
  'ne.bssid',
  'ne.ssid',
  'ne.type',
  'ne.frequency',
  'ne.bestlevel AS signal',
  'ne.bestlat AS lat',
  'ne.bestlon AS lon',
  'ne.last_seen AS last_observed_at',
  'ne.first_seen AS first_observed_at',
  'ne.last_seen AS observed_at',
  'ne.observations AS obs_count',
  'ne.wigle_v3_observation_count',
  'ne.wigle_v3_last_import_at',
  'n.accuracy_meters',
  'ne.capabilities AS capabilities',
  'ne.capabilities AS security',
  `(${channelExpr}) AS channel`,
  'ne.wps',
  'n.battery',
  'n.altitude_m',
  'n.min_altitude_m',
  'n.max_altitude_m',
  'n.altitude_accuracy_m',
  'ne.max_distance_meters',
  'n.last_altitude_m',
  'n.unique_days',
  'n.unique_locations',
  'n.is_sentinel',
  'ne.manufacturer',
  'rm.address',
  'ne.threat_score AS final_threat_score',
  'ne.threat_level AS final_threat_level',
  'nts.rule_based_score',
  'nts.ml_threat_score',
  'nts.model_version',
  'nt.threat_tag',
  'nt.is_ignored',
  'COALESCE(nn.notes_count, 0) AS notes_count',
];

const withDistanceColumn = (columns: string[], includeDistance: boolean): string[] =>
  includeDistance
    ? [...columns, `(ne.distance_from_home_km)::numeric(10,4) AS distance_from_home_km`]
    : columns;

const getBaseJoins = (): string[] => [
  'LEFT JOIN app.networks n ON ne.bssid = n.bssid',
  'LEFT JOIN app.radio_manufacturers rm ON ne.oui = rm.prefix',
  'LEFT JOIN app.network_tags nt ON ne.bssid = nt.bssid',
  'LEFT JOIN app.network_threat_scores nts ON ne.bssid = nts.bssid',
  'LEFT JOIN (SELECT bssid, COUNT(*) AS notes_count FROM app.network_notes GROUP BY bssid) nn ON nn.bssid = ne.bssid',
];

export { getBaseJoins, getBaseSelectColumns, withDistanceColumn };
