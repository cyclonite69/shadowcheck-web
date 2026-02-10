export {};
/**
 * WiGLE Integration Routes
 * Handles WiGLE database queries and live API lookups
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const secretsManager = require('../../../services/secretsManager');
const logger = require('../../../logging/logger');
const { requireAdmin } = require('../../../middleware/authMiddleware');
const { withRetry } = require('../../../services/externalServiceHandler');
const { macParamMiddleware, validateQuery, optional } = require('../../../validation/middleware');
const { validateIntegerRange, validateString } = require('../../../validation/schemas');

/**
 * Parses and validates include_total query flag.
 * @param {any} value - Raw include_total query value
 * @returns {{ valid: boolean, value?: boolean, error?: string }}
 */
function parseIncludeTotalFlag(value) {
  if (value === undefined || value === null || value === '') {
    return { valid: true, value: false };
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return { valid: true, value: true };
  }
  if (normalized === '0' || normalized === 'false') {
    return { valid: true, value: false };
  }

  return { valid: false, error: 'include_total must be 1, 0, true, or false' };
}

const stripNullBytes = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const cleaned = String(value).replace(/\u0000/g, '');
  return cleaned === '' ? null : cleaned;
};

const stripNullBytesKeepEmpty = (value) => {
  if (value === undefined || value === null) {
    return value;
  }
  return String(value).replace(/\u0000/g, '');
};

const stripNullBytesDeep = (value) => {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value === 'string') {
    return stripNullBytesKeepEmpty(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripNullBytesDeep(item));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, stripNullBytesDeep(val)])
    );
  }
  return value;
};

/**
 * Validates WiGLE search query parameters.
 * @type {function}
 */
const validateWigleSearchQuery = validateQuery({
  ssid: optional((value) => validateString(String(value), 1, 64, 'ssid')),
  bssid: optional((value) => validateString(String(value), 1, 64, 'bssid')),
  limit: optional((value) => validateIntegerRange(value, 1, Number.MAX_SAFE_INTEGER, 'limit')),
});

/**
 * Validates WiGLE v2 network query parameters.
 * @type {function}
 */
const validateWigleNetworksQuery = validateQuery({
  limit: optional((value) => validateIntegerRange(value, 1, Number.MAX_SAFE_INTEGER, 'limit')),
  offset: optional((value) => validateIntegerRange(value, 0, 10000000, 'offset')),
  type: optional((value) => validateString(String(value), 1, 16, 'type')),
});

/**
 * GET /api/wigle/live/:bssid - Query live WiGLE API for network
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next
 */
