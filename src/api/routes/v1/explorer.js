const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

function inferSecurity(capabilities, encryption) {
  const cap = String(capabilities || encryption || '').toUpperCase();
  if (!cap) {
    return 'OPEN';
  }
  const hasEap = cap.includes('EAP') || cap.includes('MGT');
  if (cap.includes('WPA3') || cap.includes('SAE')) {
    return hasEap ? 'WPA3-E' : 'WPA3-P';
  }
  if (cap.includes('WPA2') || cap.includes('RSN')) {
    return hasEap ? 'WPA2-E' : 'WPA2-P';
  }
  if (cap.includes('WPA')) {
    return 'WPA';
  }
  if (cap.includes('WEP')) {
    return 'WEP';
  }
  if (cap.includes('WPS') && !cap.includes('WPA')) {
    return 'WPS';
  }
  return 'Unknown';
}

// WiGLE Network Type Classifications (https://api.wigle.net/csvFormat.html)
// W = WiFi, B = Bluetooth, E = BLE, G = GSM, C = CDMA, D = WCDMA, L = LTE, N = NR (5G), F = NFC
function inferRadioType(radioType, ssid, frequency, capabilities) {
  // If database has a valid radio_type, use it
  if (radioType && radioType !== '' && radioType !== null) {
    return radioType;
  }

  const ssidUpper = String(ssid || '').toUpperCase();
  const capUpper = String(capabilities || '').toUpperCase();

  // Check for 5G NR (New Radio)
  if (ssidUpper.includes('5G') || capUpper.includes('NR') || capUpper.includes('5G NR')) {
    return 'N';
  }

  // Check for LTE (4G)
  if (
    ssidUpper.includes('LTE') ||
    ssidUpper.includes('4G') ||
    capUpper.includes('LTE') ||
    capUpper.includes('EARFCN')
  ) {
    return 'L';
  }

  // Check for WCDMA (3G)
  if (
    ssidUpper.includes('WCDMA') ||
    ssidUpper.includes('3G') ||
    ssidUpper.includes('UMTS') ||
    capUpper.includes('WCDMA') ||
    capUpper.includes('UMTS') ||
    capUpper.includes('UARFCN')
  ) {
    return 'D';
  }

  // Check for GSM (2G)
  if (
    ssidUpper.includes('GSM') ||
    ssidUpper.includes('2G') ||
    capUpper.includes('GSM') ||
    capUpper.includes('ARFCN')
  ) {
    return 'G';
  }

  // Check for CDMA
  if (ssidUpper.includes('CDMA') || capUpper.includes('CDMA')) {
    return 'C';
  }

  // Check for generic cellular keywords
  const cellularKeywords = ['T-MOBILE', 'VERIZON', 'AT&T', 'ATT', 'SPRINT', 'CARRIER', '3GPP'];
  if (cellularKeywords.some((keyword) => ssidUpper.includes(keyword))) {
    return 'L'; // Default cellular to LTE
  }

  // Check for BLE (Bluetooth Low Energy)
  if (
    ssidUpper.includes('[UNKNOWN / SPOOFED RADIO]') ||
    ssidUpper.includes('BLE') ||
    ssidUpper.includes('BTLE') ||
    capUpper.includes('BLE') ||
    capUpper.includes('BTLE') ||
    capUpper.includes('BLUETOOTH LOW ENERGY')
  ) {
    return 'E';
  }

  // Check for Bluetooth Classic
  if (ssidUpper.includes('BLUETOOTH') || capUpper.includes('BLUETOOTH')) {
    if (!capUpper.includes('LOW ENERGY') && !capUpper.includes('BLE')) {
      return 'B';
    }
    return 'E'; // Default Bluetooth to BLE if ambiguous
  }

  // Check frequency ranges
  if (frequency) {
    const freq = parseInt(frequency, 10);

    // WiFi 2.4GHz band (2400-2500 MHz)
    if (freq >= 2412 && freq <= 2484) {
      return 'W';
    }

    // WiFi 5GHz band (5000-6000 MHz)
    if (freq >= 5000 && freq <= 5900) {
      return 'W';
    }

    // WiFi 6GHz band (5925-7125 MHz)
    if (freq >= 5925 && freq <= 7125) {
      return 'W';
    }

    // Bluetooth/BLE (2400-2483.5 MHz, overlaps with WiFi 2.4GHz)
    // This is less reliable, only use if no other indicators
  }

  // Check capabilities for WiFi keywords
  if (
    capUpper.includes('WPA') ||
    capUpper.includes('WEP') ||
    capUpper.includes('WPS') ||
    capUpper.includes('RSN') ||
    capUpper.includes('ESS') ||
    capUpper.includes('CCMP') ||
    capUpper.includes('TKIP')
  ) {
    return 'W';
  }

  // Unknown - don't default to WiFi
  return '?';
}

