export {};
/**
 * Networks Routes
 * Handles all network-related endpoints
 */

const express = require('express');
const router = express.Router();
const { pool, query } = require('../../../config/database');
const { escapeLikePattern } = require('../../../utils/escapeSQL');
const { safeJsonParse } = require('../../../utils/safeJsonParse');
const logger = require('../../../logging/logger');
const { cacheMiddleware } = require('../../../middleware/cacheMiddleware');
const {
  validateBSSID,
  validateBSSIDList,
  validateConfidence,
  validateEnum,
  validateMACAddress,
  validateNetworkIdentifier,
  validateNumberRange,
  validateString,
} = require('../../../validation/schemas');
const {
  parseRequiredInteger,
  parseOptionalNumber,
  parseOptionalInteger,
  parseCommaList,
  parseBoundingBoxParams,
  parseRadiusParams,
} = require('../../../validation/parameterParsers');
const { NETWORK_CHANNEL_EXPR } = require('../../../services/filterQueryBuilder/sqlExpressions');

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

    console.log('[SORT DEBUG] Received sort params:', { sortRaw, orderRaw });

    const planCheck = req.query.planCheck === '1';
    const _qualityFilter = req.query.quality_filter; // none, temporal, extreme, duplicate, all

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
          // Map frontend threat categories to database values
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
    // Default to min_obs_count=1 to exclude networks with no observations
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
      // Note: distance_from_home_km stores values in kilometers for database efficiency.
      // Frontend converts to meters for display consistency with other distance metrics.
      // This column is calculated in the SELECT clause, so we reference it without table prefix.
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
      max_distance_meters: 'ne.max_distance_meters',
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
        error: 'Limit must be <= 2000 for non-indexed or multi-column sorts.',
      });
    }

    // Define distance columns before using them in ORDER BY
    const distanceColumns = ['max_distance_meters', 'distance_from_home_km'];

    const orderByClause = `${sortEntries
      .map((entry) => {
        const col = sortColumnMap[entry.column];
        const dir = entry.direction;
        // For distance columns, always put NULLs last regardless of sort direction
        if (distanceColumns.includes(entry.column)) {
          return `${col} ${dir} NULLS LAST`;
        }
        return `${col} ${dir}`;
      })
      .join(', ')}, ne.bssid ASC`;

    const params = [];
    const whereClauses = [];

    // Filter out networks with no observations when sorting by distance-related columns
    const sortingByDistance = sortEntries.some((entry) => distanceColumns.includes(entry.column));
    if (sortingByDistance) {
      whereClauses.push('ne.observations > 0');
    }

    if (threatLevel !== null) {
      params.push(threatLevel);
      whereClauses.push(`${threatLevelExpr} = $${params.length}`);
    }

    if (threatCategories !== null && threatCategories.length > 0) {
      params.push(threatCategories);
      whereClauses.push(`${threatLevelExpr} = ANY($${params.length})`);
    }

    if (threatScoreMin !== null) {
      params.push(threatScoreMin);
      whereClauses.push(`${threatScoreExpr} >= $${params.length}`);
    }

    if (threatScoreMax !== null) {
      params.push(threatScoreMax);
      whereClauses.push(`${threatScoreExpr} <= $${params.length}`);
    }
    if (lastSeen !== null) {
      params.push(lastSeen);
      whereClauses.push(`last_seen >= $${params.length}::timestamptz`);
    }
    if (distanceFromHomeKm !== null) {
      params.push(distanceFromHomeKm);
      whereClauses.push(`ne.distance_from_home_km <= $${params.length}::numeric`);
    }
    if (distanceFromHomeMinKm !== null) {
      params.push(distanceFromHomeMinKm);
      whereClauses.push(`ne.distance_from_home_km >= $${params.length}::numeric`);
    }
    if (distanceFromHomeMaxKm !== null) {
      params.push(distanceFromHomeMaxKm);
      whereClauses.push(`ne.distance_from_home_km <= $${params.length}::numeric`);
    }
    if (minSignal !== null) {
      params.push(minSignal);
      whereClauses.push(`signal >= $${params.length}`);
    }
    if (maxSignal !== null) {
      params.push(maxSignal);
      whereClauses.push(`signal <= $${params.length}`);
    }
    if (minObsCount !== null) {
      params.push(minObsCount);
      whereClauses.push(`ne.observations >= $${params.length}`);
    }
    if (maxObsCount !== null) {
      params.push(maxObsCount);
      whereClauses.push(`obs_count <= $${params.length}`);
    }

    // Bounding box filter
    if (bboxMinLat !== null && bboxMaxLat !== null && bboxMinLng !== null && bboxMaxLng !== null) {
      params.push(bboxMinLat, bboxMaxLat, bboxMinLng, bboxMaxLng);
      const latCol =
        locationMode === 'latest_observation' || locationMode === 'triangulated' ? 'lat' : 'ne.lat';
      const lonCol =
        locationMode === 'latest_observation' || locationMode === 'triangulated' ? 'lon' : 'ne.lon';
      whereClauses.push(
        `${latCol} >= $${params.length - 3} AND ${latCol} <= $${params.length - 2} AND ${lonCol} >= $${params.length - 1} AND ${lonCol} <= $${params.length}`
      );
    }

    // Radius filter using PostGIS
    if (radiusCenterLat !== null && radiusCenterLng !== null && radiusMeters !== null) {
      params.push(radiusCenterLng, radiusCenterLat, radiusMeters);
      const latCol =
        locationMode === 'latest_observation' || locationMode === 'triangulated' ? 'lat' : 'ne.lat';
      const lonCol =
        locationMode === 'latest_observation' || locationMode === 'triangulated' ? 'lon' : 'ne.lon';
      whereClauses.push(
        `ST_DWithin(ST_Point(${lonCol}, ${latCol})::geography, ST_Point($${params.length - 2}, $${params.length - 1})::geography, $${params.length})`
      );
    }

    if (ssidRaw !== undefined && ssidRaw !== '') {
      const validation = validateString(String(ssidRaw), 1, 256, 'ssid');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid ssid parameter.' });
      }
      const ssidSearch = String(ssidRaw).trim().toLowerCase().replace(/[%_]/g, '\\$&');
      params.push(`%${ssidSearch}%`);
      whereClauses.push(`lower(ne.ssid) LIKE $${params.length} ESCAPE '\\'`);
    }
    if (bssidRaw !== undefined && String(bssidRaw).trim() !== '') {
      const validator = requireMacForBssid ? validateMACAddress : validateNetworkIdentifier;
      const validation = validator(String(bssidRaw));
      if (!validation.valid) {
        return res.status(400).json({
          error: requireMacForBssid
            ? 'Invalid bssid parameter. Expected MAC address.'
            : 'Invalid bssid parameter.',
        });
      }

      const raw = validation.cleaned;
      const cleaned = raw.replace(/[^0-9A-F]/g, '');
      if (raw.length === 17 && raw.includes(':')) {
        params.push(raw);
        whereClauses.push(`upper(ne.bssid) = $${params.length}`);
      } else {
        const likeMac = `${raw.replace(/[%_]/g, '\\$&')}%`;
        const likeClean = `${cleaned}%`;
        params.push(likeMac, likeClean);
        whereClauses.push(
          `(upper(ne.bssid) LIKE $${params.length - 1} ESCAPE '\\' OR ` +
            `upper(replace(ne.bssid, ':', '')) LIKE $${params.length})`
        );
      }
    }
    if (radioTypes && radioTypes.length > 0) {
      params.push(radioTypes);
      whereClauses.push(`(${typeExpr}) = ANY($${params.length})`);
    }
    const computedSecurityExpr = `
      CASE
        WHEN COALESCE(ne.security, '') = '' THEN 'OPEN'
        WHEN UPPER(ne.security) ~ '^\\s*\\[ESS\\]\\s*$' THEN 'OPEN'
        WHEN UPPER(ne.security) ~ '^\\s*\\[IBSS\\]\\s*$' THEN 'OPEN'
        WHEN UPPER(ne.security) ~ 'RSN-OWE' THEN 'WPA3-OWE'
        WHEN UPPER(ne.security) ~ 'RSN-SAE' THEN 'WPA3-SAE'
        WHEN UPPER(ne.security) ~ '(WPA3|SAE)' AND UPPER(ne.security) ~ '(EAP|MGT)' THEN 'WPA3-E'
        WHEN UPPER(ne.security) ~ '(WPA3|SAE)' THEN 'WPA3'
        WHEN UPPER(ne.security) ~ '(WPA2|RSN)' AND UPPER(ne.security) ~ '(EAP|MGT)' THEN 'WPA2-E'
        WHEN UPPER(ne.security) ~ '(WPA2|RSN)' THEN 'WPA2'
        WHEN UPPER(ne.security) ~ 'WPA-' AND UPPER(ne.security) NOT LIKE '%WPA2%' THEN 'WPA'
        WHEN UPPER(ne.security) LIKE '%WPA%' AND UPPER(ne.security) NOT LIKE '%WPA2%' AND UPPER(ne.security) NOT LIKE '%WPA3%' AND UPPER(ne.security) NOT LIKE '%RSN%' THEN 'WPA'
        WHEN UPPER(ne.security) LIKE '%WEP%' THEN 'WEP'
        WHEN UPPER(ne.security) LIKE '%WPS%' AND UPPER(ne.security) NOT LIKE '%WPA%' AND UPPER(ne.security) NOT LIKE '%RSN%' THEN 'WPS'
        WHEN UPPER(ne.security) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
        ELSE 'Unknown'
      END
    `;

    if (encryptionTypes && encryptionTypes.length > 0) {
      const normalized = encryptionTypes
        .map((value) => String(value).trim().toUpperCase())
        .filter(Boolean);
      const clauses = [];
      if (normalized.includes('OPEN')) {
        clauses.push(`${computedSecurityExpr} = 'OPEN'`);
      }
      if (normalized.includes('WEP')) {
        clauses.push(`${computedSecurityExpr} = 'WEP'`);
      }
      if (normalized.includes('WPA3')) {
        clauses.push(`${computedSecurityExpr} IN ('WPA3', 'WPA3-SAE', 'WPA3-OWE', 'WPA3-E')`);
      }
      if (normalized.includes('WPA2')) {
        clauses.push(`${computedSecurityExpr} IN ('WPA2', 'WPA2-E')`);
      }
      if (normalized.includes('WPA')) {
        clauses.push(`${computedSecurityExpr} = 'WPA'`);
      }
      if (normalized.includes('MIXED')) {
        clauses.push(`${computedSecurityExpr} IN ('WPA2', 'WPA2-E', 'WPA3', 'WPA3-E')`);
      }
      if (clauses.length > 0) {
        whereClauses.push(`(${clauses.join(' OR ')})`);
      }
    }

    if (authMethods && authMethods.length > 0) {
      const normalized = authMethods
        .map((value) => String(value).trim().toUpperCase())
        .filter(Boolean);
      const clauses = [];
      if (normalized.includes('PSK')) {
        clauses.push(`${computedSecurityExpr} IN ('WPA', 'WPA2', 'WPA3', 'WPA3-SAE')`);
      }
      if (normalized.includes('ENTERPRISE')) {
        clauses.push(`${computedSecurityExpr} IN ('WPA2-E', 'WPA3-E')`);
      }
      if (normalized.includes('SAE')) {
        clauses.push(`${computedSecurityExpr} IN ('WPA3', 'WPA3-SAE')`);
      }
      if (normalized.includes('OWE')) {
        clauses.push(`${computedSecurityExpr} = 'WPA3-OWE'`);
      }
      if (normalized.includes('NONE')) {
        clauses.push(`${computedSecurityExpr} = 'OPEN'`);
      }
      if (clauses.length > 0) {
        whereClauses.push(`(${clauses.join(' OR ')})`);
      }
    }

    if (insecureFlags && insecureFlags.length > 0) {
      const normalized = insecureFlags
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean);
      const clauses = [];
      if (normalized.includes('open')) {
        clauses.push(`${computedSecurityExpr} = 'OPEN'`);
      }
      if (normalized.includes('wep')) {
        clauses.push(`${computedSecurityExpr} = 'WEP'`);
      }
      if (normalized.includes('wps')) {
        clauses.push(`${computedSecurityExpr} = 'WPS'`);
      }
      if (normalized.includes('deprecated')) {
        clauses.push(`${computedSecurityExpr} IN ('WEP', 'WPS')`);
      }
      if (clauses.length > 0) {
        whereClauses.push(`(${clauses.join(' OR ')})`);
      }
    }

    if (securityFlags && securityFlags.length > 0) {
      const normalized = securityFlags
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean);
      const clauses = [];
      if (normalized.includes('insecure')) {
        clauses.push(`${computedSecurityExpr} IN ('OPEN', 'WEP', 'WPS')`);
      }
      if (normalized.includes('deprecated')) {
        clauses.push(`${computedSecurityExpr} = 'WEP'`);
      }
      if (normalized.includes('enterprise')) {
        clauses.push(`${computedSecurityExpr} IN ('WPA2-E', 'WPA3-E')`);
      }
      if (normalized.includes('personal')) {
        clauses.push(`${computedSecurityExpr} IN ('WPA', 'WPA2', 'WPA3', 'WPA3-SAE')`);
      }
      if (normalized.includes('unknown')) {
        clauses.push(`${computedSecurityExpr} = 'Unknown'`);
      }
      if (clauses.length > 0) {
        whereClauses.push(`(${clauses.join(' OR ')})`);
      }
    }

    if (quickSearchRaw !== undefined && String(quickSearchRaw).trim() !== '') {
      const validation = validateString(String(quickSearchRaw), 1, 128, 'q');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid q parameter.' });
      }
      const search = String(quickSearchRaw).trim().toLowerCase();
      const like = `%${search.replace(/[%_]/g, '\\$&')}%`;
      const normalizedBssid = search.replace(/[^0-9a-f]/g, '');
      const likeBssid = normalizedBssid ? `%${normalizedBssid}%` : like;
      params.push(like, like, likeBssid);
      whereClauses.push(
        `(lower(ne.ssid) LIKE $${params.length - 2} ESCAPE '\\' OR ` +
          `lower(ne.bssid) LIKE $${params.length - 1} ESCAPE '\\' OR ` +
          `lower(replace(ne.bssid, ':', '')) LIKE $${params.length} ESCAPE '\\')`
      );
    }

    const baseSql = `
      SELECT
        ne.bssid,
        ne.ssid,
        ${typeExpr} AS type,
        ne.observed_at,
        ne.lat,
        ne.lon,
        ne.accuracy_meters,
        ne.signal,
        ne.frequency,
        ${channelExpr} AS channel,
        ne.security AS capabilities,
        ne.security,
        ne.observations as obs_count,
        ne.first_seen as first_observed_at,
        ne.last_seen as last_observed_at,
        ne.unique_days,
        ne.unique_locations,
        ne.signal as avg_signal,
        ne.signal as min_signal,
        ne.signal as max_signal,
        -- Blend ML score (70%) with manual tag confidence (30%)
        JSONB_BUILD_OBJECT(
          'score', (${threatScoreExpr})::text,
          'level', ${threatLevelExpr},
          'debug', nts.ml_feature_values
        ) AS threat,
        ne.distance_from_home_km,
        rm.manufacturer AS manufacturer,
        rm.address AS manufacturer_address,
        NULL AS min_altitude_m,
        NULL AS max_altitude_m,
        NULL AS altitude_span_m,
        ne.max_distance_meters,
        NULL AS last_altitude_m,
        FALSE AS is_sentinel
      FROM app.api_network_explorer_mv ne
      LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
      LEFT JOIN app.network_tags nt ON nt.bssid = ne.bssid AND nt.threat_tag IS NOT NULL
      LEFT JOIN app.radio_manufacturers rm ON rm.prefix = SUBSTRING(UPPER(REPLACE(ne.bssid, ':', '')), 1, 6)
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      ORDER BY ${orderByClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const sql =
      locationMode === 'latest_observation'
        ? `
      WITH latest_obs AS (
        SELECT DISTINCT ON (o.bssid)
          o.bssid,
          o.ssid,
          o.level AS signal,
          o.radio_frequency AS frequency,
          o.lat,
          o.lon,
          o.accuracy,
          o.time AS observed_at,
          o.radio_capabilities AS capabilities
        FROM app.observations o
        WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL
          ${lastSeen ? `AND o.time >= '${lastSeen}'` : ''}
        ORDER BY o.bssid, o.time DESC
      )
      SELECT
        ne.bssid,
        COALESCE(lo.ssid, ne.ssid) AS ssid,
        ${typeExpr} AS type,
        COALESCE(lo.observed_at, ne.observed_at) AS observed_at,
        COALESCE(lo.lat, ne.lat) AS lat,
        COALESCE(lo.lon, ne.lon) AS lon,
        COALESCE(lo.lat, ne.lat) AS raw_lat,
        COALESCE(lo.lon, ne.lon) AS raw_lon,
        COALESCE(lo.accuracy, ne.accuracy_meters) AS accuracy_meters,
        lo.signal,
        lo.frequency,
        CASE 
          WHEN lo.frequency IS NOT NULL THEN ${NETWORK_CHANNEL_EXPR('lo')}
          ELSE NULL
        END AS channel,
        COALESCE(lo.capabilities, ne.security) AS capabilities,
        ne.security,
        ne.observations as obs_count,
        ne.first_seen as first_observed_at,
        ne.last_seen as last_observed_at,
        ne.unique_days,
        ne.unique_locations,
        lo.signal as avg_signal,
        lo.signal as min_signal,
        lo.signal as max_signal,
        JSONB_BUILD_OBJECT(
          'score', (${threatScoreExpr})::text,
          'level', ${threatLevelExpr},
          'debug', nts.ml_feature_values
        ) AS threat,
        CASE 
          WHEN lo.lat IS NOT NULL AND lo.lon IS NOT NULL THEN
            COALESCE((
              SELECT ST_Distance(
                ST_SetSRID(ST_MakePoint(lo.lon, lo.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
              ) / 1000.0
              FROM app.location_markers lm 
              WHERE lm.marker_type = 'home' 
              LIMIT 1
            ), NULL)
          ELSE NULL
        END AS distance_from_home_km,
        rm.manufacturer AS manufacturer,
        rm.address AS manufacturer_address,
        NULL AS min_altitude_m,
        NULL AS max_altitude_m,
        NULL AS altitude_span_m,
        ne.max_distance_meters AS max_distance_meters,
        NULL AS last_altitude_m,
        FALSE AS is_sentinel
      FROM app.api_network_explorer_mv ne
      LEFT JOIN latest_obs lo ON lo.bssid = ne.bssid
      LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
      LEFT JOIN app.network_tags nt ON nt.bssid = ne.bssid AND nt.threat_tag IS NOT NULL
      LEFT JOIN app.radio_manufacturers rm ON rm.prefix = SUBSTRING(UPPER(REPLACE(ne.bssid, ':', '')), 1, 6)
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      ORDER BY ${orderByClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
        : locationMode === 'triangulated'
          ? `
      SELECT
        bssid,
        ssid,
        type,
        observed_at,
        lat,
        lon,
        lat AS raw_lat,
        lon AS raw_lon,
        accuracy_meters,
        signal,
        frequency,
        channel,
        capabilities,
        security,
        obs_count,
        first_observed_at,
        last_observed_at,
        unique_days,
        unique_locations,
        avg_signal,
        min_signal,
        max_signal,
        threat,
        distance_from_home_km,
        manufacturer,
        manufacturer AS manufacturer_address,
        min_altitude_m,
        max_altitude_m,
        altitude_span_m,
        max_distance_meters,
        last_altitude_m,
        is_sentinel
      FROM (
        ${baseSql}
      ) base
    `
          : `
      WITH base AS (
        ${baseSql}
      ),
      centroid AS (
        SELECT
          o.bssid,
          AVG(o.lat)::double precision AS lat,
          AVG(o.lon)::double precision AS lon
        FROM app.observations o
        JOIN base b ON b.bssid = o.bssid
        WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL
        GROUP BY o.bssid
      ),
      weighted_centroid AS (
        SELECT
          o.bssid,
          (SUM(o.lat * (GREATEST(o.level, -100) + 100)) / NULLIF(SUM(GREATEST(o.level, -100) + 100), 0))::double precision AS lat,
          (SUM(o.lon * (GREATEST(o.level, -100) + 100)) / NULLIF(SUM(GREATEST(o.level, -100) + 100), 0))::double precision AS lon
        FROM app.observations o
        JOIN base b ON b.bssid = o.bssid
        WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL
        GROUP BY o.bssid
      )
      SELECT
        b.bssid,
        b.ssid,
        b.type,
        b.observed_at,
        COALESCE(${locationMode === 'centroid' ? 'c.lat' : 'w.lat'}, b.lat) AS lat,
        COALESCE(${locationMode === 'centroid' ? 'c.lon' : 'w.lon'}, b.lon) AS lon,
        b.lat AS raw_lat,
        b.lon AS raw_lon,
        b.accuracy_meters,
        b.signal,
        b.frequency,
        b.channel,
        b.capabilities,
        b.security,
        b.obs_count,
        b.first_observed_at,
        b.last_observed_at,
        b.unique_days,
        b.unique_locations,
        b.avg_signal,
        b.min_signal,
        b.max_signal,
        b.threat,
        b.distance_from_home_km,
        b.manufacturer,
        b.manufacturer_address,
        b.min_altitude_m,
        b.max_altitude_m,
        b.altitude_span_m,
        b.max_distance_meters,
        b.last_altitude_m,
        b.is_sentinel
      FROM base b
      LEFT JOIN centroid c ON c.bssid = b.bssid
      LEFT JOIN weighted_centroid w ON w.bssid = b.bssid
    `;

    params.push(limit, offset);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL jit = 'off'");
      if (expensiveSort) {
        await client.query("SET LOCAL statement_timeout = '3000ms'");
      }

      if (planCheck) {
        const planRows = await client.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, params);
        const planText = planRows.rows.map((row) => row['QUERY PLAN']).join('\n');
        const regression =
          planText.includes('Seq Scan on app.observations') ||
          planText.includes('Hash Join') ||
          planText.includes('HashAggregate') ||
          planText.includes('Sort');
        if (regression) {
          logger.warn(`Planner regression detected for /api/networks:\n${planText}`);
        }
      }

      const { rows } = await client.query(sql, params);

      // Debug: Log sort info and first 20 rows
      if (sortingByDistance) {
        const distSort = sortEntries.find((e) => distanceColumns.includes(e.column));
        console.log(
          '[DISTANCE SORT DEBUG] Sort column:',
          distSort?.column,
          'Direction:',
          distSort?.direction
        );
        console.log('[DISTANCE SORT DEBUG] ORDER BY clause:', orderByClause);
        console.log('[DISTANCE SORT DEBUG] SQL (first 500 chars):', sql.substring(0, 500));
        console.log(
          '[DISTANCE SORT DEBUG] First 20 rows:',
          rows.slice(0, 20).map((r) => ({
            bssid: r.bssid,
            distance_from_home: r.distance_from_home_km,
            max_distance: r.max_distance_meters,
            type: r.type,
          }))
        );
      }

      const countSql = `
        SELECT COUNT(*)::bigint AS total
        FROM app.api_network_explorer_mv ne
        LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
        LEFT JOIN app.network_tags nt ON nt.bssid = ne.bssid AND nt.threat_tag IS NOT NULL
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      `;
      const countResult = await client.query(countSql, params.slice(0, params.length - 2));
      const total = parseInt(countResult.rows[0]?.total || 0, 10);
      const truncated = offset + rows.length < total;
      await client.query('COMMIT');

      res.json({
        networks: rows,
        count: rows.length,
        limit,
        offset,
        expensive_sort: expensiveSort,
        total,
        truncated,
        location_mode: locationMode,
        ignored_sorts: ignoredSorts,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
