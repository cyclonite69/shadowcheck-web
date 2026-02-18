export {};
const express = require('express');
const router = express.Router();
const logger = require('../../../logging/logger');
const keplerService = require('../../../services/keplerService');
const homeLocationService = require('../../../services/homeLocationService');

let dashboardService = null;

/**
 * Safely parses JSON query parameters.
 * @param {any} value - Raw query value
 * @param {string} fieldName - Field name for error messages
 * @returns {{ ok: boolean, value?: object, error?: string }}
 */
function parseJsonQuery(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: {} };
  }

  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, value: parsed };
    }
    return { ok: false, error: `${fieldName} must be a JSON object` };
  } catch {
    return { ok: false, error: `${fieldName} must be valid JSON` };
  }
}

const assertHomeExistsIfNeeded = async (enabled, res) => {
  if (!enabled?.distanceFromHomeMin && !enabled?.distanceFromHomeMax) {
    return true;
  }
  try {
    const exists = await keplerService.checkHomeLocationExists();
    if (!exists) {
      res.status(400).json({
        ok: false,
        error: 'Home location is required for distance filters.',
      });
      return false;
    }
    return true;
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message,
    });
    return false;
  }
};

function initDashboardRoutes(options) {
  dashboardService = options.dashboardService;
}

const sendDashboardMetrics = async (req, res) => {
  try {
    if (!dashboardService) {
      return res.status(500).json({ error: 'Dashboard service not initialized' });
    }

    // Parse filters from query params
    const filtersResult = parseJsonQuery(req.query.filters, 'filters');
    if (!filtersResult.ok) {
      return res.status(400).json({ error: filtersResult.error });
    }

    const enabledResult = parseJsonQuery(req.query.enabled, 'enabled');
    if (!enabledResult.ok) {
      return res.status(400).json({ error: enabledResult.error });
    }

    const filters = filtersResult.value;
    const enabled = enabledResult.value;

    // Debug logging
    console.log('[Dashboard] Received filters:', JSON.stringify(filters, null, 2));
    console.log('[Dashboard] Received enabled:', JSON.stringify(enabled, null, 2));

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const metrics = await dashboardService.getMetrics(filters, enabled);
    res.json({
      threats: {
        critical: metrics.threatsCritical || 0,
        high: metrics.threatsHigh || 0,
        medium: metrics.threatsMedium || 0,
        low: metrics.threatsLow || 0,
      },
      networks: {
        total: metrics.totalNetworks || 0,
        wifi: metrics.wifiCount || 0,
        ble: metrics.bleCount || 0,
        bluetooth: metrics.bluetoothCount || 0,
        lte: metrics.lteCount || 0,
        nr: metrics.nrCount || 0,
        gsm: metrics.gsmCount || 0,
      },
      observations: {
        total: metrics.totalObservations || 0,
        wifi: metrics.wifiObservations || 0,
        ble: metrics.bleObservations || 0,
        bluetooth: metrics.bluetoothObservations || 0,
        lte: metrics.lteObservations || 0,
        nr: metrics.nrObservations || 0,
        gsm: metrics.gsmObservations || 0,
      },
      surveillance: metrics.activeSurveillance || 0,
      enriched: metrics.enrichedCount || 0,
      filtersApplied: metrics.filtersApplied || 0,
      timestamp: metrics.lastUpdated,
    });
  } catch (error) {
    logger.error(`Dashboard metrics error: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
};

router.get('/dashboard/metrics', sendDashboardMetrics);
router.get('/dashboard-metrics', sendDashboardMetrics);

router.get('/dashboard/threats', async (req, res) => {
  try {
    if (!dashboardService) {
      return res.status(500).json({ error: 'Dashboard service not initialized' });
    }
    const threats = await dashboardService.getThreats();
    res.json({
      threats: threats || [],
      total: threats.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Dashboard threats error: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/summary', async (req, res) => {
  try {
    if (!dashboardService) {
      return res.status(500).json({ error: 'Dashboard service not initialized' });
    }
    const metrics = await dashboardService.getMetrics();
    const totalThreats =
      (metrics.threatsCritical || 0) +
      (metrics.threatsHigh || 0) +
      (metrics.threatsMedium || 0) +
      (metrics.threatsLow || 0);
    res.json({
      summary: {
        totalNetworks: metrics.totalNetworks || 0,
        totalThreats: totalThreats,
        criticalThreats: metrics.threatsCritical || 0,
        activeSurveillance: metrics.activeSurveillance || 0,
      },
      timestamp: metrics.lastUpdated,
    });
  } catch (error) {
    logger.error(`Dashboard summary error: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

// GET /api/home-location
router.get('/home-location', async (req, res) => {
  try {
    const location = await homeLocationService.getCurrentHomeLocation();

    if (!location) {
      return res.status(404).json({
        error: 'No home location configured',
        message: 'Set a home location via the location markers API',
      });
    }

    res.json(location);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/home-location
router.post('/admin/home-location', async (req, res) => {
  try {
    const { latitude, longitude, radius = 100 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    await homeLocationService.setHomeLocation(latitude, longitude, radius);

    res.json({
      ok: true,
      message: 'Home location saved successfully',
      latitude,
      longitude,
      radius,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = {
  router,
  initDashboardRoutes,
};
