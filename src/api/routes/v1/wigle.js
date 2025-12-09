/**
 * WiGLE Integration Routes
 * Handles WiGLE database queries and live API lookups
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const secretsManager = require('../../../services/secretsManager');

// GET /api/wigle/live/:bssid - Query live WiGLE API for network
router.get('/wigle/live/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const wigleApiName = secretsManager.get('wigle_api_name');
    const wigleApiToken = secretsManager.get('wigle_api_token');
    
    if (!wigleApiName || !wigleApiToken) {
      return res.status(503).json({ error: 'WiGLE API credentials not configured' });
    }

    // Encode credentials as base64(apiname:apitoken) for Basic auth
    const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
    
    console.log(`[WiGLE] Querying for BSSID: ${bssid}`);
    
    const response = await fetch(
      `https://api.wigle.net/api/v3/detail/wifi/${encodeURIComponent(bssid)}`,
      {
        headers: {
          'Authorization': `Basic ${encodedAuth}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WiGLE] API error ${response.status}:`, errorText);
      return res.status(response.status).json({ 
        error: 'WiGLE API request failed',
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();
    console.log(`[WiGLE] Found ${data.resultCount || 0} results for ${bssid}`);
    
    res.json({
      success: true,
      network: data.results && data.results.length > 0 ? data.results[0] : null,
      totalResults: data.resultCount || 0,
      results: data.results || []
    });
  } catch (err) {
    console.error('[WiGLE] Error:', err);
    next(err);
  }
});

// GET /api/wigle/network/:bssid - Get WiGLE data for a specific network (local DB)
router.get('/wigle/network/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const { rows } = await query(`
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
    `, [bssid]);

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
router.get('/wigle/search', async (req, res, next) => {
  try {
    const { ssid, bssid, limit = 50 } = req.query;

    if (!ssid && !bssid) {
      return res.status(400).json({ error: 'Either ssid or bssid parameter is required' });
    }

    const searchLimit = Math.min(parseInt(limit) || 50, 500);

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

module.exports = router;
