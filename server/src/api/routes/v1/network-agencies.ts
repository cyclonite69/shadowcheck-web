const express = require('express');
const router = express.Router();
const agencyService = require('../../../services/agencyService');

/**
 * GET /api/networks/:bssid/nearest-agencies
 * Get nearest agencies to all observation points for a network (local + WiGLE v3)
 */
router.get('/nearest-agencies/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const radius = parseFloat(req.query.radius) || 250; // Default 250km

    const agencies = await agencyService.getNearestAgenciesToNetwork(bssid, radius);

    res.json({
      ok: true,
      bssid,
      agencies,
      count: agencies.length,
      radius_km: radius,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/networks/nearest-agencies/batch
 * Get nearest agencies to all observation points for multiple networks (local + WiGLE v3)
 */
router.post('/nearest-agencies/batch', async (req, res, next) => {
  try {
    const { bssids } = req.body;

    if (!Array.isArray(bssids) || bssids.length === 0) {
      return res.status(400).json({ error: 'bssids array is required' });
    }

    const radius = parseFloat(req.query.radius) || 250; // Default 250km

    // Convert all BSSIDs to uppercase for consistent matching
    const upperBssids = bssids.map((b) => String(b).toUpperCase());

    const agencies = await agencyService.getNearestAgenciesToNetworksBatch(upperBssids, radius);

    res.json({
      ok: true,
      bssids,
      agencies,
      count: agencies.length,
      radius_km: radius,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
