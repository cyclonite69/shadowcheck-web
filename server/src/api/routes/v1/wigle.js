/**
 * WiGLE Integration Routes
 * Handles WiGLE database queries and live API lookups
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const secretsManager = require('../../../services/secretsManager');
const logger = require('../../../logging/logger');
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

/**
 * GET /api/wigle/live/:bssid - Query live WiGLE API for network
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next
 */
router.get('/wigle/live/:bssid', macParamMiddleware, async (req, res, next) => {
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

    const response = await withRetry(
      () =>
        fetch(`https://api.wigle.net/api/v3/detail/wifi/${encodeURIComponent(bssid)}`, {
          headers: {
            Authorization: `Basic ${encodedAuth}`,
            Accept: 'application/json',
          },
        }),
      {
        serviceName: 'WiGLE API',
        timeoutMs: 10000,
        maxRetries: 2,
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
    const { filters, enabled } = req.query;
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

/**
 * POST /api/wigle/search-api - Search WiGLE API and optionally import results
 * Query params: ssid, bssid, latrange1, latrange2, longrange1, longrange2, resultsPerPage
 * Body: { import: boolean } - if true, imports results to wigle_v2_networks_search table
 */
router.post('/wigle/search-api', async (req, res, next) => {
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
    params.append('resultsPerPage', Math.min(parseInt(resultsPerPage) || 100, 1000).toString());
    if (searchAfter) {
      params.append('searchAfter', searchAfter);
    }

    if (!ssid && !bssid && !latrange1) {
      return res.status(400).json({
        ok: false,
        error: 'At least one search parameter required (ssid, bssid, or latrange)',
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

    if (shouldImport && results.length > 0) {
      logger.info(`[WiGLE] Importing ${results.length} results to database...`);

      for (const network of results) {
        try {
          await query(
            `
            INSERT INTO public.wigle_v2_networks_search (
              bssid, ssid, trilat, trilong, location, firsttime, lasttime, lastupdt,
              type, encryption, channel, frequency, qos, wep, bcninterval, freenet,
              dhcp, paynet, transid, rcois, name, comment, userfound, source,
              country, region, city, road, housenumber, postalcode
            ) VALUES (
              $1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $3), 4326),
              $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
              $17, $18, $19, $20, $21, $22, $23, 'wigle_api_search',
              $24, $25, $26, $27, $28, $29
            )
            ON CONFLICT (id) DO NOTHING
          `,
            [
              network.netid || network.bssid,
              network.ssid,
              parseFloat(network.trilat) || 0,
              parseFloat(network.trilong) || 0,
              parseFloat(network.trilong) || 0,
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
          importedCount++;
        } catch (err) {
          if (!err.message.includes('duplicate key')) {
            importErrors.push({ bssid: network.netid, error: err.message });
          }
        }
      }
      logger.info(`[WiGLE] Imported ${importedCount} networks`);
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
      })),
      imported: shouldImport ? { count: importedCount, errors: importErrors } : null,
    });
  } catch (err) {
    logger.error(`[WiGLE] Search error: ${err.message}`, { error: err });
    next(err);
  }
});

/**
 * GET /api/wigle/api-status - Check WiGLE API credentials and status
 */
router.get('/wigle/api-status', async (req, res) => {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');

  if (!wigleApiName || !wigleApiToken) {
    return res.json({
      ok: false,
      configured: false,
      error: 'WiGLE API credentials not set',
    });
  }

  try {
    const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
    const response = await fetch('https://api.wigle.net/api/v2/profile/user', {
      headers: { Authorization: `Basic ${encodedAuth}`, Accept: 'application/json' },
    });

    if (!response.ok) {
      return res.json({ ok: false, configured: true, error: `API returned ${response.status}` });
    }

    const data = await response.json();
    res.json({
      ok: true,
      configured: true,
      user: data.user || wigleApiName,
      monthlyResultLimit: data.statistics?.monthlyResultLimit,
      monthlyResultCount: data.statistics?.monthlyResultCount,
    });
  } catch (err) {
    res.json({ ok: false, configured: true, error: err.message });
  }
});

module.exports = router;
