const { escapeLikePattern } = require('../../utils/escapeSQL');
const { NETWORK_CHANNEL_EXPR } = require('../filterQueryBuilder/sqlExpressions');
const {
  buildEncryptionTypeCondition,
  buildAuthMethodCondition,
  buildThreatScoreExpr,
  buildThreatLevelExpr,
  buildTypeExpr,
  buildDistanceExpr,
} = require('../../utils/networkSqlExpressions');

export {};

import type { NetworkFilterOptions, NetworkQueryParts } from './types';

const buildNetworkQueryParts = (
  opts: NetworkFilterOptions,
  homeLocation: { lat: number; lon: number } | null,
  simpleRuleScoringEnabled: boolean
): {
  queryParts: NetworkQueryParts;
  channelExpr: string;
  threatLevelExpr: string;
} => {
  const {
    locationMode,
    threatLevel,
    threatCategories,
    threatScoreMin,
    threatScoreMax,
    lastSeen,
    distanceFromHomeKm,
    distanceFromHomeMinKm,
    distanceFromHomeMaxKm,
    minSignal,
    maxSignal,
    minObsCount,
    maxObsCount,
    ssidPattern,
    bssidList,
    radioTypes,
    encryptionTypes,
    authMethods,
    insecureFlags,
    securityFlags,
    quickSearchPattern,
    manufacturer,
    bboxMinLat,
    bboxMaxLat,
    bboxMinLng,
    bboxMaxLng,
    radiusCenterLat,
    radiusCenterLng,
    radiusMeters,
  } = opts;

  const typeExpr = buildTypeExpr('ne');
  const channelExpr = NETWORK_CHANNEL_EXPR('ne');
  const threatScoreExpr = buildThreatScoreExpr(simpleRuleScoringEnabled);
  const threatLevelExpr = buildThreatLevelExpr(threatScoreExpr);

  const selectColumns = [
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

  const distanceExpr = homeLocation
    ? buildDistanceExpr(homeLocation.lat, homeLocation.lon, 'ne', 'o')
    : 'NULL';
  const columnsWithDistance = homeLocation
    ? [...selectColumns, `(ne.distance_from_home_km)::numeric(10,4) AS distance_from_home_km`]
    : selectColumns;

  const joins = [
    'LEFT JOIN app.networks n ON ne.bssid = n.bssid',
    'LEFT JOIN app.radio_manufacturers rm ON ne.oui = rm.prefix',
    'LEFT JOIN app.network_tags nt ON ne.bssid = nt.bssid',
    'LEFT JOIN app.network_threat_scores nts ON ne.bssid = nts.bssid',
    'LEFT JOIN (SELECT bssid, COUNT(*) AS notes_count FROM app.network_notes GROUP BY bssid) nn ON nn.bssid = ne.bssid',
  ];

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  const appliedFilters: NetworkQueryParts['appliedFilters'] = [];

  const addCondition = (condition: string, value: unknown) => {
    conditions.push(condition);
    params.push(value);
    paramIndex++;
  };

  if (ssidPattern !== null) {
    addCondition(`ne.ssid ILIKE $${paramIndex}`, `%${escapeLikePattern(ssidPattern)}%`);
    appliedFilters.push({ column: 'ssid', value: ssidPattern });
  }
  if (bssidList && bssidList.length > 0) {
    conditions.push(`ne.bssid = ANY($${paramIndex}::text[])`);
    params.push(bssidList);
    paramIndex++;
    appliedFilters.push({ column: 'bssid', value: bssidList });
  }
  if (threatLevel !== null) {
    addCondition(`(${threatLevelExpr}) = $${paramIndex}`, threatLevel);
    appliedFilters.push({ column: 'threatLevel', value: threatLevel });
  }
  if (threatCategories && threatCategories.length > 0) {
    addCondition(`(${threatLevelExpr}) = ANY($${paramIndex}::text[])`, threatCategories);
    appliedFilters.push({ column: 'threatCategories', value: threatCategories });
  }
  if (threatScoreMin !== null) {
    addCondition(`${threatScoreExpr} >= $${paramIndex}`, threatScoreMin);
  }
  if (threatScoreMax !== null) {
    addCondition(`${threatScoreExpr} <= $${paramIndex}`, threatScoreMax);
  }
  if (threatScoreMin !== null || threatScoreMax !== null) {
    appliedFilters.push({
      column: 'threatScore',
      range: [threatScoreMin ?? -100, threatScoreMax ?? 100],
    });
  }
  if (lastSeen !== null) {
    addCondition(`ne.last_seen >= $${paramIndex}`, lastSeen);
    appliedFilters.push({ column: 'lastSeen', value: lastSeen });
  }
  if (distanceFromHomeKm !== null) {
    addCondition(`(${distanceExpr}) <= $${paramIndex}`, distanceFromHomeKm);
  }
  if (distanceFromHomeMinKm !== null) {
    addCondition(`(${distanceExpr}) >= $${paramIndex}`, distanceFromHomeMinKm);
  }
  if (distanceFromHomeMaxKm !== null) {
    addCondition(`(${distanceExpr}) <= $${paramIndex}`, distanceFromHomeMaxKm);
  }
  if (
    distanceFromHomeMinKm !== null ||
    distanceFromHomeMaxKm !== null ||
    distanceFromHomeKm !== null
  ) {
    appliedFilters.push({
      column: 'distanceFromHome',
      range: [distanceFromHomeMinKm ?? 0, distanceFromHomeMaxKm ?? distanceFromHomeKm ?? 10000],
    });
  }
  if (minSignal !== null) {
    addCondition(`ne.signal >= $${paramIndex}`, minSignal);
  }
  if (maxSignal !== null) {
    addCondition(`ne.signal <= $${paramIndex}`, maxSignal);
  }
  if (minSignal !== null || maxSignal !== null) {
    appliedFilters.push({ column: 'rssi', range: [minSignal ?? -100, maxSignal ?? 0] });
  }
  if (minObsCount !== null) {
    addCondition(`ne.observations >= $${paramIndex}`, minObsCount);
  }
  if (maxObsCount !== null) {
    addCondition(`ne.observations <= $${paramIndex}`, maxObsCount);
  }
  if (minObsCount !== null || maxObsCount !== null) {
    appliedFilters.push({
      column: 'obsCount',
      range: [minObsCount ?? 0, maxObsCount ?? 1000000],
    });
  }
  if (radioTypes && radioTypes.length > 0) {
    conditions.push(`(${typeExpr}) = ANY($${paramIndex}::text[])`);
    params.push(radioTypes);
    paramIndex++;
    appliedFilters.push({ column: 'radioTypes', value: radioTypes });
  }
  if (encryptionTypes && encryptionTypes.length > 0) {
    const encResult = buildEncryptionTypeCondition(encryptionTypes, paramIndex);
    if (encResult) {
      conditions.push(encResult.sql);
      params.push(...encResult.params);
      paramIndex += encResult.params.length;
    }
    appliedFilters.push({ column: 'encryptionTypes', value: encryptionTypes });
  }
  if (authMethods && authMethods.length > 0) {
    const authResult = buildAuthMethodCondition(authMethods, paramIndex);
    if (authResult) {
      conditions.push(authResult.sql);
      params.push(...authResult.params);
      paramIndex += authResult.params.length;
    }
    appliedFilters.push({ column: 'authMethods', value: authMethods });
  }
  if (insecureFlags && insecureFlags.length > 0) {
    conditions.push(`(ne.insecure_flags && $${paramIndex}::text[])`);
    params.push(insecureFlags);
    paramIndex++;
    appliedFilters.push({ column: 'insecureFlags', value: insecureFlags });
  }
  if (securityFlags && securityFlags.length > 0) {
    conditions.push(`(ne.security_flags && $${paramIndex}::text[])`);
    params.push(securityFlags);
    paramIndex++;
    appliedFilters.push({ column: 'securityFlags', value: securityFlags });
  }
  if (quickSearchPattern !== null) {
    conditions.push(
      `(ne.ssid ILIKE $${paramIndex} OR ne.bssid ILIKE $${paramIndex} OR ne.manufacturer ILIKE $${paramIndex})`
    );
    params.push(`%${escapeLikePattern(quickSearchPattern)}%`);
    paramIndex++;
  }
  if (manufacturer !== null) {
    addCondition(`ne.manufacturer ILIKE $${paramIndex}`, `%${escapeLikePattern(manufacturer)}%`);
    appliedFilters.push({ column: 'manufacturer', value: manufacturer });
  }

  if (
    locationMode === 'centroid' ||
    locationMode === 'weighted_centroid' ||
    locationMode === 'triangulated'
  ) {
    const modePrefix =
      locationMode === 'weighted_centroid'
        ? 'weighted'
        : locationMode === 'triangulated'
          ? 'triangulated'
          : 'centroid';
    joins.push(
      `LEFT JOIN LATERAL (SELECT bssid, ${modePrefix}_lat AS lat, ${modePrefix}_lon AS lon FROM app.network_locations WHERE bssid = ne.bssid) AS nl ON true`
    );
  }
  if (bboxMinLat !== null && bboxMaxLat !== null && bboxMinLng !== null && bboxMaxLng !== null) {
    if (locationMode === 'latest_observation') {
      conditions.push(`ne.lat BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(bboxMinLat, bboxMaxLat);
      paramIndex += 2;
      conditions.push(`ne.lon BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(bboxMinLng, bboxMaxLng);
      paramIndex += 2;
    } else {
      joins.push('LEFT JOIN app.network_locations nl ON ne.bssid = nl.bssid');
      conditions.push(`nl.lat BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(bboxMinLat, bboxMaxLat);
      paramIndex += 2;
      conditions.push(`nl.lon BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(bboxMinLng, bboxMaxLng);
      paramIndex += 2;
    }
  }
  if (radiusCenterLat !== null && radiusCenterLng !== null && radiusMeters !== null) {
    conditions.push(
      `(ST_Distance(ST_MakePoint($${paramIndex + 1}, $${paramIndex})::geography, ST_MakePoint(ne.lon, ne.lat)::geography) <= $${paramIndex + 2})`
    );
    params.push(radiusCenterLat, radiusCenterLng, radiusMeters);
    paramIndex += 3;
  }

  return {
    queryParts: {
      columnsWithDistance,
      joins,
      conditions,
      params,
      paramIndex,
      appliedFilters,
    },
    channelExpr,
    threatLevelExpr,
  };
};

export { buildNetworkQueryParts };
