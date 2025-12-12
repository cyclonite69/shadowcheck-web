const express = require('express');
const router = express.Router();

let dashboardService = null;

function initDashboardRoutes(options) {
  dashboardService = options.dashboardService;
}

router.get('/dashboard/metrics', async (req, res) => {
  try {
    if (!dashboardService) {
      return res.status(500).json({ error: 'Dashboard service not initialized' });
    }
    const metrics = await dashboardService.getMetrics();
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
      },
      surveillance: metrics.activeSurveillance || 0,
      enriched: metrics.enrichedCount || 0,
      timestamp: metrics.lastUpdated,
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

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
    console.error('Dashboard threats error:', error);
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
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  router,
  initDashboardRoutes,
};
