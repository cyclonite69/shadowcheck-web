/**
 * WiGLE Integration Routes
 * Handles WiGLE database queries and live API lookups
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const secretsManager = require('../../../services/secretsManager');
const logger = require('../../../logging/logger');
const { bssidParamMiddleware, validateQuery, optional } = require('../../../validation/middleware');
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

/**
 * Validates WiGLE search query parameters.
 * @type {function}
 */
const validateWigleSearchQuery = validateQuery({
  ssid: optional((value) => validateString(String(value), 1, 64, 'ssid')),
  bssid: optional((value) => validateString(String(value), 1, 64, 'bssid')),
  limit: optional((value) => validateIntegerRange(value, 1, 500, 'limit')),
});

/**
 * Validates WiGLE v2 network query parameters.
 * @type {function}
 */
const validateWigleNetworksQuery = validateQuery({
  limit: optional((value) => validateIntegerRange(value, 1, 50000, 'limit')),
  offset: optional((value) => validateIntegerRange(value, 0, 10000000, 'offset')),
  type: optional((value) => validateString(String(value), 1, 16, 'type')),
});

// GET /api/wigle/live/:bssid - Query live WiGLE API for network
router.get('/wigle/live/:bssid', bssidParamMiddleware, async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const wigleApiName = secretsManager.get('wigle_api_name');
    const wigleApiToken = secretsManager.get('wigle_api_token');

    if (!wigleApiName || !wigleApiToken) {
      return res.status(503).json({ error: 'WiGLE API credentials not configured' });
    }

    // Encode credentials as base64(apiname:apitoken) for Basic auth
    const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');

    logger.info(`[WiGLE] Querying for BSSID: ${bssid}`);

    const response = await fetch(
      `https://api.wigle.net/api/v3/detail/wifi/${encodeURIComponent(bssid)}`,
      {
        headers: {
          Authorization: `Basic ${encodedAuth}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[WiGLE] API error ${response.status}: ${errorText}`);
      return res.status(response.status).json({
        error: 'WiGLE API request failed',
        status: response.status,
        details: errorText,
      });
    }

    const data = await response.json();
    logger.info(`[WiGLE] Found ${data.resultCount || 0} results for ${bssid}`);

    res.json({
      success: true,
      network: data.results && data.results.length > 0 ? data.results[0] : null,
      totalResults: data.resultCount || 0,
      results: data.results || [],
    });
  } catch (err) {
    logger.error(`[WiGLE] Error: ${err.message}`, { error: err });
    next(err);
  }
});

// GET /api/wigle/network/:bssid - Get WiGLE data for a specific network (local DB)
router.get('/wigle/network/:bssid', bssidParamMiddleware, async (req, res, next) => {
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
    const limit = req.validated?.limit ?? 50;

    if (!ssid && !bssid) {
      return res.status(400).json({ error: 'Either ssid or bssid parameter is required' });
    }

    const searchLimit = limit;

    let searchQuery;
    let params;

    if (bssid) {
      searchQuery = `
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
        WHERE bssid ILIKE $1
        ORDER BY last_seen DESC
        LIMIT $2
      `;
      params = [`%${bssid}%`, searchLimit];
    } else {
      searchQuery = `
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
        WHERE ssid ILIKE $1
        ORDER BY last_seen DESC
        LIMIT $2
      `;
      params = [`%${ssid}%`, searchLimit];
    }

    const { rows } = await query(searchQuery, params);

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
    const limitRaw = req.validated?.limit;
    const offsetRaw = req.validated?.offset;
    const typeRaw = req.validated?.type;
    const includeTotalValidation = parseIncludeTotalFlag(req.query.include_total);
    if (!includeTotalValidation.valid) {
      return res.status(400).json({ error: includeTotalValidation.error });
    }
    const includeTotal = includeTotalValidation.value;

    const limit = limitRaw ?? 20000;
    const offset = offsetRaw ?? 0;
    const params = [limit, offset];
    const whereClauses = ['trilat IS NOT NULL', 'trilong IS NOT NULL'];

    if (typeRaw && String(typeRaw).trim() !== '') {
      params.unshift(String(typeRaw).trim());
      whereClauses.push('type = $1');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `
      SELECT
        bssid,
        ssid,
        trilat,
        trilong,
        type,
        encryption,
        lasttime
      FROM public.wigle_v2_networks_search
      ${whereSql}
      ORDER BY lasttime DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const { rows } = await query(sql, params);
    let total = null;
    if (includeTotal) {
      const countParams = typeRaw && String(typeRaw).trim() !== '' ? [String(typeRaw).trim()] : [];
      const countSql = `
        SELECT COUNT(*)::bigint AS total
        FROM public.wigle_v2_networks_search
        ${whereSql}
      `;
      const countResult = await query(countSql, countParams);
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

module.exports = router;
