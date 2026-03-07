/**
 * Explorer Networks Routes
 * GET /explorer/networks - Legacy endpoint
 * GET /explorer/networks-v2 - Forensic grade endpoint (DB view)
 */

export {};

const express = require('express');
const router = express.Router();
const {
  explorerService,
  homeLocationService,
  dataQualityFilters,
} = require('../../../../config/container');
const { ROUTE_CONFIG } = require('../../../../config/routeConfig');
const { DATA_QUALITY_FILTERS } = dataQualityFilters;
const logger = require('../../../../logging/logger');

// Import shared utilities
const {
  parseOptionalString,
  parseLimit,
  parsePage,
  parseOffset,
  normalizeQualityFilter,
  inferSecurity,
  inferRadioType,
} = require('./shared');

// GET /api/explorer/networks
router.get('/explorer/networks', async (req, res, _next) => {
  try {
    const limit = parseLimit(
      req.query.limit,
      ROUTE_CONFIG.explorer.defaultLimit,
      ROUTE_CONFIG.explorer.maxLimit
    ).value;
    const offset =
      limit === null ? 0 : parseOffset(req.query.offset, 0, ROUTE_CONFIG.explorer.maxOffset).value;
    const search = parseOptionalString(req.query.search, 200, 'search').value || '';
    const sort = (
      parseOptionalString(req.query.sort || 'last_seen', 64, 'sort').value || 'last_seen'
    ).toLowerCase();
    const order =
      (
        parseOptionalString(req.query.order || 'desc', 16, 'order').value || 'desc'
      ).toUpperCase() === 'ASC'
        ? 'ASC'
        : 'DESC';

    const qualityFilter = normalizeQualityFilter(req.query.qualityFilter);

    // Fetch home location for distance calculation
    let homeLon = null;
    let homeLat = null;
    try {
      const homeLocation = await homeLocationService.getCurrentHomeLocation();
      if (homeLocation) {
        homeLon = homeLocation.longitude;
        homeLat = homeLocation.latitude;
      }
    } catch (err) {
      logger.warn('Could not fetch home location for distance calculation');
    }

    let qualityWhere = '';
    if (qualityFilter === 'temporal') {
      qualityWhere = DATA_QUALITY_FILTERS.temporal_clusters;
    } else if (qualityFilter === 'extreme') {
      qualityWhere = DATA_QUALITY_FILTERS.extreme_signals;
    } else if (qualityFilter === 'duplicate') {
      qualityWhere = DATA_QUALITY_FILTERS.duplicate_coords;
    } else if (qualityFilter === 'all') {
      qualityWhere = DATA_QUALITY_FILTERS.all();
    }

    const result = await explorerService.listNetworks({
      homeLon,
      homeLat,
      search,
      sort,
      order,
      qualityWhere,
      limit,
      offset,
    });

    res.json({
      total: result.total,
      rows: result.rows.map((row) => ({
        bssid: row.bssid ? row.bssid.toUpperCase() : null,
        ssid: row.ssid || '(hidden)',
        observed_at: row.observed_at,
        signal: row.level,
        lat: row.lat,
        lon: row.lon,
        observations: row.observations,
        first_seen: row.first_seen,
        last_seen: row.last_seen,
        is_5ghz: row.is_5ghz,
        is_6ghz: row.is_6ghz,
        is_hidden: row.is_hidden,
        type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
        frequency: row.frequency,
        capabilities: row.capabilities,
        security: inferSecurity(row.capabilities, null),
        distance_from_home_km: row.distance_from_home_km,
        accuracy_meters: row.accuracy_meters,
      })),
    });
  } catch (err) {
    logger.error(`Explorer networks query failed: ${err.message}`, { error: err });
    res.status(500).json({ error: 'networks query failed', code: err.code, message: err.message });
  }
});

// GET /api/explorer/networks-v2 (FORENSIC GRADE - uses DB view)
router.get('/explorer/networks-v2', async (req, res, next) => {
  try {
    const limit = parseLimit(
      req.query.limit,
      ROUTE_CONFIG.explorer.defaultLimit,
      ROUTE_CONFIG.explorer.maxLimit
    ).value;
    const page = parsePage(req.query.page, 1, ROUTE_CONFIG.explorer.maxPage).value;
    const offset = limit === null ? 0 : (page - 1) * limit;
    const search = parseOptionalString(req.query.search, 200, 'search').value || '';
    const sort =
      parseOptionalString(req.query.sort || 'last_seen', 256, 'sort').value || 'last_seen';
    const order = parseOptionalString(req.query.order || 'desc', 256, 'order').value || 'desc';

    const result = await explorerService.listNetworksV2({ search, sort, order, limit, offset });

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Total-Count': result.total.toString(),
      'X-Page': page.toString(),
      'X-Has-More': (limit !== null && result.rows.length === limit).toString(),
    });

    res.json({
      total: result.total,
      page,
      limit,
      hasMore: limit !== null && result.rows.length === limit,
      rows: result.rows.map((row) => ({
        bssid: row.bssid ? row.bssid.toUpperCase() : null,
        ssid: row.ssid,
        observed_at: row.observed_at,
        signal: row.signal,
        lat: row.lat,
        lon: row.lon,
        observations: row.observations,
        first_seen: row.first_seen,
        last_seen: row.last_seen,
        is_5ghz: row.is_5ghz,
        is_6ghz: row.is_6ghz,
        is_hidden: row.is_hidden,
        type: row.type,
        frequency: row.frequency,
        capabilities: row.capabilities,
        security: row.security,
        distance_from_home_km: row.distance_from_home_km,
        accuracy_meters: row.accuracy_meters,
        manufacturer: row.manufacturer,
        manufacturer_address: row.manufacturer_address,
        min_altitude_m: row.min_altitude_m,
        max_altitude_m: row.max_altitude_m,
        altitude_span_m: row.altitude_span_m,
        max_distance_meters: row.max_distance_meters,
        last_altitude_m: row.last_altitude_m,
        is_sentinel: row.is_sentinel,
        threat: row.threat,
      })),
    });
  } catch (err) {
    logger.error(`Explorer networks-v2 query failed: ${err.message}`, { error: err });
    next(err);
  }
});

module.exports = router;