// GET /api/wigle/network/:bssid - Get WiGLE data for a specific network (local DB)
router.get('/wigle/network/:bssid', macParamMiddleware, async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const { rows } = await query(
      `
      SELECT
        bssid,
        ssid,
        encryption,
        country,
        region,
        city,
        trilat,
        trilon,
        first_seen,
        last_seen
      FROM app.wigle_networks_enriched
      WHERE bssid = $1
      LIMIT 1
    `,
      [bssid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Network not found in WiGLE database' });
    }

    res.json({
      success: true,
      results: [rows[0]],
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/wigle/search - Search WiGLE database
router.get('/wigle/search', validateWigleSearchQuery, async (req, res, next) => {
  try {
    const ssid = req.validated?.ssid ? String(req.validated.ssid).trim() : '';
    const bssid = req.validated?.bssid ? String(req.validated.bssid).trim() : '';
    const limit = req.validated?.limit ?? null;

    if (!ssid && !bssid) {
      return res.status(400).json({ error: 'Either ssid or bssid parameter is required' });
    }

    const searchLimit = limit;

    let searchQuery;
    const params = [];
    const paginationClauses = [];

    if (bssid) {
      searchQuery = `
        SELECT
          bssid,
          ssid,
          encryption,
          trilat,
          trilong,
          lasttime
        FROM app.wigle_v2_networks_search
        WHERE bssid ILIKE $1
        ORDER BY lasttime DESC
      `;
      params.push(`%${bssid}%`);
    } else {
      searchQuery = `
        SELECT
          bssid,
          ssid,
          encryption,
          trilat,
          trilong,
          lasttime
        FROM app.wigle_v2_networks_search
        WHERE ssid ILIKE $1
        ORDER BY lasttime DESC
      `;
      params.push(`%${ssid}%`);
    }

    if (searchLimit !== null) {
      params.push(searchLimit);
      paginationClauses.push(`LIMIT $${params.length}`);
    }

    const { rows } = await query(`${searchQuery} ${paginationClauses.join(' ')}`.trim(), params);

    res.json({
      ok: true,
      query: ssid || bssid,
      count: rows.length,
      networks: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/wigle/networks-v2 - Fetch WiGLE v2 networks for map testing
router.get('/wigle/networks-v2', validateWigleNetworksQuery, async (req, res, next) => {
  try {
    const { filters, enabled } = req.query;
    const limitRaw = req.validated?.limit ?? null;
    const offsetRaw = req.validated?.offset ?? null;
    const typeRaw = req.validated?.type;
    const includeTotalValidation = parseIncludeTotalFlag(req.query.include_total);
    if (!includeTotalValidation.valid) {
      return res.status(400).json({ error: includeTotalValidation.error });
    }
    const includeTotal = includeTotalValidation.value;

    const limit = limitRaw;
    const offset = offsetRaw;
    const params = [];
    const whereClauses = ['trilat IS NOT NULL', 'trilong IS NOT NULL'];

    if (typeRaw && String(typeRaw).trim() !== '') {
      params.push(String(typeRaw).trim());
      whereClauses.push(`type = $${params.length}`);
    }

    // Apply filters if provided
    if (filters && enabled) {
      try {
        const filterObj = JSON.parse(filters);
        const enabledObj = JSON.parse(enabled);
        let paramIndex = params.length + 1;

        // SSID filter
        if (enabledObj.ssid && filterObj.ssid) {
          whereClauses.push(`ssid ILIKE $${paramIndex}`);
          params.push(`%${filterObj.ssid}%`);
          paramIndex++;
        }

        // BSSID filter
        if (enabledObj.bssid && filterObj.bssid) {
          whereClauses.push(`bssid ILIKE $${paramIndex}`);
          params.push(`${filterObj.bssid}%`);
          paramIndex++;
        }
      } catch (e) {
        logger.warn('Invalid filter parameters:', e.message);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const paginationClauses = [];
    if (limit !== null) {
      params.push(limit);
      paginationClauses.push(`LIMIT $${params.length}`);
    }
    if (offset !== null) {
      params.push(offset);
      paginationClauses.push(`OFFSET $${params.length}`);
    }
    const sql = `
      SELECT
        bssid,
        ssid,
        trilat,
        trilong,
        type,
        encryption,
        channel,
        frequency,
        firsttime,
        lasttime
      FROM app.wigle_v2_networks_search
      ${whereSql}
      ORDER BY lasttime DESC
      ${paginationClauses.join(' ')}
    `;

    const { rows } = await query(sql, params);
    let total = null;
    if (includeTotal) {
      const countSql = `
        SELECT COUNT(*)::bigint AS total
        FROM app.wigle_v2_networks_search
        ${whereSql}
      `;
      const countResult = await query(countSql, params);
      total = parseInt(countResult.rows[0]?.total || 0, 10);
    }

    res.json({
      ok: true,
      data: rows,
      limit,
      offset,
      total,
      truncated: total !== null ? offset + rows.length < total : false,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/wigle/networks-v3 - Fetch WiGLE v3 networks for map testing
router.get('/wigle/networks-v3', validateWigleNetworksQuery, async (req, res, next) => {
  try {
    const limitRaw = req.validated?.limit ?? null;
    const offsetRaw = req.validated?.offset ?? null;
    const includeTotalValidation = parseIncludeTotalFlag(req.query.include_total);

    const limit = limitRaw;
    const offset = offsetRaw;

    // Use a CTE to get all individual observations if they exist,
    // otherwise fall back to the trilaterated point in the summary table.
    const sql = `
      WITH obs AS (
        SELECT 
          netid as bssid,
          ssid,
          latitude as trilat,
          longitude as trilong,
          'wifi' as type,
          encryption,
          observed_at as lasttime
        FROM app.wigle_v3_observations
      ),
      summary AS (
        SELECT
          netid as bssid,
          ssid,
          trilat,
          trilon as trilong,
          type,
          encryption,
          last_seen as lasttime
        FROM app.wigle_v3_network_details
        WHERE NOT EXISTS (SELECT 1 FROM app.wigle_v3_observations WHERE netid = app.wigle_v3_network_details.netid)
      )
      SELECT * FROM obs
      UNION ALL
      SELECT * FROM summary
      ORDER BY lasttime DESC
    `;

    const params = [];
    const paginationClauses = [];
    if (limit !== null) {
      params.push(limit);
      paginationClauses.push(`LIMIT $${params.length}`);
    }
    if (offset !== null) {
      params.push(offset);
      paginationClauses.push(`OFFSET $${params.length}`);
    }

    const { rows } = await query(`${sql} ${paginationClauses.join(' ')}`.trim(), params);

    let total = null;
    if (includeTotalValidation.valid && includeTotalValidation.value) {
      const countSql = `
        SELECT (
          (SELECT COUNT(*) FROM app.wigle_v3_observations) + 
          (SELECT COUNT(*) FROM app.wigle_v3_network_details WHERE NOT EXISTS (SELECT 1 FROM app.wigle_v3_observations WHERE netid = app.wigle_v3_network_details.netid))
        )::bigint AS total
      `;
      const countResult = await query(countSql);
      total = parseInt(countResult.rows[0]?.total || 0, 10);
    }

    res.json({
      ok: true,
      data: rows,
      limit,
      offset,
      total,
      truncated: total !== null ? offset + rows.length < total : false,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wigle/search-api - Search WiGLE API and optionally import results
 * Query params: ssid, bssid, latrange1, latrange2, longrange1, longrange2, resultsPerPage
 * Body: { import: boolean } - if true, imports results to wigle_v2_networks_search table
 */
router.post('/wigle/search-api', requireAdmin, async (req, res, next) => {
  try {
    const wigleApiName = secretsManager.get('wigle_api_name');
    const wigleApiToken = secretsManager.get('wigle_api_token');

    if (!wigleApiName || !wigleApiToken) {
      return res.status(503).json({
        ok: false,
        error:
          'WiGLE API credentials not configured. Set wigle_api_name and wigle_api_token secrets.',
      });
    }

    const {
      ssid,
      bssid,
      latrange1,
      latrange2,
      longrange1,
      longrange2,
      country,
      region,
      city,
      resultsPerPage = 100,
      searchAfter,
    } = req.query;

    const shouldImport = req.body?.import === true;

    // Build query params for WiGLE API
    const params = new URLSearchParams();
    if (ssid) {
      params.append('ssidlike', ssid);
    }
    if (bssid) {
      params.append('netid', bssid);
    }
    if (latrange1) {
      params.append('latrange1', latrange1);
    }
    if (latrange2) {
      params.append('latrange2', latrange2);
    }
    if (longrange1) {
      params.append('longrange1', longrange1);
    }
    if (longrange2) {
      params.append('longrange2', longrange2);
    }
    if (country) {
      params.append('country', country);
    }
    if (region) {
      params.append('region', region);
    }
    if (city) {
      params.append('city', city);
    }
    params.append('resultsPerPage', Math.min(parseInt(resultsPerPage) || 100, 1000).toString());
    if (searchAfter) {
      params.append('searchAfter', searchAfter);
    }

    if (!ssid && !bssid && !latrange1 && !country && !region && !city) {
      return res.status(400).json({
        ok: false,
        error:
          'At least one search parameter required (ssid, bssid, latrange, country, region, or city)',
      });
    }

    const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
    const apiUrl = `https://api.wigle.net/api/v2/network/search?${params.toString()}`;

    logger.info(`[WiGLE] Searching API: ${apiUrl.replace(/netid=[^&]+/, 'netid=***')}`);

    const response = await withRetry(
      () =>
        fetch(apiUrl, {
          headers: {
            Authorization: `Basic ${encodedAuth}`,
            Accept: 'application/json',
          },
        }),
      { serviceName: 'WiGLE Search API', timeoutMs: 30000, maxRetries: 2 }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[WiGLE] Search API error ${response.status}: ${errorText}`);
      return res.status(response.status).json({
        ok: false,
        error: 'WiGLE API request failed',
        status: response.status,
        details: errorText,
      });
    }

    const data = await response.json();
    const results = data.results || [];
    logger.info(
      `[WiGLE] Search returned ${results.length} results (total: ${data.totalResults || 'unknown'})`
    );

    let importedCount = 0;
    const importErrors = [];

    console.log('[WiGLE DEBUG] shouldImport:', shouldImport, 'results.length:', results.length);

    if (shouldImport && results.length > 0) {
      logger.info(`[WiGLE] Importing ${results.length} results to database...`);

      for (const network of results) {
        try {
          const result = await query(
            `
            INSERT INTO app.wigle_v2_networks_search (
              bssid, ssid, trilat, trilong, location, firsttime, lasttime, lastupdt,
              type, encryption, channel, frequency, qos, wep, bcninterval, freenet,
              dhcp, paynet, transid, rcois, name, comment, userfound, source,
              country, region, city, road, housenumber, postalcode
            ) VALUES (
              $1, $2, $3::numeric, $4::numeric, ST_SetSRID(ST_MakePoint($5::numeric, $3::numeric), 4326),
              $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
              $17, $18, $19, $20, $21, $22, $23, 'wigle_api_search',
              $24, $25, $26, $27, $28, $29
            )
            ON CONFLICT (bssid, trilat, trilong, lastupdt) DO NOTHING
          `,
            [
              network.netid || network.bssid,
              network.ssid,
              network.trilat ? parseFloat(network.trilat) : null,
              network.trilong ? parseFloat(network.trilong) : null,
              network.trilong ? parseFloat(network.trilong) : null,
              network.firsttime,
              network.lasttime,
              network.lastupdt,
              network.type || 'wifi',
              network.encryption,
              network.channel,
              network.frequency,
              network.qos || 0,
              network.wep,
              network.bcninterval,
              network.freenet,
              network.dhcp,
              network.paynet,
              network.transid,
              network.rcois,
              network.name,
              network.comment,
              network.userfound === true,
              network.country,
              network.region,
              network.city,
              network.road,
              network.housenumber,
              network.postalcode,
            ]
          );
          console.log('[WiGLE DEBUG] rowCount:', result.rowCount, 'for BSSID:', network.netid);
          if (result.rowCount > 0) {
            importedCount++;
          }
        } catch (err) {
          console.error('[WiGLE DEBUG] Insert error:', err.message, 'for BSSID:', network.netid);
          if (!err.message.includes('duplicate key')) {
            importErrors.push({ bssid: network.netid, error: err.message });
            logger.error(`[WiGLE] Import error for ${network.netid}: ${err.message}`);
          }
        }
      }
      logger.info(
        `[WiGLE] Import complete: ${importedCount} new records, ${results.length - importedCount} duplicates/skipped`
      );
    }

    res.json({
      ok: true,
      totalResults: data.totalResults || results.length,
      resultCount: results.length,
      searchAfter: data.searchAfter || null,
      hasMore: data.searchAfter !== null,
      results: results.map((n) => ({
        bssid: n.netid,
        ssid: n.ssid,
        trilat: n.trilat,
        trilong: n.trilong,
        type: n.type,
        encryption: n.encryption,
        channel: n.channel,
        firsttime: n.firsttime,
        lasttime: n.lasttime,
        country: n.country,
        region: n.region,
        city: n.city,
        road: n.road,
        housenumber: n.housenumber,
        postalcode: n.postalcode,
        freenet: n.freenet,
        paynet: n.paynet,
        userfound: n.userfound,
      })),
      imported: shouldImport ? { count: importedCount, errors: importErrors } : null,
    });
  } catch (err) {
    logger.error(`[WiGLE] Search error: ${err.message}`, { error: err });
    next(err);
  }
});

/**
 * Helper to import individual observations from WiGLE v3 detail data.
 * @param {string} netid - Network ID
 * @param {Array} locationClusters - Array of location clusters from WiGLE
 */
async function importWigleV3Observations(netid, locationClusters) {
  if (!locationClusters || !Array.isArray(locationClusters)) {
    return 0;
  }

  let totalImported = 0;
  for (const cluster of locationClusters) {
    if (!cluster.locations || !Array.isArray(cluster.locations)) {
      continue;
    }

    for (const loc of cluster.locations) {
      try {
        // Use location SSID if valid, otherwise fall back to cluster SSID
        const ssidToUse =
          loc.ssid && loc.ssid !== '?' && loc.ssid !== ''
            ? loc.ssid
            : cluster.clusterSsid || loc.ssid;
        const sanitizedSsid = stripNullBytes(ssidToUse);

        await query(
          `
          INSERT INTO app.wigle_v3_observations (
            netid, latitude, longitude, altitude, accuracy,
            signal, observed_at, last_update, ssid,
            frequency, channel, encryption, noise, snr, month,
            location
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15,
            ST_SetSRID(ST_MakePoint($3, $2), 4326)
          )
          ON CONFLICT DO NOTHING
        `,
          [
            netid,
            parseFloat(loc.latitude),
            parseFloat(loc.longitude),
            parseFloat(loc.alt) || null,
            parseFloat(loc.accuracy) || null,
            parseInt(loc.signal) || null,
            loc.time,
            loc.lastupdt,
            sanitizedSsid,
            parseInt(loc.frequency) || null,
            parseInt(loc.channel) || null,
            stripNullBytes(loc.encryptionValue),
            parseInt(loc.noise) || null,
            parseInt(loc.snr) || null,
            loc.month,
          ]
        );
        totalImported++;
      } catch (err) {
        logger.error(`[WiGLE] Failed to import observation for ${netid}: ${err.message}`);
      }
    }
  }
  return totalImported;
}

/**
 * POST /api/wigle/detail/:netid - Fetch WiGLE v3 detail and optionally import
 * Body: { import: boolean }
 */
const WIGLE_DETAIL_ENDPOINTS = {
  wifi: 'wifi',
  bt: 'bt',
};

async function fetchWigleDetail(netid, endpoint) {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');

  if (!wigleApiName || !wigleApiToken) {
    return {
      ok: false,
      status: 503,
      error: 'WiGLE API credentials not configured',
    };
  }

  const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
  const apiUrl = `https://api.wigle.net/api/v3/detail/${endpoint}/${encodeURIComponent(netid)}`;

  logger.info(`[WiGLE] Fetching ${endpoint} detail for: ${netid}`);

  const response = await withRetry(
    () =>
      fetch(apiUrl, {
        headers: {
          Authorization: `Basic ${encodedAuth}`,
          Accept: 'application/json',
        },
      }),
    { serviceName: 'WiGLE Detail API', timeoutMs: 15000, maxRetries: 2 }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[WiGLE] Detail API error ${response.status}: ${errorText}`);
    return {
      ok: false,
      status: response.status,
      error: 'WiGLE Detail API request failed',
      details: errorText,
    };
  }

  const data = await response.json();
  return { ok: true, data };
}

async function handleWigleDetailRequest(req, res, next, endpoint) {
  try {
    const { netid } = req.params;
    const shouldImport = req.body?.import === true;

    const detailResponse = await fetchWigleDetail(netid, endpoint);

    if (!detailResponse.ok) {
      return res.status(detailResponse.status).json({
        ok: false,
        error: detailResponse.error,
        status: detailResponse.status,
        details: detailResponse.details,
      });
    }

    const data = detailResponse.data;
    const normalizedData = stripNullBytesDeep(data);
    let importedObservations = 0;

    if (shouldImport && data.networkId) {
      const sanitizedName = stripNullBytes(data.name);
      const sanitizedComment = stripNullBytes(data.comment);
      const sanitizedSsid = stripNullBytes(data.locationClusters?.[0]?.clusterSsid || data.name);
      const sanitizedEncryption = stripNullBytes(data.encryption);
      const sanitizedFreenet = stripNullBytes(data.freenet);
      const sanitizedDhcp = stripNullBytes(data.dhcp);
      const sanitizedPaynet = stripNullBytes(data.paynet);

      logger.info(`[WiGLE] Importing detail for ${netid} to database...`);

      await query(
        `
        INSERT INTO app.wigle_v3_network_details (
          netid, name, type, comment, ssid,
          trilat, trilon, encryption, channel, 
          bcninterval, freenet, dhcp, paynet,
          qos, first_seen, last_seen, last_update,
          street_address, location_clusters
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19
        )
        ON CONFLICT (netid) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          comment = EXCLUDED.comment,
          ssid = EXCLUDED.ssid,
          trilat = EXCLUDED.trilat,
          trilon = EXCLUDED.trilon,
          encryption = EXCLUDED.encryption,
          channel = EXCLUDED.channel,
          bcninterval = EXCLUDED.bcninterval,
          freenet = EXCLUDED.freenet,
          dhcp = EXCLUDED.dhcp,
          paynet = EXCLUDED.paynet,
          qos = EXCLUDED.qos,
          first_seen = EXCLUDED.first_seen,
          last_seen = EXCLUDED.last_seen,
          last_update = EXCLUDED.last_update,
          street_address = EXCLUDED.street_address,
          location_clusters = EXCLUDED.location_clusters,
          imported_at = NOW()
      `,
        [
          data.networkId,
          sanitizedName,
          data.type,
          sanitizedComment,
          sanitizedSsid,
          data.trilateratedLatitude,
          data.trilateratedLongitude,
          sanitizedEncryption,
          data.channel,
          data.bcninterval,
          sanitizedFreenet,
          sanitizedDhcp,
          sanitizedPaynet,
          data.bestClusterWiGLEQoS,
          data.firstSeen,
          data.lastSeen,
          data.lastUpdate,
          JSON.stringify(data.streetAddress),
          JSON.stringify(data.locationClusters),
        ]
      );

      // Also import individual observations
      importedObservations = await importWigleV3Observations(data.networkId, data.locationClusters);
      logger.info(`[WiGLE] Imported ${importedObservations} observations for ${netid}`);
    }

    res.json({
      ok: true,
      data: normalizedData,
      imported: shouldImport,
      importedObservations,
    });
  } catch (err) {
    logger.error(`[WiGLE] Detail error: ${err.message}`, { error: err });
    next(err);
  }
}

router.post('/wigle/detail/:netid', requireAdmin, async (req, res, next) => {
  await handleWigleDetailRequest(req, res, next, WIGLE_DETAIL_ENDPOINTS.wifi);
});

/**
 * POST /api/wigle/detail/bt/:netid - Fetch WiGLE v3 Bluetooth detail and optionally import
 * Body: { import: boolean }
 */
router.post('/wigle/detail/bt/:netid', requireAdmin, async (req, res, next) => {
  await handleWigleDetailRequest(req, res, next, WIGLE_DETAIL_ENDPOINTS.bt);
});

/**
 * POST /api/wigle/import/v3 - Import WiGLE v3 detail JSON file
 * Upload: 'file' (JSON)
 */
router.post('/wigle/import/v3', requireAdmin, async (req, res, next) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    const file = req.files.file;
    const jsonString = file.data.toString('utf8');
    let data;

    try {
      data = JSON.parse(jsonString);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON file' });
    }

    // Validate required fields (at least networkId)
    if (!data.networkId) {
      return res.status(400).json({ ok: false, error: 'JSON missing networkId field' });
    }

    const sanitizedName = stripNullBytes(data.name);
    const sanitizedComment = stripNullBytes(data.comment);
    const sanitizedSsid = stripNullBytes(data.locationClusters?.[0]?.clusterSsid || data.name);
    const sanitizedEncryption = stripNullBytes(data.encryption);
    const sanitizedFreenet = stripNullBytes(data.freenet);
    const sanitizedDhcp = stripNullBytes(data.dhcp);
    const sanitizedPaynet = stripNullBytes(data.paynet);

    logger.info(`[WiGLE] Importing v3 detail for ${data.networkId} from file...`);

    await query(
      `
      INSERT INTO app.wigle_v3_network_details (
        netid, name, type, comment, ssid,
        trilat, trilon, encryption, channel, 
        bcninterval, freenet, dhcp, paynet,
        qos, first_seen, last_seen, last_update,
        street_address, location_clusters
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19
      )
      ON CONFLICT (netid) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        comment = EXCLUDED.comment,
        ssid = EXCLUDED.ssid,
        trilat = EXCLUDED.trilat,
        trilon = EXCLUDED.trilon,
        encryption = EXCLUDED.encryption,
        channel = EXCLUDED.channel,
        bcninterval = EXCLUDED.bcninterval,
        freenet = EXCLUDED.freenet,
        dhcp = EXCLUDED.dhcp,
        paynet = EXCLUDED.paynet,
        qos = EXCLUDED.qos,
        first_seen = EXCLUDED.first_seen,
        last_seen = EXCLUDED.last_seen,
        last_update = EXCLUDED.last_update,
        street_address = EXCLUDED.street_address,
        location_clusters = EXCLUDED.location_clusters,
        imported_at = NOW()
    `,
      [
        data.networkId,
        sanitizedName,
        data.type,
        sanitizedComment,
        sanitizedSsid,
        data.trilateratedLatitude,
        data.trilateratedLongitude,
        sanitizedEncryption,
        data.channel,
        data.bcninterval,
        sanitizedFreenet,
        sanitizedDhcp,
        sanitizedPaynet,
        data.bestClusterWiGLEQoS,
        data.firstSeen,
        data.lastSeen,
        data.lastUpdate,
        JSON.stringify(data.streetAddress),
        JSON.stringify(data.locationClusters),
      ]
    );

    // Also import individual observations
    const importedObservations = await importWigleV3Observations(
      data.networkId,
      data.locationClusters
    );
    logger.info(`[WiGLE] Imported ${importedObservations} observations for ${data.networkId}`);

    res.json({
      ok: true,
      data: stripNullBytesDeep(data),
      importedObservations,
    });
  } catch (err) {
    logger.error(`[WiGLE] Import error: ${err.message}`, { error: err });
    next(err);
  }
});

/**
 * GET /api/wigle/observations/:netid - Fetch stored individual observations
 */
router.get('/wigle/observations/:netid', async (req, res, next) => {
  try {
    const { netid } = req.params;

    const { rows } = await query(
      `
      SELECT
        id, netid, latitude, longitude, altitude, accuracy,
        signal, observed_at, last_update, ssid,
        frequency, channel, encryption, noise, snr, month
      FROM app.wigle_v3_observations
      WHERE netid = $1
      ORDER BY observed_at DESC
    `,
      [netid]
    );

    res.json({
      ok: true,
      count: rows.length,
      observations: rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/wigle/api-status - Check WiGLE API credentials and status
 */
module.exports = router;