// Basic input guards
function parseIntParam(value, defaultValue, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) {
    return defaultValue;
  }
  return max ? Math.min(n, max) : n;
}

// GET /api/explorer/networks
// Returns latest snapshot per BSSID from access_points + observations
router.get('/explorer/networks', async (req, res, _next) => {
  try {
    const rawLimit = req.query.limit;
    const limit =
      typeof rawLimit === 'string' && rawLimit.toLowerCase() === 'all'
        ? null
        : parseIntParam(rawLimit, 500, 5000);
    const offset = limit === null ? 0 : Math.max(0, parseInt(req.query.offset, 10) || 0);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const sort = (req.query.sort || 'last_seen').toLowerCase();
    const order = (req.query.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Sort uses columns exposed in the outer select (no inner aliases)
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

    // Use fixed home point (no dependency on location_markers)
    const homeLon = -83.69682688;
    const homeLat = 43.02345147; // fallback trilateration point

    const params = [homeLon, homeLat];
    const where = [];
    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      where.push(
        `(ap.latest_ssid ILIKE $${params.length - 1} OR ap.bssid ILIKE $${params.length})`
      );
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${sortColumn} ${order}`;
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
        FROM public.observations
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
      FROM public.access_points ap
      LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
      ${whereClause}
      ${orderClause}
      ${
        limit === null
          ? ''
          : (() => {
              const limitIndex = params.length + 1;
              const offsetIndex = params.length + 2;
              params.push(limit, offset);
              return `LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
            })()
      };
    `;

    const result = await query(sql, params);
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
    console.error('Explorer networks query failed', err);
    res.status(500).json({ error: 'networks query failed', code: err.code, message: err.message });
  }
});

// ============================================================================
// GET /api/explorer/networks-v2 (FORENSIC GRADE - uses DB view)
// All intelligence in Postgres, thin transport layer
// FIXED: Multi-column sorting, pagination-based loading (not offset-based)
// ============================================================================
router.get('/explorer/networks-v2', async (req, res, next) => {
  try {
    const rawLimit = req.query.limit;
    const limit =
      typeof rawLimit === 'string' && rawLimit.toLowerCase() === 'all'
        ? null
        : parseIntParam(rawLimit, 500, 5000);

    // Use page-based pagination instead of offset for better performance
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = limit === null ? 0 : (page - 1) * limit;

    const search = req.query.search ? String(req.query.search).trim() : '';

    // Multi-column sorting support
    const sortParam = req.query.sort || 'last_seen';
    const orderParam = req.query.order || 'desc';

    // Parse comma-separated sort columns and orders
    const sortColumns = String(sortParam)
      .toLowerCase()
      .split(',')
      .map((s) => s.trim());
    const sortOrders = String(orderParam)
      .toLowerCase()
      .split(',')
      .map((o) => o.trim());

    // Sort mapping (view column names) - UPDATED with all sortable fields
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
      threat: "(threat->>'score')::numeric", // Sort by threat score numerically
      'threat.score': "(threat->>'score')::numeric", // Alternative syntax
      min_altitude_m: 'min_altitude_m',
      max_altitude_m: 'max_altitude_m',
      altitude_span_m: 'altitude_span_m',
      max_distance_meters: 'max_distance_meters',
      maxdistancemeters: 'max_distance_meters',
      max_distance: 'max_distance_meters',
      last_altitude_m: 'last_altitude_m',
      is_sentinel: 'is_sentinel',
      // Frontend column mappings (CRITICAL FIX)
      lastseen: 'last_seen',
      lastSeen: 'last_seen', // CamelCase variant
      distanceFromHome: 'distance_from_home_km', // CamelCase variant
    };

    // Build ORDER BY clause with multiple columns
    const orderByClauses = sortColumns
      .map((col, idx) => {
        const mappedCol = sortMap[col] || 'last_seen';
        const order = sortOrders[idx] === 'asc' ? 'ASC' : 'DESC';
        return `${mappedCol} ${order} NULLS LAST`;
      })
      .join(', ');

    const params = [];
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

    // Optimized query with performance hints
    const sql = `
      SELECT
        bssid, ssid, observed_at, signal, lat, lon,
        observations, first_seen, last_seen,
        is_5ghz, is_6ghz, is_hidden,
        type, frequency, capabilities, security,
        distance_from_home_km, accuracy_meters,
        -- New enrichment fields (non-breaking)
        manufacturer, manufacturer_address,
        min_altitude_m, max_altitude_m, altitude_span_m, max_distance_meters,
        last_altitude_m, is_sentinel,
        -- Threat intelligence (v3)
        threat,
        COUNT(*) OVER() AS total
      FROM public.api_network_explorer
      ${whereClause}
      ${orderClause}
      ${limit !== null ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : ''};
    `;

    if (limit !== null) {
      params.push(limit, offset);
    }

    const result = await query(sql, params);

    // Set performance headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Total-Count': result.rows[0]?.total || '0',
      'X-Page': page.toString(),
      'X-Has-More': (limit !== null && result.rows.length === limit).toString(),
    });

    // Response (minimal Node transform - only uppercase BSSID for legacy compat)
    res.json({
      total: result.rows[0]?.total || 0,
      page: page,
      limit: limit,
      hasMore: limit !== null && result.rows.length === limit,
      rows: result.rows.map((row) => ({
        bssid: row.bssid ? row.bssid.toUpperCase() : null, // Already uppercase in DB, but ensure
        ssid: row.ssid, // Already has '(hidden)' fallback in view
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
        type: row.type, // Already inferred in view
        frequency: row.frequency,
        capabilities: row.capabilities,
        security: row.security, // Already inferred in view
        distance_from_home_km: row.distance_from_home_km,
        accuracy_meters: row.accuracy_meters,
        // New enrichment fields (non-breaking)
        manufacturer: row.manufacturer,
        manufacturer_address: row.manufacturer_address,
        min_altitude_m: row.min_altitude_m,
        max_altitude_m: row.max_altitude_m,
        altitude_span_m: row.altitude_span_m,
        max_distance_meters: row.max_distance_meters,
        last_altitude_m: row.last_altitude_m,
        is_sentinel: row.is_sentinel,
        // Threat intelligence (v3 - rule-based scoring)
        threat: row.threat, // JSONB object from view
      })),
    });
  } catch (err) {
    console.error('Explorer networks-v2 query failed:', err);
    next(err);
  }
});

// GET /api/explorer/timeline/:bssid
router.get('/explorer/timeline/:bssid', async (req, res, next) => {
  try {
    const bssid = String(req.params.bssid || '').toLowerCase();
    const data = await query(
      `
        SELECT bucket, obs_count, avg_level, min_level, max_level
        FROM mv_network_timeline
        WHERE bssid = $1
        ORDER BY bucket ASC
      `,
      [bssid]
    );
    res.json(data.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/explorer/heatmap
router.get('/explorer/heatmap', async (_req, res, next) => {
  try {
    const data = await query(
      `
        SELECT
          ST_AsGeoJSON(tile_geom)::json AS geometry,
          obs_count,
          avg_level,
          min_level,
          max_level,
          first_seen,
          last_seen
        FROM mv_heatmap_tiles
      `
    );
    res.json(data.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/explorer/routes
router.get('/explorer/routes', async (_req, res, next) => {
  try {
    const data = await query(
      `
        SELECT
          device_id,
          point_count,
          start_at,
          end_at,
          ST_AsGeoJSON(route_geom)::json AS geometry
        FROM mv_device_routes
      `
    );
    res.json(data.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
