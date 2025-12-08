/**
 * WiGLE Integration Routes
 * Handles WiGLE database queries
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// GET /api/wigle/network/:bssid - Get WiGLE data for a specific network
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
