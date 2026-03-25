/**
 * Network Service Layer
 * Encapsulates database queries for network operations
 */

const { query } = require('../config/database');
const { CONFIG } = require('../config/database');
const logger = require('../logging/logger');
const { escapeLikePattern } = require('../utils/escapeSQL');
const { safeJsonParse } = require('../utils/safeJsonParse');
const { NETWORK_CHANNEL_EXPR } = require('./filterQueryBuilder/sqlExpressions');
const {
  buildEncryptionTypeCondition,
  buildAuthMethodCondition,
  buildThreatScoreExpr,
  buildThreatLevelExpr,
  buildTypeExpr,
  buildDistanceExpr,
} = require('../utils/networkSqlExpressions');

export async function getHomeLocation(): Promise<{ lat: number; lon: number } | null> {
  try {
    const result = await query(
      "SELECT latitude, longitude FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
    );
    if (result.rows.length > 0) {
      const { latitude, longitude } = result.rows[0];
      if (latitude !== null && longitude !== null) {
        return { lat: parseFloat(latitude), lon: parseFloat(longitude) };
      }
    }
    return null;
  } catch (err: any) {
    logger.warn('Could not fetch home location:', err.message);
    return null;
  }
}

export async function getFilteredNetworks(opts: {
  limit: number;
  offset: number;
  planCheck: boolean;
  locationMode: string;
  sort: unknown;
  order: unknown;
  threatLevel: string | null;
  threatCategories: string[] | null;
  threatScoreMin: number | null;
  threatScoreMax: number | null;
  lastSeen: string | null;
  distanceFromHomeKm: number | null;
  distanceFromHomeMinKm: number | null;
  distanceFromHomeMaxKm: number | null;
  minSignal: number | null;
  maxSignal: number | null;
  minObsCount: number | null;
  maxObsCount: number | null;
  ssidPattern: string | null;
  bssidList: string[] | null;
  radioTypes: string[] | null;
  encryptionTypes: string[] | null;
  authMethods: string[] | null;
  insecureFlags: string[] | null;
  securityFlags: string[] | null;
  quickSearchPattern: string | null;
  manufacturer: string | null;
  bboxMinLat: number | null;
  bboxMaxLat: number | null;
  bboxMinLng: number | null;
  bboxMaxLng: number | null;
  radiusCenterLat: number | null;
  radiusCenterLng: number | null;
  radiusMeters: number | null;
}): Promise<any> {
  const {
    limit,
    offset,
    planCheck,
    locationMode,
    sort,
    order,
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
  const threatScoreExpr = buildThreatScoreExpr(CONFIG.SIMPLE_RULE_SCORING_ENABLED);
  const threatLevelExpr = buildThreatLevelExpr(threatScoreExpr);
  const threatOrderExpr = `CASE ${threatLevelExpr}
      WHEN 'CRITICAL' THEN 4
      WHEN 'HIGH' THEN 3
      WHEN 'MED' THEN 2
      WHEN 'LOW' THEN 1
      ELSE 0
    END`;

  const sortColumnMap: Record<string, string> = {
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
  };

  const parseOrderColumns = (value: unknown): string[] =>
    String(value)
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

  const parsedSortJson = safeJsonParse(sort);
  const parsedOrderJson = safeJsonParse(order);
  const sortEntries: Array<{ column: string; direction: 'ASC' | 'DESC' }> = [];
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
      sortEntries.push({ column, direction: ['ASC', 'DESC'].includes(dir) ? (dir as any) : 'ASC' });
    });
  } else {
    const sortColumns = String(sort)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const orderColumns = Array.isArray(parsedOrderJson)
      ? parsedOrderJson.map((v) => String(v).trim().toUpperCase())
      : parseOrderColumns(order);

    const normalizedOrders =
      orderColumns.length === 1 ? sortColumns.map(() => orderColumns[0]) : orderColumns;

    sortColumns.forEach((col, idx) => {
      if (!sortColumnMap[col]) {
        ignoredSorts.push(col);
        return;
      }
      const dir = normalizedOrders[idx] || 'ASC';
      sortEntries.push({
        column: col,
        direction: ['ASC', 'DESC'].includes(dir) ? (dir as any) : 'ASC',
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
  if (expensiveSort && limit > 2000) {
    return {
      status: 400,
      error:
        'Query plan check would be too expensive. Please reduce limit to <= 2000 for expensive sorts, or use an indexed sort column (bssid, last_seen, first_observed_at, observed_at, ssid, signal, obs_count, distance_from_home_km, max_distance_meters).',
    };
  }

  const sortClauses = sortEntries
    .map((entry) => `${sortColumnMap[entry.column]} ${entry.direction}`)
    .join(', ');

  let homeLocation: { lat: number; lon: number } | null = null;
  try {
    homeLocation = await getHomeLocation();
  } catch (err: any) {
    logger.warn('Could not fetch home location', { error: err.message });
  }

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
    // Aggregate notes_count in a single JOIN instead of a correlated subquery per row
    'LEFT JOIN (SELECT bssid, COUNT(*) AS notes_count FROM app.network_notes GROUP BY bssid) nn ON nn.bssid = ne.bssid',
  ];

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  const appliedFiltersArray: Array<{ column: string; value?: unknown; range?: [number, number] }> =
    [];

  const addCondition = (condition: string, value: unknown) => {
    conditions.push(condition);
    params.push(value);
    paramIndex++;
  };

  if (ssidPattern !== null) {
    addCondition(`ne.ssid ILIKE $${paramIndex}`, `%${escapeLikePattern(ssidPattern)}%`);
    appliedFiltersArray.push({ column: 'ssid', value: ssidPattern });
  }
  if (bssidList && bssidList.length > 0) {
    conditions.push(`ne.bssid = ANY($${paramIndex}::text[])`);
    params.push(bssidList);
    paramIndex++;
    appliedFiltersArray.push({ column: 'bssid', value: bssidList });
  }
  if (threatLevel !== null) {
    addCondition(`(${threatLevelExpr}) = $${paramIndex}`, threatLevel);
    appliedFiltersArray.push({ column: 'threatLevel', value: threatLevel });
  }
  if (threatCategories && threatCategories.length > 0) {
    addCondition(`(${threatLevelExpr}) = ANY($${paramIndex}::text[])`, threatCategories);
    appliedFiltersArray.push({ column: 'threatCategories', value: threatCategories });
  }
  if (threatScoreMin !== null) {
    addCondition(`${threatScoreExpr} >= $${paramIndex}`, threatScoreMin);
  }
  if (threatScoreMax !== null) {
    addCondition(`${threatScoreExpr} <= $${paramIndex}`, threatScoreMax);
  }
  if (threatScoreMin !== null || threatScoreMax !== null) {
    appliedFiltersArray.push({
      column: 'threatScore',
      range: [threatScoreMin ?? -100, threatScoreMax ?? 100],
    });
  }
  if (lastSeen !== null) {
    addCondition(`ne.last_seen >= $${paramIndex}`, lastSeen);
    appliedFiltersArray.push({ column: 'lastSeen', value: lastSeen });
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
    appliedFiltersArray.push({
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
    appliedFiltersArray.push({ column: 'rssi', range: [minSignal ?? -100, maxSignal ?? 0] });
  }
  if (minObsCount !== null) {
    addCondition(`ne.observations >= $${paramIndex}`, minObsCount);
  }
  if (maxObsCount !== null) {
    addCondition(`ne.observations <= $${paramIndex}`, maxObsCount);
  }
  if (minObsCount !== null || maxObsCount !== null) {
    appliedFiltersArray.push({
      column: 'obsCount',
      range: [minObsCount ?? 0, maxObsCount ?? 1000000],
    });
  }
  if (radioTypes && radioTypes.length > 0) {
    conditions.push(`(${typeExpr}) = ANY($${paramIndex}::text[])`);
    params.push(radioTypes);
    paramIndex++;
    appliedFiltersArray.push({ column: 'radioTypes', value: radioTypes });
  }
  if (encryptionTypes && encryptionTypes.length > 0) {
    const encResult = buildEncryptionTypeCondition(encryptionTypes, paramIndex);
    if (encResult) {
      conditions.push(encResult.sql);
      params.push(...encResult.params);
      paramIndex += encResult.params.length;
    }
    appliedFiltersArray.push({ column: 'encryptionTypes', value: encryptionTypes });
  }
  if (authMethods && authMethods.length > 0) {
    const authResult = buildAuthMethodCondition(authMethods, paramIndex);
    if (authResult) {
      conditions.push(authResult.sql);
      params.push(...authResult.params);
      paramIndex += authResult.params.length;
    }
    appliedFiltersArray.push({ column: 'authMethods', value: authMethods });
  }
  if (insecureFlags && insecureFlags.length > 0) {
    conditions.push(`(ne.insecure_flags && $${paramIndex}::text[])`);
    params.push(insecureFlags);
    paramIndex++;
    appliedFiltersArray.push({ column: 'insecureFlags', value: insecureFlags });
  }
  if (securityFlags && securityFlags.length > 0) {
    conditions.push(`(ne.security_flags && $${paramIndex}::text[])`);
    params.push(securityFlags);
    paramIndex++;
    appliedFiltersArray.push({ column: 'securityFlags', value: securityFlags });
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
    appliedFiltersArray.push({ column: 'manufacturer', value: manufacturer });
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
    const dataQuery = `
      SELECT
        ${columnsWithDistance.join(',\n')}
      FROM app.api_network_explorer_mv ne
      ${joins.join('\n')}
      ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
      ORDER BY ${sortClauses}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataParams = [...params, limit, offset];
    return {
      query: dataQuery,
      params: dataParams,
      plan,
      total,
      count: rows.length,
      applied_filters: [...appliedFiltersArray, ...sortEntries],
      ignoredSorts,
    };
  }

  return {
    networks: rows,
    total,
    count: rows.length,
    limit,
    offset,
    appliedFilters: [...appliedFiltersArray, ...sortEntries],
    ignoredSorts,
  };
}

export async function getNetworkCount(
  conditions: string[],
  params: unknown[],
  joins: string[]
): Promise<number> {
  const totalCountQuery = `
    SELECT COUNT(DISTINCT ne.bssid) AS total
    FROM app.api_network_explorer_mv ne
    ${joins.join('\n')}
    ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
  `;

  const totalResult = await query(totalCountQuery, params);
  return parseInt(totalResult.rows[0]?.total || '0', 10);
}

export async function listNetworks(
  selectColumns: string[],
  joins: string[],
  conditions: string[],
  params: unknown[],
  sortClauses: string,
  limit: number,
  offset: number,
  paramIndex: number
): Promise<any[]> {
  const dataQuery = `
    SELECT
      ${selectColumns.join(',\n')}
    FROM app.api_network_explorer_mv ne
    ${joins.join('\n')}
    ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
    ORDER BY ${sortClauses}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataParams = [...params, limit, offset];
  const dataResult = await query(dataQuery, dataParams);
  return dataResult.rows.map((row: any) => {
    const typedRow = { ...row };
    if (row.type === '?') {
      typedRow.type = null;
    }
    return typedRow;
  });
}

export async function explainQuery(
  selectColumns: string[],
  joins: string[],
  conditions: string[],
  params: unknown[],
  sortClauses: string,
  limit: number,
  offset: number,
  paramIndex: number
): Promise<any> {
  const dataQuery = `
    SELECT
      ${selectColumns.join(',\n')}
    FROM app.api_network_explorer_mv ne
    ${joins.join('\n')}
    ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
    ORDER BY ${sortClauses}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataParams = [...params, limit, offset];
  const explained = await query(`EXPLAIN (FORMAT JSON) ${dataQuery}`, dataParams);
  return explained.rows;
}

export async function searchNetworksBySSID(searchPattern: string): Promise<any[]> {
  // Use the pre-aggregated MV instead of joining raw observations (avoids N+1 GROUP BY).
  // Keep the result shape aligned with the prior implementation.
  const { rows } = await query(
    `SELECT bssid, ssid, type, security AS encryption, signal,
            last_seen AS lasttime, observations AS observation_count
     FROM app.api_network_explorer_mv
     WHERE ssid ILIKE $1
     ORDER BY observations DESC LIMIT 50`,
    [searchPattern]
  );
  return rows;
}

export async function getManufacturerByBSSID(prefix: string): Promise<any | null> {
  const { rows } = await query(
    `SELECT oui_prefix_24bit as prefix, organization_name as manufacturer, organization_address as address
     FROM app.radio_manufacturers WHERE oui_prefix_24bit = $1 LIMIT 1`,
    [prefix]
  );
  return rows.length > 0 ? rows[0] : null;
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
