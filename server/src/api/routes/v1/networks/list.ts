/**
 * Networks List Routes
 * GET /networks - List all networks with pagination and filtering
 */

export {};
const express = require('express');
const router = express.Router();
const { networkService, filterQueryBuilder } = require('../../../../config/container');
const { escapeLikePattern } = require('../../../../utils/escapeSQL');
const { safeJsonParse } = require('../../../../utils/safeJsonParse');
const logger = require('../../../../logging/logger');
const { cacheMiddleware } = require('../../../../middleware/cacheMiddleware');
const {
  validateBSSID,
  validateBSSIDList,
  validateConfidence,
  validateEnum,
  validateMACAddress,
  validateNetworkIdentifier,
  validateNumberRange,
  validateString,
} = require('../../../../validation/schemas');
const {
  parseRequiredInteger,
  parseOptionalNumber,
  parseOptionalInteger,
  parseCommaList,
  parseBoundingBoxParams,
  parseRadiusParams,
} = require('../../../../validation/parameterParsers');
const { NETWORK_CHANNEL_EXPR } = filterQueryBuilder;

const VALID_TAG_TYPES = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];

// GET /api/networks - List all networks with pagination and filtering
router.get('/networks', cacheMiddleware(60), async (req, res, next) => {
  try {
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;
    const threatLevelRaw = req.query.threat_level;
    const threatCategoriesRaw = req.query.threat_categories;
    const threatScoreMinRaw = req.query.threat_score_min;
    const threatScoreMaxRaw = req.query.threat_score_max;
    const lastSeenRaw = req.query.last_seen;
    const distanceRaw = req.query.distance_from_home_km;
    const distanceMinRaw = req.query.distance_from_home_km_min;
    const distanceMaxRaw = req.query.distance_from_home_km_max;
    const minSignalRaw = req.query.min_signal;
    const maxSignalRaw = req.query.max_signal;
    const minObsRaw = req.query.min_obs_count;
    const maxObsRaw = req.query.max_obs_count;
    const ssidRaw = req.query.ssid;
    const bssidRaw = req.query.bssid;
    const radioTypesRaw = req.query.radioTypes;
    const encryptionTypesRaw = req.query.encryptionTypes;
    const authMethodsRaw = req.query.authMethods;
    const insecureFlagsRaw = req.query.insecureFlags;
    const securityFlagsRaw = req.query.securityFlags;
    const quickSearchRaw = req.query.q;
    const sortRaw = req.query.sort || 'last_seen';
    const orderRaw = req.query.order || 'DESC';

    const planCheck = req.query.planCheck === '1';
    const _qualityFilter = req.query.quality_filter;

    // Spatial filter parameters
    const bboxMinLatRaw = req.query.bbox_min_lat;
    const bboxMaxLatRaw = req.query.bbox_max_lat;
    const bboxMinLngRaw = req.query.bbox_min_lng;
    const bboxMaxLngRaw = req.query.bbox_max_lng;
    const radiusCenterLatRaw = req.query.radius_center_lat;
    const radiusCenterLngRaw = req.query.radius_center_lng;
    const radiusMetersRaw = req.query.radius_meters;

    const locationModeRaw = String(req.query.location_mode || 'latest_observation');
    const locationMode = [
      'latest_observation',
      'centroid',
      'weighted_centroid',
      'triangulated',
    ].includes(locationModeRaw)
      ? locationModeRaw
      : 'latest_observation';

    const limitResult = parseRequiredInteger(
      limitRaw,
      1,
      1000,
      'limit',
      'Missing limit parameter.',
      'Invalid limit parameter. Must be between 1 and 1000.'
    );
    if (!limitResult.ok) {
      return res.status(400).json({ error: limitResult.error });
    }

    const offsetResult = parseRequiredInteger(
      offsetRaw,
      0,
      10000000,
      'offset',
      'Missing offset parameter.',
      'Invalid offset parameter. Must be >= 0.'
    );
    if (!offsetResult.ok) {
      return res.status(400).json({ error: offsetResult.error });
    }

    const limit = limitResult.value;
    const offset = offsetResult.value;

    let threatLevel = null;
    let threatCategories = null;
    let threatScoreMin = null;
    let threatScoreMax = null;

    if (threatLevelRaw !== undefined) {
      const validation = validateEnum(
        threatLevelRaw,
        ['NONE', 'LOW', 'MED', 'HIGH', 'CRITICAL'],
        'threat_level'
      );
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid threat_level parameter. Must be NONE, LOW, MED, HIGH, or CRITICAL.',
        });
      }
      threatLevel = validation.value;
    }

    if (threatCategoriesRaw !== undefined) {
      try {
        const categories = Array.isArray(threatCategoriesRaw)
          ? threatCategoriesRaw
          : safeJsonParse(threatCategoriesRaw);
        if (Array.isArray(categories) && categories.length > 0) {
          const threatLevelMap = {
            critical: 'CRITICAL',
            high: 'HIGH',
            medium: 'MED',
            low: 'LOW',
          };
          threatCategories = categories.map((cat) => threatLevelMap[cat]).filter(Boolean);
        }
      } catch {
        return res
          .status(400)
          .json({ error: 'Invalid threat_categories parameter. Must be JSON array.' });
      }
    }

    if (threatScoreMinRaw !== undefined) {
      const validation = validateNumberRange(threatScoreMinRaw, 0, 100, 'threat_score_min');
      if (!validation.valid) {
        return res
          .status(400)
          .json({ error: 'Invalid threat_score_min parameter. Must be 0-100.' });
      }
      threatScoreMin = validation.value;
    }

    if (threatScoreMaxRaw !== undefined) {
      const validation = validateNumberRange(threatScoreMaxRaw, 0, 100, 'threat_score_max');
      if (!validation.valid) {
        return res
          .status(400)
          .json({ error: 'Invalid threat_score_max parameter. Must be 0-100.' });
      }
      threatScoreMax = validation.value;
    }

    let lastSeen = null;
    if (lastSeenRaw !== undefined) {
      const parsed = new Date(lastSeenRaw);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Invalid last_seen parameter.' });
      }
      lastSeen = parsed.toISOString();
    }

    const distanceResult = parseOptionalNumber(
      distanceRaw,
      0,
      Number.MAX_SAFE_INTEGER,
      'distance_from_home_km'
    );
    if (!distanceResult.ok) {
      return res
        .status(400)
        .json({ error: 'Invalid distance_from_home_km parameter. Must be >= 0.' });
    }
    const distanceFromHomeKm = distanceResult.value;

    const distanceMinResult = parseOptionalNumber(
      distanceMinRaw,
      0,
      Number.MAX_SAFE_INTEGER,
      'distance_from_home_km_min'
    );
    if (!distanceMinResult.ok) {
      return res
        .status(400)
        .json({ error: 'Invalid distance_from_home_km_min parameter. Must be >= 0.' });
    }
    const distanceFromHomeMinKm = distanceMinResult.value;

    const distanceMaxResult = parseOptionalNumber(
      distanceMaxRaw,
      0,
      Number.MAX_SAFE_INTEGER,
      'distance_from_home_km_max'
    );
    if (!distanceMaxResult.ok) {
      return res
        .status(400)
        .json({ error: 'Invalid distance_from_home_km_max parameter. Must be >= 0.' });
    }
    const distanceFromHomeMaxKm = distanceMaxResult.value;

    const bboxResult = parseBoundingBoxParams(
      bboxMinLatRaw,
      bboxMaxLatRaw,
      bboxMinLngRaw,
      bboxMaxLngRaw
    );
    const bboxMinLat = bboxResult.value?.minLat ?? null;
    const bboxMaxLat = bboxResult.value?.maxLat ?? null;
    const bboxMinLng = bboxResult.value?.minLng ?? null;
    const bboxMaxLng = bboxResult.value?.maxLng ?? null;

    const radiusResult = parseRadiusParams(radiusCenterLatRaw, radiusCenterLngRaw, radiusMetersRaw);
    const radiusCenterLat = radiusResult.value?.centerLat ?? null;
    const radiusCenterLng = radiusResult.value?.centerLng ?? null;
    const radiusMeters = radiusResult.value?.radius ?? null;

    const minSignalResult = parseOptionalInteger(
      minSignalRaw,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      'min_signal'
    );
    if (!minSignalResult.ok) {
      return res.status(400).json({ error: 'Invalid min_signal parameter.' });
    }
    const minSignal = minSignalResult.value;

    const maxSignalResult = parseOptionalInteger(
      maxSignalRaw,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      'max_signal'
    );
    if (!maxSignalResult.ok) {
      return res.status(400).json({ error: 'Invalid max_signal parameter.' });
    }
    const maxSignal = maxSignalResult.value;

    const minObsResult = parseOptionalInteger(minObsRaw, 0, 100000000, 'min_obs_count');
    if (!minObsResult.ok) {
      return res.status(400).json({ error: 'Invalid min_obs_count parameter.' });
    }
    const minObsCount = minObsResult.value !== null ? minObsResult.value : 1;

    const maxObsResult = parseOptionalInteger(maxObsRaw, 0, 100000000, 'max_obs_count');
    if (!maxObsResult.ok) {
      return res.status(400).json({ error: 'Invalid max_obs_count parameter.' });
    }
    const maxObsCount = maxObsResult.value;

    let radioTypes = null;
    if (radioTypesRaw !== undefined) {
      const values = parseCommaList(radioTypesRaw, 20);
      if (values && values.length > 0) {
        radioTypes = values.map((value) => value.toUpperCase());
      }
    }

    const wifiTypes = new Set(['W', 'B', 'E']);
    const cellularTypes = new Set(['G', 'C', 'D', 'L', 'N', 'F']);
    const isWifiOnly =
      Array.isArray(radioTypes) &&
      radioTypes.length > 0 &&
      radioTypes.every((type) => wifiTypes.has(type));
    const hasCellular =
      Array.isArray(radioTypes) && radioTypes.some((type) => cellularTypes.has(type));
    const requireMacForBssid = isWifiOnly && !hasCellular;

    let encryptionTypes = null;
    if (encryptionTypesRaw !== undefined) {
      const values = parseCommaList(encryptionTypesRaw, 50);
      if (values && values.length > 0) {
        encryptionTypes = values;
      }
    }
    let authMethods = null;
    if (authMethodsRaw !== undefined) {
      const values = parseCommaList(authMethodsRaw, 20);
      if (values && values.length > 0) {
        authMethods = values;
      }
    }
    let insecureFlags = null;
    if (insecureFlagsRaw !== undefined) {
      const values = parseCommaList(insecureFlagsRaw, 20);
      if (values && values.length > 0) {
        insecureFlags = values;
      }
    }
    let securityFlags = null;
    if (securityFlagsRaw !== undefined) {
      const values = parseCommaList(securityFlagsRaw, 20);
      if (values && values.length > 0) {
        securityFlags = values;
      }
    }

    const typeExpr = `
      CASE
        WHEN ne.type IS NOT NULL AND ne.type <> '?' THEN
          CASE
            WHEN UPPER(ne.type) IN ('W', 'WIFI', 'WI-FI') THEN 'W'
            WHEN UPPER(ne.type) IN ('E', 'BLE', 'BTLE', 'BLUETOOTHLE', 'BLUETOOTH_LOW_ENERGY') THEN 'E'
            WHEN UPPER(ne.type) IN ('B', 'BT', 'BLUETOOTH') THEN 'B'
            WHEN UPPER(ne.type) IN ('L', 'LTE', '4G') THEN 'L'
            WHEN UPPER(ne.type) IN ('N', 'NR', '5G') THEN 'N'
            WHEN UPPER(ne.type) IN ('G', 'GSM', '2G') THEN 'G'
            WHEN UPPER(ne.type) IN ('C', 'CDMA') THEN 'C'
            WHEN UPPER(ne.type) IN ('D', '3G', 'UMTS') THEN 'D'
            WHEN UPPER(ne.type) IN ('F', 'NFC') THEN 'F'
            ELSE UPPER(ne.type)
          END
        WHEN ne.frequency BETWEEN 2412 AND 7125 THEN 'W'
        WHEN COALESCE(ne.security, '') ~* '(WPA|WEP|ESS|RSN|CCMP|TKIP|OWE|SAE)' THEN 'W'
        WHEN COALESCE(ne.security, '') ~* '(BLE|BTLE|BLUETOOTH.?LOW.?ENERGY)' THEN 'E'
        WHEN COALESCE(ne.security, '') ~* '(BLUETOOTH)' THEN 'B'
        ELSE '?'
      END
    `;
    const channelExpr = NETWORK_CHANNEL_EXPR('ne');

    const threatScoreExpr = `COALESCE(
      CASE 
        WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 0
        WHEN nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_score, 0)::numeric
        WHEN nt.threat_tag = 'THREAT' THEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3)
        ELSE (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3)
      END,
      0
    )`;

    const threatLevelExpr = `CASE
      WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'
      WHEN nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_level, 'NONE')
      ELSE (
        CASE
          WHEN ${threatScoreExpr} >= 80 THEN 'CRITICAL'
          WHEN ${threatScoreExpr} >= 60 THEN 'HIGH'
          WHEN ${threatScoreExpr} >= 40 THEN 'MED'
          WHEN ${threatScoreExpr} >= 20 THEN 'LOW'
          ELSE 'NONE'
        END
      )
    END`;

    const threatOrderExpr = `CASE ${threatLevelExpr}
      WHEN 'CRITICAL' THEN 4
      WHEN 'HIGH' THEN 3
      WHEN 'MED' THEN 2
      WHEN 'LOW' THEN 1
      ELSE 0
    END`;

    const sortColumnMap = {
      last_seen: 'ne.last_seen',
      last_observed_at: 'ne.last_seen',
      first_observed_at: 'ne.first_seen',
      observed_at: 'ne.observed_at',
      ssid: 'lower(ne.ssid)',
      bssid: 'ne.bssid',
      type: typeExpr,
      security: 'ne.security',
      signal: 'ne.signal',
      frequency: 'ne.frequency',
      channel: channelExpr,
      obs_count: 'ne.observations',
      observations: 'ne.observations',
      distance_from_home_km: 'distance_from_home_km',
      accuracy_meters: 'ne.accuracy_meters',
      avg_signal: 'ne.signal',
      min_signal: 'ne.signal',
      max_signal: 'ne.signal',
      unique_days: 'ne.unique_days',
      unique_locations: 'ne.unique_locations',
      threat: threatOrderExpr,
      threat_score: `(${threatScoreExpr})::numeric`,
      threat_rule_score: "COALESCE((nts.ml_feature_values->>'rule_score')::numeric, 0)",
      threat_ml_score: "COALESCE((nts.ml_feature_values->>'ml_score')::numeric, 0)",
      threat_ml_weight: "COALESCE((nts.ml_feature_values->>'evidence_weight')::numeric, 0)",
      threat_ml_boost: "COALESCE((nts.ml_feature_values->>'ml_boost')::numeric, 0)",
      threat_level: threatOrderExpr,
      lat: 'ne.lat',
      lon: 'ne.lon',
      manufacturer: 'lower(rm.manufacturer)',
      manufacturer_address: 'lower(rm.address)',
      capabilities: 'ne.security',
      min_altitude_m: 'ne.min_altitude_m',
      max_altitude_m: 'ne.max_altitude_m',
      altitude_span_m: 'ne.altitude_span_m',
      max_distance_meters: 'COALESCE(mv.max_distance_meters, 0)',
      last_altitude_m: 'ne.last_altitude_m',
      is_sentinel: 'ne.is_sentinel',
      timespan_days: 'EXTRACT(EPOCH FROM (ne.last_seen - ne.first_seen)) / 86400.0',
    };

    const parseSortJson = (value) => {
      return safeJsonParse(value);
    };
    const parseOrderColumns = (value) =>
      String(value)
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);

    const parsedSortJson = parseSortJson(sortRaw);
    const parsedOrderJson = parseSortJson(orderRaw);

    const sortEntries = [];
    const ignoredSorts = [];

    if (Array.isArray(parsedSortJson) || (parsedSortJson && typeof parsedSortJson === 'object')) {
      const entries = Array.isArray(parsedSortJson) ? parsedSortJson : [parsedSortJson];
      entries.forEach((entry) => {
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
        sortEntries.push({ column, direction: ['ASC', 'DESC'].includes(dir) ? dir : 'ASC' });
      });
    } else {
      const sortColumns = String(sortRaw)
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      const orderColumns = Array.isArray(parsedOrderJson)
        ? parsedOrderJson.map((v) => String(v).trim().toUpperCase())
        : parseOrderColumns(orderRaw);

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
          direction: ['ASC', 'DESC'].includes(dir) ? dir : 'ASC',
        });
      });
    }

    if (sortEntries.length === 0) {
      sortEntries.push({ column: 'last_seen', direction: 'DESC' });
    }

    const indexedSorts = new Set([
      'bssid',
      'last_seen',
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
      return res.status(400).json({
        error:
          'Query plan check would be too expensive. Please reduce limit to <= 2000 for expensive sorts, or use an indexed sort column (bssid, last_seen, first_observed_at, observed_at, ssid, signal, obs_count, distance_from_home_km, max_distance_meters).',
      });
    }

    const sortClauses = sortEntries
      .map((entry) => {
        const col = sortColumnMap[entry.column];
        return `${col} ${entry.direction}`;
      })
      .join(', ');

    let ssidPattern = null;
    if (ssidRaw !== undefined) {
      const validation = validateString(ssidRaw, 100, 'ssid');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid ssid parameter.' });
      }
      ssidPattern = validation.value;
    }

    let bssidList = null;
    if (bssidRaw !== undefined) {
      const validation = validateBSSIDList(bssidRaw, 1000);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      bssidList = validation.value;
    }

    let quickSearchPattern = null;
    if (quickSearchRaw !== undefined) {
      const validation = validateString(quickSearchRaw, 100, 'q');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid q parameter.' });
      }
      quickSearchPattern = validation.value;
    }

    let homeLocation: { lat: number; lon: number } | null = null;
    try {
      homeLocation = await networkService.getHomeLocation();
    } catch (err) {
      logger.warn('Could not fetch home location', { error: err.message });
    }

    const selectColumns = [
      'ne.bssid',
      'ne.ssid',
      `TRIM(ne.type) AS type`,
      `ne.frequency`,
      `ne.signal`,
      `ne.lat`,
      `ne.lon`,
      `ne.last_seen AS last_observed_at`,
      `ne.first_seen AS first_observed_at`,
      `ne.observed_at`,
      `ne.observations AS obs_count`,
      `ne.accuracy_meters`,
      `ne.security`,
      `ne.channel`,
      `ne.wps`,
      `ne.battery`,
      `ne.altitude_m`,
      `ne.min_altitude_m`,
      `ne.max_altitude_m`,
      `ne.altitude_accuracy_m`,
      `COALESCE(mv.max_distance_meters, 0) AS max_distance_meters`,
      `ne.last_altitude_m`,
      `ne.unique_days`,
      `ne.unique_locations`,
      `ne.is_sentinel`,
      `rm.manufacturer`,
      `rm.address`,
      `nts.final_threat_score`,
      `nts.final_threat_level`,
      `nts.rule_based_score`,
      `nts.ml_threat_score`,
      `nts.model_version`,
    ];

    const distanceExpr =
      homeLocation !== null
        ? `
        (
          SELECT MAX(ST_Distance(
            ST_MakePoint(${homeLocation.lon}, ${homeLocation.lat})::geography,
            ST_MakePoint(o.lon, o.lat)::geography
          )) / 1000
          FROM app.observations o
          WHERE o.bssid = ne.bssid
            AND o.lat IS NOT NULL AND o.lon IS NOT NULL
            AND o.lat != 0 AND o.lon != 0
        )`
        : 'NULL';

    const columnsWithDistance =
      homeLocation !== null
        ? [...selectColumns, `(${distanceExpr})::numeric(10,4) AS distance_from_home_km`]
        : selectColumns;

    const countColumns = ['ne.bssid'];

    const joins = [
      `LEFT JOIN app.radio_manufacturers rm ON ne.oui = rm.oui`,
      `LEFT JOIN app.network_tags nt ON ne.bssid = nt.bssid`,
      `LEFT JOIN app.network_threat_scores nts ON ne.bssid = nts.bssid`,
      `LEFT JOIN app.api_network_explorer_mv mv ON ne.bssid = mv.bssid`,
    ];

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const addCondition = (condition: string, value: unknown) => {
      conditions.push(condition);
      params.push(value);
      paramIndex++;
    };

    if (ssidPattern !== null) {
      const escapedPattern = escapeLikePattern(ssidPattern);
      addCondition(`ne.ssid ILIKE $${paramIndex}`, `%${escapedPattern}%`);
    }

    if (bssidList !== null && bssidList.length > 0) {
      conditions.push(`ne.bssid = ANY($${paramIndex}::text[])`);
      params.push(bssidList);
      paramIndex++;
    }

    if (threatLevel !== null) {
      addCondition(`(${threatLevelExpr}) = $${paramIndex}`, threatLevel);
    }

    if (threatCategories !== null && threatCategories.length > 0) {
      addCondition(`nt.threat_category = ANY($${paramIndex}::text[])`, threatCategories);
    }

    if (threatScoreMin !== null) {
      addCondition(`${threatScoreExpr} >= $${paramIndex}`, threatScoreMin);
    }

    if (threatScoreMax !== null) {
      addCondition(`${threatScoreExpr} <= $${paramIndex}`, threatScoreMax);
    }

    if (lastSeen !== null) {
      addCondition(`ne.last_seen >= $${paramIndex}`, lastSeen);
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

    if (minSignal !== null) {
      addCondition(`ne.signal >= $${paramIndex}`, minSignal);
    }

    if (maxSignal !== null) {
      addCondition(`ne.signal <= $${paramIndex}`, maxSignal);
    }

    if (minObsCount !== null) {
      addCondition(`ne.observations >= $${paramIndex}`, minObsCount);
    }

    if (maxObsCount !== null) {
      addCondition(`ne.observations <= $${paramIndex}`, maxObsCount);
    }

    if (radioTypes !== null && radioTypes.length > 0) {
      if (radioTypes.includes('W')) {
        conditions.push(`(${typeExpr}) = 'W'`);
      } else if (radioTypes.length > 0) {
        const radioConditions = radioTypes.map((rt) => `(${typeExpr}) = '${rt}'`);
        conditions.push(`(${radioConditions.join(' OR ')})`);
      }
    }

    if (encryptionTypes !== null && encryptionTypes.length > 0) {
      const encConditions = encryptionTypes.map((enc) => {
        if (enc === 'WEP') {
          return `ne.security ILIKE '%WEP%'`;
        } else if (enc === 'WPA') {
          return `(ne.security ILIKE '%WPA%' OR ne.security ILIKE '%WPA2%' OR ne.security ILIKE '%WPA3%' OR ne.security ILIKE '%WPA%')`;
        } else if (enc === 'WPA2') {
          return `ne.security ILIKE '%WPA2%'`;
        } else if (enc === 'WPA3') {
          return `ne.security ILIKE '%WPA3%'`;
        } else if (enc === 'OWE') {
          return `ne.security ILIKE '%OWE%'`;
        } else if (enc === 'SAE') {
          return `ne.security ILIKE '%SAE%'`;
        } else if (enc === 'NONE') {
          return `(ne.security IS NULL OR ne.security = '' OR ne.security ILIKE '%NONE%' OR ne.security !~* '(WPA|WEP|ESS|RSN|CCMP|TKIP|OWE|SAE)')`;
        } else {
          return `ne.security ILIKE '%${enc.replace(/'/g, "''")}%'`;
        }
      });
      conditions.push(`(${encConditions.join(' OR ')})`);
    }

    if (authMethods !== null && authMethods.length > 0) {
      const authConditions = authMethods.map((auth) => {
        if (auth === 'NONE') {
          return `(ne.auth IS NULL OR ne.auth = '' OR ne.auth ILIKE '%NONE%')`;
        } else {
          return `ne.auth ILIKE '%${auth.replace(/'/g, "''")}%'`;
        }
      });
      conditions.push(`(${authConditions.join(' OR ')})`);
    }

    if (insecureFlags !== null && insecureFlags.length > 0) {
      conditions.push(`(ne.insecure_flags && $${paramIndex}::text[])`);
      params.push(insecureFlags);
      paramIndex++;
    }

    if (securityFlags !== null && securityFlags.length > 0) {
      conditions.push(`(ne.security_flags && $${paramIndex}::text[])`);
      params.push(securityFlags);
      paramIndex++;
    }

    if (quickSearchPattern !== null) {
      const escapedQuickSearch = escapeLikePattern(quickSearchPattern);
      const quickSearchCondition = `
        (ne.ssid ILIKE $${paramIndex} OR ne.bssid ILIKE $${paramIndex} OR rm.manufacturer ILIKE $${paramIndex})
      `;
      conditions.push(quickSearchCondition);
      params.push(`%${escapedQuickSearch}%`);
      paramIndex++;
    }

    if (
      locationMode === 'centroid' ||
      locationMode === 'weighted_centroid' ||
      locationMode === 'triangulated'
    ) {
      joins.push(
        `STATIC JOIN (SELECT bssid, ${locationMode === 'weighted_centroid' ? 'weighted' : locationMode === 'triangulated' ? 'triangulated' : 'centroid'}_lat AS lat, ${locationMode === 'weighted_centroid' ? 'weighted' : locationMode === 'triangulated' ? 'triangulated' : 'centroid'}_lon AS lon FROM app.network_locations WHERE bssid = ne.bssid) AS nl ON ne.bssid = nl.bssid`
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
        joins.push(`STATIC JOIN app.network_locations nl ON ne.bssid = nl.bssid`);
        conditions.push(`nl.lat BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(bboxMinLat, bboxMaxLat);
        paramIndex += 2;
        conditions.push(`nl.lon BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(bboxMinLng, bboxMaxLng);
        paramIndex += 2;
      }
    }

    if (radiusCenterLat !== null && radiusCenterLng !== null && radiusMeters !== null) {
      const radiusExpr = `
        (
          ST_Distance(
            ST_MakePoint($${paramIndex + 1}, $${paramIndex})::geography,
            ST_MakePoint(ne.lon, ne.lat)::geography
          ) <= $${paramIndex + 2}
        )
      `;
      conditions.push(radiusExpr);
      params.push(radiusCenterLat, radiusCenterLng, radiusMeters);
      paramIndex += 3;
    }

    const total = await networkService.getNetworkCount(conditions, params, joins);

    const rows = await networkService.listNetworks(
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
      const plan = await networkService.explainQuery(
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
      FROM app.network_entries ne
      ${joins.join('\n')}
      ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
      ORDER BY ${sortClauses}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
      const dataParams = [...params, limit, offset];
      return res.json({
        query: dataQuery,
        params: dataParams,
        plan,
        total,
        count: rows.length,
        applied_filters: sortEntries,
        ignoredSorts,
      });
    }

    res.json({
      networks: rows,
      total,
      count: rows.length,
      limit,
      offset,
      appliedFilters: sortEntries,
      ignoredSorts,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
