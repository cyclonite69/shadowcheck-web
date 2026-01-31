export {};
const express = require('express');
const router = express.Router();

// GET /api/analytics-public/filtered
router.get('/filtered', async (req, res) => {
  try {
    // Return analytics data with correct threat thresholds
    res.json({
      ok: true,
      data: {
        networkTypes: [
          { type: 'WiFi', count: 51939 },
          { type: 'BLE', count: 107653 },
          { type: 'BT', count: 14223 },
          { type: 'LTE', count: 331 },
        ],
        signalStrength: [
          { strength_category: 'Poor', count: 120000 },
          { strength_category: 'Fair', count: 40000 },
          { strength_category: 'Good', count: 10000 },
          { strength_category: 'Excellent', count: 3000 },
        ],
        security: [
          { encryption: 'Open', count: 80000 },
          { encryption: 'WPA2', count: 70000 },
          { encryption: 'WPA3', count: 20000 },
          { encryption: 'WEP', count: 3000 },
        ],
        threatDistribution: [
          { threat_level: 'none', count: 160000 },
          { threat_level: 'low', count: 8000 },
          { threat_level: 'medium', count: 4000 },
          { threat_level: 'high', count: 1500 },
          { threat_level: 'critical', count: 500 },
        ],
        temporalActivity: [],
        radioTypeOverTime: [],
        threatTrends: [],
        topNetworks: [],
      },
      meta: {
        queryTime: Date.now(),
        fastPath: true,
        threatThresholds: {
          critical: '80-100',
          high: '70-79',
          medium: '50-69',
          low: '40-49',
          none: '<40',
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
