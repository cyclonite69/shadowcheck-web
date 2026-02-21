/**
 * Explorer Networks Routes
 * GET /explorer/networks - Legacy endpoint
 * GET /explorer/networks-v2 - Forensic grade endpoint (DB view)
 */

export {};

const express = require('express');
const router = express.Router();
const explorerService = require('../../../../services/explorerService');
const homeLocationService = require('../../../../services/homeLocationService');
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
    const { filters, enabled } = req.query;
    const limit = parseLimit(req.query.limit, 500, 5000).value;
    const offset = limit === null ? 0 : parseOffset(req.query.offset, 0, 1000000).value;
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

    const sortMap = {
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
    const sortColumn = sortMap[sort] || 'last_seen';

    // Fetch home location from service
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

    const { DATA_QUALITY_FILTERS } = require('../../../../services/dataQualityFilters');
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

    const params: any[] = [homeLon, homeLat];
    const where = [];
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      where.push(
        `(ap.latest_ssid ILIKE $${params.length - 1} OR ap.bssid ILIKE $${params.length})`
      );
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${sortColumn} ${order}`;
    let limitClause = '';
    if (limit !== null) {
      const limitIndex = params.length + 1;
      const offsetIndex = params.length + 2;
      params.push(limit, offset);
      limitClause = `LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
    }

    const sql = `
      WITH obs_latest AS (
        SELECT DISTINCT ON (bssid)
          bssid,
          ssid,
          lat,
          lon,
          level,
          accuracy AS accuracy_meters,
          time AS observed_at,
          radio_type,
          radio_frequency,
          radio_capabilities
        FROM app.observations
        WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat != 0 AND lon != 0 ${qualityWhere}
        ORDER BY bssid, time DESC
      )
      SELECT
        ap.bssid,
        COALESCE(NULLIF(obs.ssid, ''), ap.latest_ssid) AS ssid,
        obs.observed_at,
        obs.level,
        obs.lat,
        obs.lon,
        ap.total_observations AS observations,
        ap.first_seen,
        ap.last_seen,
        ap.is_5ghz,
        ap.is_6ghz,
        ap.is_hidden,
        obs.radio_frequency AS frequency,
        obs.radio_capabilities AS capabilities,
        obs.accuracy_meters,
        obs.radio_type AS type,
        CASE
          WHEN obs.lat IS NOT NULL AND obs.lon IS NOT NULL THEN
            ST_Distance(
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              ST_SetSRID(ST_MakePoint(obs.lon, obs.lat), 4326)::geography
            ) / 1000.0
          ELSE NULL
        END AS distance_from_home_km,
        COUNT(*) OVER() AS total
      FROM app.access_points ap
      LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;

    const result = await explorerService.executeExplorerQuery(sql, params);
    res.json({
      total: result.rows[0]?.total || 0,
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
    const limit = parseLimit(req.query.limit, 500, 5000).value;
    const page = parsePage(req.query.page, 1, 1000000).value;
    const offset = limit === null ? 0 : (page - 1) * limit;
    const search = parseOptionalString(req.query.search, 200, 'search').value || '';

    const sortParam =
      parseOptionalString(req.query.sort || 'last_seen', 256, 'sort').value || 'last_seen';
    const orderParam = parseOptionalString(req.query.order || 'desc', 256, 'order').value || 'desc';

    const sortColumns = String(sortParam)
      .toLowerCase()
      .split(',')
      .map((s) => s.trim());
    const sortOrders = String(orderParam)
      .toLowerCase()
      .split(',')
      .map((o) => o.trim());

    const sortMap = {
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

    const getThreatLevelSort = (order) => {
      const severityOrder =
        order === 'asc'
          ? "CASE WHEN threat->>'level' = 'NONE' THEN 1 WHEN threat->>'level' = 'LOW' THEN 2 WHEN threat->>'level' = 'MED' THEN 3 WHEN threat->>'level' = 'HIGH' THEN 4 WHEN threat->>'level' = 'CRITICAL' THEN 5 ELSE 0 END"
          : "CASE WHEN threat->>'level' = 'CRITICAL' THEN 1 WHEN threat->>'level' = 'HIGH' THEN 2 WHEN threat->>'level' = 'MED' THEN 3 WHEN threat->>'level' = 'LOW' THEN 4 WHEN threat->>'level' = 'NONE' THEN 5 ELSE 6 END";
      return severityOrder;
    };

    const orderByClauses = sortColumns
      .map((col, idx) => {
        const order = sortOrders[idx] === 'asc' ? 'ASC' : 'DESC';
        if (col === 'threat') {
          return `${getThreatLevelSort(sortOrders[idx])} ${order}`;
        }
        if (col === 'threat_score') {
          return `(threat->>'score')::numeric ${order} NULLS LAST`;
        }
        const mappedCol = sortMap[col] || 'last_seen';
        return `${mappedCol} ${order} NULLS LAST`;
      })
      .join(', ');

    const params: any[] = [];
    const where = [];
    if (search) {
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      where.push(
        `(ssid ILIKE $${params.length - 3}
          OR bssid ILIKE $${params.length - 2}
          OR manufacturer ILIKE $${params.length - 1}
          OR manufacturer_address ILIKE $${params.length})`
      );
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${orderByClauses}`;

    const sql = `
      SELECT
        mv.bssid,
        mv.ssid,
        mv.observed_at,
        mv.signal,
        mv.lat,
        mv.lon,
        mv.observations,
        mv.first_seen,
        mv.last_seen,
        mv.is_5ghz,
        mv.is_6ghz,
        mv.is_hidden,
        mv.type,
        mv.frequency,
        mv.capabilities,
        mv.security,
        mv.distance_from_home_km,
        mv.accuracy_meters,
        mv.manufacturer,
        mv.manufacturer_address,
        mv.min_altitude_m,
        mv.max_altitude_m,
        mv.altitude_span_m,
        mv.max_distance_meters,
        mv.last_altitude_m,
        mv.is_sentinel,
        COALESCE(
          jsonb_build_object(
            'score', live_ts.final_threat_score,
            'level', live_ts.final_threat_level,
            'model_version', live_ts.model_version
          ),
          mv.threat
        ) AS threat,
        COUNT(*) OVER() AS total
      FROM app.api_network_explorer_mv mv
      LEFT JOIN app.network_threat_scores live_ts ON mv.bssid = live_ts.bssid::text
      ${whereClause}
      ${orderClause}
      ${limit !== null ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : ''};
    `;

    if (limit !== null) {
      params.push(limit, offset);
    }

    const result = await explorerService.executeExplorerQuery(sql, params);

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Total-Count': result.rows[0]?.total || '0',
      'X-Page': page.toString(),
      'X-Has-More': (limit !== null && result.rows.length === limit).toString(),
    });

    res.json({
      total: result.rows[0]?.total || 0,
      page: page,
      limit: limit,
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
