/**
 * Networks Routes
 * Handles all network-related endpoints
 */

const express = require('express');
const router = express.Router();
const { pool, query } = require('../../../config/database');
const { escapeLikePattern } = require('../../../utils/escapeSQL');
const logger = require('../../../logging/logger');
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

const VALID_TAG_TYPES = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];

// GET /api/networks - List all networks with pagination and filtering
router.get('/networks', async (req, res, next) => {
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
    const quickSearchRaw = req.query.q;
    const sortRaw = req.query.sort || 'last_seen';
    const orderRaw = req.query.order || 'DESC';
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
        ['NONE', 'LOW', 'MED', 'HIGH'],
        'threat_level'
      );
      if (!validation.valid) {
        return res
          .status(400)
          .json({ error: 'Invalid threat_level parameter. Must be NONE, LOW, MED, or HIGH.' });
      }
      threatLevel = validation.value;
    }

    if (threatCategoriesRaw !== undefined) {
      try {
        const categories = Array.isArray(threatCategoriesRaw)
          ? threatCategoriesRaw
          : JSON.parse(threatCategoriesRaw);
        if (Array.isArray(categories) && categories.length > 0) {
          // Map frontend threat categories to database values
          const threatLevelMap = {
            critical: 'HIGH',
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
    const minObsCount = minObsResult.value;

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

    const typeExpr = `
      CASE
        WHEN ne.type IS NOT NULL AND ne.type <> '?' THEN ne.type
        WHEN ne.frequency BETWEEN 2412 AND 7125 THEN 'W'
        WHEN COALESCE(ne.capabilities, '') ~* '(WPA|WEP|ESS|RSN|CCMP|TKIP|OWE|SAE)' THEN 'W'
        ELSE '?'
      END
    `;

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
      obs_count: 'ne.observations',
      observations: 'ne.observations',
      distance_from_home_km: 'ne.distance_from_home_km',
      accuracy_meters: 'ne.accuracy_meters',
      avg_signal: 'ne.signal',
      min_signal: 'ne.signal',
      max_signal: 'ne.signal',
      unique_days: 'ne.unique_days',
      unique_locations: 'ne.unique_locations',
      threat: 'ne.threat',
      threat_score: '(nts.final_threat_score)::numeric',
      threat_level: 'nts.final_threat_level',
      lat: 'ne.lat',
      lon: 'ne.lon',
      manufacturer: 'ne.manufacturer',
      manufacturer_address: 'ne.manufacturer',
      capabilities: 'ne.capabilities',
      min_altitude_m: 'ne.min_altitude_m',
      max_altitude_m: 'ne.max_altitude_m',
      altitude_span_m: 'ne.altitude_span_m',
      max_distance_meters: 'ne.max_distance_meters',
      last_altitude_m: 'ne.last_altitude_m',
      is_sentinel: 'ne.is_sentinel',
      timespan_days: 'EXTRACT(EPOCH FROM (ne.last_seen - ne.first_seen)) / 86400.0',
    };

    const parseSortJson = (value) => {
      if (!value) {
        return null;
      }
      const trimmed = String(value).trim();
      if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) {
        return null;
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
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
    ]);
    const expensiveSort = !(sortEntries.length === 1 && indexedSorts.has(sortEntries[0].column));
    if (expensiveSort && limit > 2000) {
      return res.status(400).json({
        error: 'Limit must be <= 2000 for non-indexed or multi-column sorts.',
      });
    }

    const orderByClause = `${sortEntries
      .map((entry) => `${sortColumnMap[entry.column]} ${entry.direction}`)
      .join(', ')}, ne.bssid ASC`;

    const params = [];
    const whereClauses = [];

    // Filter out networks with no observations when sorting by distance-related columns
    const distanceColumns = ['max_distance_meters', 'distance_from_home_km'];
    const sortingByDistance = sortEntries.some((entry) => distanceColumns.includes(entry.column));
    if (sortingByDistance) {
      whereClauses.push('ne.observations > 0');
    }

    if (threatLevel !== null) {
      params.push(threatLevel);
      whereClauses.push(`ne.threat->>'level' = $${params.length}`);
    }

    if (threatCategories !== null && threatCategories.length > 0) {
      params.push(threatCategories);
      whereClauses.push(`ne.threat->>'level' = ANY($${params.length})`);
    }

    if (threatScoreMin !== null) {
      params.push(threatScoreMin);
      whereClauses.push(`(threat->>'score')::numeric >= $${params.length}`);
    }

    if (threatScoreMax !== null) {
      params.push(threatScoreMax);
      whereClauses.push(`(threat->>'score')::numeric <= $${params.length}`);
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
    if (encryptionTypes && encryptionTypes.length > 0) {
      params.push(encryptionTypes);
      whereClauses.push(`ne.security = ANY($${params.length})`);
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
      params.push(like, like, likeBssid, like);
      whereClauses.push(
        `(lower(ne.ssid) LIKE $${params.length - 3} ESCAPE '\\' OR ` +
          `lower(ne.bssid) LIKE $${params.length - 2} ESCAPE '\\' OR ` +
          `lower(replace(ne.bssid, ':', '')) LIKE $${params.length - 1} ESCAPE '\\' OR ` +
          `lower(COALESCE(mv.manufacturer, ne.manufacturer)) LIKE $${params.length} ESCAPE '\\')`
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
        NULL as channel,
        ne.capabilities,
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
          'score', COALESCE(
            CASE 
              WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 0
              WHEN nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_score, 0)::numeric
              WHEN nt.threat_tag = 'THREAT' THEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3)
              ELSE (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3)
            END,
            0
          )::text,
          'level', CASE
            WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'
            WHEN nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_level, 'NONE')
            WHEN nt.threat_tag = 'THREAT' THEN (
              CASE
                WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 80 THEN 'CRITICAL'
                WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 60 THEN 'HIGH'
                WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 40 THEN 'MED'
                WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 20 THEN 'LOW'
                ELSE 'NONE'
              END
            )
            ELSE (
              CASE
                WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 80 THEN 'CRITICAL'
                WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 60 THEN 'HIGH'
                WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 40 THEN 'MED'
                WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 20 THEN 'LOW'
                ELSE 'NONE'
              END
            )
          END
        ) AS threat,
        ne.distance_from_home_km,
        ne.manufacturer AS manufacturer,
        ne.manufacturer AS manufacturer_address,
        ne.min_altitude_m,
        ne.max_altitude_m,
        ne.altitude_span_m,
        ne.max_distance_meters,
        ne.last_altitude_m,
        ne.is_sentinel
      FROM public.api_network_explorer_mv ne
      LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
      LEFT JOIN app.network_tags nt ON nt.bssid = ne.bssid AND nt.threat_tag IS NOT NULL
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      ORDER BY ${orderByClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const sql =
      locationMode === 'latest_observation' || locationMode === 'triangulated'
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
        FROM public.observations o
        JOIN base b ON b.bssid = o.bssid
        WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL
        GROUP BY o.bssid
      ),
      weighted_centroid AS (
        SELECT
          o.bssid,
          (SUM(o.lat * (GREATEST(o.level, -100) + 100)) / NULLIF(SUM(GREATEST(o.level, -100) + 100), 0))::double precision AS lat,
          (SUM(o.lon * (GREATEST(o.level, -100) + 100)) / NULLIF(SUM(GREATEST(o.level, -100) + 100), 0))::double precision AS lon
        FROM public.observations o
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
          planText.includes('Seq Scan on public.observations') ||
          planText.includes('Hash Join') ||
          planText.includes('HashAggregate') ||
          planText.includes('Sort');
        if (regression) {
          logger.warn(`Planner regression detected for /api/networks:\n${planText}`);
        }
      }

      const { rows } = await client.query(sql, params);
      const countSql = `
        SELECT COUNT(*)::bigint AS total
        FROM public.api_network_explorer_mv ne
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

// GET /api/networks/search/:ssid - Search networks by SSID
router.get('/networks/search/:ssid', async (req, res, next) => {
  try {
    const { ssid } = req.params;

    const ssidValidation = validateString(String(ssid || ''), 1, 128, 'ssid');
    if (!ssidValidation.valid) {
      return res.status(400).json({ error: 'SSID parameter is required and cannot be empty.' });
    }

    const escapedSSID = escapeLikePattern(String(ssid).trim());
    const searchPattern = `%${escapedSSID}%`;

    const { rows } = await query(
      `
      SELECT
        n.unified_id,
        n.ssid,
        n.bssid,
        n.type,
        n.encryption,
        n.bestlevel as signal,
        n.lasttime,
        COUNT(DISTINCT l.unified_id) as observation_count
      FROM app.networks n
      LEFT JOIN public.observations l ON n.bssid = l.bssid
      WHERE n.ssid ILIKE $1
      GROUP BY n.unified_id, n.ssid, n.bssid, n.type, n.encryption, n.bestlevel, n.lasttime
      ORDER BY observation_count DESC
      LIMIT 50
    `,
      [searchPattern]
    );

    res.json({
      ok: true,
      query: ssid,
      count: rows.length,
      networks: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/networks/observations/:bssid - Get all observations for a network
router.get('/networks/observations/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    let home = null;
    try {
      const homeResult = await query(`
        SELECT
          ST_X(location::geometry) as lon,
          ST_Y(location::geometry) as lat
        FROM public.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
      `);
      home = homeResult.rows[0] || null;
    } catch {
      // Table doesn't exist, use fallback
      home = null;
    }

    const { rows } = await query(
      `
      SELECT
        ROW_NUMBER() OVER (ORDER BY o.time) as id,
        o.bssid,
        COALESCE(NULLIF(o.ssid, ''), '(hidden)') as ssid,
        o.radio_type as type,
        o.lat,
        o.lon,
        o.level as signal,
        EXTRACT(EPOCH FROM o.time)::BIGINT * 1000 as time,
        COALESCE(o.accuracy, 3.79) as acc,
        o.altitude as alt,
        CASE
          WHEN $1::numeric IS NOT NULL AND $2::numeric IS NOT NULL THEN
            ST_Distance(
              ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            ) / 1000.0
          ELSE NULL
        END as distance_from_home_km
      FROM public.observations o
      WHERE o.bssid = $3
        AND o.lat IS NOT NULL
        AND o.lon IS NOT NULL
      ORDER BY o.time ASC
      LIMIT 1000
    `,
      [home?.lon, home?.lat, bssidValidation.cleaned]
    );

    res.json({
      ok: true,
      bssid: bssidValidation.cleaned,
      observations: rows,
      home: home,
      count: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/networks/tagged - Get tagged networks
router.get('/networks/tagged', async (req, res, next) => {
  try {
    const { tag_type } = req.query;
    const tagValidation = validateEnum(tag_type, VALID_TAG_TYPES, 'tag_type');
    if (!tagValidation.valid) {
      return res
        .status(400)
        .json({ error: `Valid tag_type is required (one of: ${VALID_TAG_TYPES.join(', ')})` });
    }

    const pageResult = parseOptionalInteger(req.query.page, 1, 1000000, 'page');
    if (!pageResult.ok) {
      return res.status(400).json({ error: 'Invalid page parameter. Must be a positive integer.' });
    }
    const limitResult = parseOptionalInteger(req.query.limit, 1, 1000, 'limit');
    if (!limitResult.ok) {
      return res
        .status(400)
        .json({ error: 'Invalid limit parameter. Must be between 1 and 1000.' });
    }
    const page = pageResult.value ?? 1;
    const limit = limitResult.value ?? 50;

    const offset = (page - 1) * limit;
    if (process.env.DEBUG_QUERIES === 'true') {
      logger.debug(`Networks query page=${page} limit=${limit} offset=${offset}`);
    }

    const { rows } = await query(
      `
      SELECT
        t.bssid,
        n.ssid,
        t.tag_type,
        t.confidence,
        t.notes,
        t.tagged_at,
        t.updated_at,
        COUNT(*) OVER() as total_count
      FROM app.network_tags t
      LEFT JOIN app.networks n ON t.bssid = n.bssid
      WHERE t.tag_type = $1
      ORDER BY t.updated_at DESC
      LIMIT $2 OFFSET $3
    `,
      [tagValidation.value, limit, offset]
    );

    const totalCount = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

    res.json({
      ok: true,
      tag_type: tagValidation.value,
      networks: rows.map((row) => ({
        bssid: row.bssid,
        ssid: row.ssid || '<Hidden>',
        tag_type: row.tag_type,
        confidence: parseFloat(row.confidence),
        notes: row.notes,
        tagged_at: row.tagged_at,
        updated_at: row.updated_at,
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tag-network - Tag a network
router.post('/tag-network', async (req, res, next) => {
  try {
    const { bssid, tag_type, confidence, notes } = req.body;

    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const tagValidation = validateEnum(tag_type, VALID_TAG_TYPES, 'tag_type');
    if (!tagValidation.valid) {
      return res
        .status(400)
        .json({ error: `Valid tag_type is required (one of: ${VALID_TAG_TYPES.join(', ')})` });
    }

    const confidenceValidation = validateConfidence(confidence);
    if (!confidenceValidation.valid) {
      return res.status(400).json({ error: 'Confidence must be a number between 0 and 100' });
    }

    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    const networkResult = await query(
      `
      SELECT ssid FROM app.networks WHERE bssid = $1 LIMIT 1
    `,
      [bssidValidation.cleaned]
    );

    if (networkResult.rowCount === 0) {
      return res.status(404).json({ error: 'Network not found for tagging' });
    }

    await query(
      `
      DELETE FROM app.network_tags WHERE bssid = $1
    `,
      [bssidValidation.cleaned]
    );

    const result = await query(
      `
      INSERT INTO app.network_tags (bssid, tag_type, confidence, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING bssid, tag_type, confidence, threat_score, ml_confidence
    `,
      [
        bssidValidation.cleaned,
        tagValidation.value,
        confidenceValidation.value / 100.0,
        notes || null,
      ]
    );

    res.json({
      ok: true,
      tag: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tag-network/:bssid - Remove tag from network
router.delete('/tag-network/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const bssidValidation = validateMACAddress(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const result = await query(
      `
      DELETE FROM app.network_tags WHERE bssid = $1 RETURNING bssid
    `,
      [bssidValidation.cleaned]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tag not found for this BSSID' });
    }

    res.json({
      ok: true,
      message: 'Tag removed successfully',
      bssid: bssidValidation.cleaned,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/manufacturer/:bssid - Get manufacturer from MAC address
router.get('/manufacturer/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const prefix = bssidValidation.cleaned.replace(/:/g, '').substring(0, 6).toUpperCase();

    const { rows } = await query(
      `
      SELECT
        oui_prefix_24bit as prefix,
        organization_name as manufacturer,
        organization_address as address
      FROM app.radio_manufacturers
      WHERE oui_prefix_24bit = $1
      LIMIT 1
    `,
      [prefix]
    );

    if (rows.length === 0) {
      return res.json({
        ok: true,
        bssid: bssidValidation.cleaned,
        manufacturer: 'Unknown',
        prefix: prefix,
      });
    }

    res.json({
      ok: true,
      bssid: bssidValidation.cleaned,
      manufacturer: rows[0].manufacturer,
      address: rows[0].address,
      prefix: rows[0].prefix,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/networks/tag-threats - Tag multiple networks as threats
router.post('/networks/tag-threats', async (req, res, next) => {
  try {
    const { bssids, reason } = req.body;

    const bssidListValidation = validateBSSIDList(bssids, 10000);
    if (!bssidListValidation.valid) {
      return res.status(400).json({ error: bssidListValidation.error });
    }
    const reasonValidation =
      reason === undefined
        ? { valid: true, value: undefined }
        : validateString(String(reason), 0, 512, 'reason');
    if (!reasonValidation.valid) {
      return res.status(400).json({ error: reasonValidation.error });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const bssid of bssidListValidation.value) {
      try {
        const result = await query(
          `
          INSERT INTO app.network_tags (bssid, tag_type, confidence, threat_score, notes)
          VALUES ($1, 'THREAT', 0.9, 0.8, $2)
          ON CONFLICT (bssid) DO UPDATE SET
            tag_type = 'THREAT',
            confidence = 0.9,
            threat_score = 0.8,
            notes = $2
          RETURNING bssid, tag_type, confidence, threat_score
        `,
          [bssid, reasonValidation.value || 'Manual threat tag']
        );

        results.push({ bssid: bssid, success: true, tag: result.rows[0] });
        successCount++;
      } catch (err) {
        logger.warn(`Failed to tag ${bssid}: ${err.message}`);
        results.push({ bssid, error: err.message });
        errorCount++;
      }
    }

    res.json({
      ok: true,
      message: `Tagged ${successCount} networks as threats`,
      successCount,
      errorCount,
      results,
    });
  } catch (err) {
    next(err);
  }
});

// Test route
router.get('/test-home-api', async (req, res) => {
  res.json({ message: 'Home API test working!' });
});

// Home location routes for admin page
router.get('/home-location', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        latitude,
        longitude,
        radius,
        created_at
      FROM app.location_markers
      WHERE marker_type = 'home'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({
        latitude: 43.02345147,
        longitude: -83.69682688,
        radius: 100,
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/admin/home-location', async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 100 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
    }

    if (radius < 10 || radius > 5000) {
      return res.status(400).json({ error: 'Radius must be between 10 and 5000 meters' });
    }

    await query("DELETE FROM app.location_markers WHERE marker_type = 'home'");

    await query(
      `
      INSERT INTO app.location_markers (marker_type, latitude, longitude, radius, location, created_at)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($3, $2), 4326), NOW())
    `,
      ['home', latitude, longitude, radius]
    );

    res.json({
      ok: true,
      message: 'Home location and radius saved successfully',
      latitude,
      longitude,
      radius,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
