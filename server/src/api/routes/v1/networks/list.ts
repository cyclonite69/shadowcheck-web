/**
 * Networks List Routes
 * GET /networks - List all networks with pagination and filtering
 */

export {};
import type { Request, Response } from 'express';
const express = require('express');
const router = express.Router();
const { networkService } = require('../../../../config/container');
const { safeJsonParse } = require('../../../../utils/safeJsonParse');
const { ROUTE_CONFIG } = require('../../../../config/routeConfig');
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
const { asyncHandler } = require('../../../../utils/asyncHandler');

const VALID_TAG_TYPES = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];

// GET /api/networks - List all networks with pagination and filtering
router.get(
  '/networks',
  cacheMiddleware(60),
  asyncHandler(async (req: Request, res: Response) => {
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
    const manufacturerRaw = req.query.manufacturer;
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
      ROUTE_CONFIG.networks.maxLimit,
      'limit',
      'Missing limit parameter.',
      `Invalid limit parameter. Must be between 1 and ${ROUTE_CONFIG.networks.maxLimit}.`
    );
    if (!limitResult.ok) {
      return res.status(400).json({ error: limitResult.error });
    }

    const offsetResult = parseRequiredInteger(
      offsetRaw,
      0,
      ROUTE_CONFIG.networks.maxOffset,
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
          const threatLevelMap: Record<string, string> = {
            critical: 'CRITICAL',
            high: 'HIGH',
            medium: 'MED',
            low: 'LOW',
            none: 'NONE',
          };
          threatCategories = categories
            .map((cat: string) => threatLevelMap[cat] || cat.toUpperCase())
            .filter(Boolean);
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
      const lastSeenValue = Array.isArray(lastSeenRaw) ? lastSeenRaw[0] : lastSeenRaw;
      const parsed = new Date(String(lastSeenValue));
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

    const minObsResult = parseOptionalInteger(
      minObsRaw,
      0,
      ROUTE_CONFIG.networks.maxObservationCount,
      'min_obs_count'
    );
    if (!minObsResult.ok) {
      return res.status(400).json({ error: 'Invalid min_obs_count parameter.' });
    }
    const minObsCount = minObsResult.value !== null ? minObsResult.value : 1;

    const maxObsResult = parseOptionalInteger(
      maxObsRaw,
      0,
      ROUTE_CONFIG.networks.maxObservationCount,
      'max_obs_count'
    );
    if (!maxObsResult.ok) {
      return res.status(400).json({ error: 'Invalid max_obs_count parameter.' });
    }
    const maxObsCount = maxObsResult.value;

    let radioTypes = null;
    if (radioTypesRaw !== undefined) {
      const values = parseCommaList(radioTypesRaw, 20);
      if (values && values.length > 0) {
        radioTypes = values.map((value: string) => value.toUpperCase());
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
      const validation = validateBSSIDList(bssidRaw, ROUTE_CONFIG.networks.maxLimit);
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

    let manufacturer = null;
    if (manufacturerRaw !== undefined) {
      const validation = validateString(manufacturerRaw, 100, 'manufacturer');
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid manufacturer parameter.' });
      }
      manufacturer = validation.value;
    }

    const result = await networkService.getFilteredNetworks({
      limit,
      offset,
      planCheck,
      locationMode,
      sort: sortRaw,
      order: orderRaw,
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
    });

    if (result?.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    res.json(result);
  })
);

module.exports = router;
