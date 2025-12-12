const express = require('express');
const router = express.Router();
const keyringService = require('../../../services/keyringService');
const secretsManager = require('../../../services/secretsManager');

// Middleware to require authentication (reuse from server.js)
const requireAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validKey = secretsManager.get('api_key');

  // If no API key is configured, allow access (development mode)
  if (!validKey) {
    return next();
  }

  // If API key is configured, require it
  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Get WiGLE credentials (masked)
router.get('/settings/wigle', requireAuth, async (req, res) => {
  try {
    const creds = await keyringService.getWigleCredentials();
    if (!creds) {
      return res.json({ configured: false });
    }

    res.json({
      configured: true,
      apiName: `${creds.apiName.substring(0, 10)}...`,
      apiToken: `****${creds.apiToken.slice(-4)}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set WiGLE credentials
router.post('/settings/wigle', requireAuth, async (req, res) => {
  try {
    const { apiName, apiToken } = req.body;

    if (!apiName || !apiToken) {
      return res.status(400).json({ error: 'apiName and apiToken required' });
    }

    await keyringService.setWigleCredentials(apiName, apiToken);

    // Test credentials
    const testResult = await keyringService.testWigleCredentials();

    res.json({
      success: true,
      test: testResult,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test WiGLE credentials
router.get('/settings/wigle/test', requireAuth, async (req, res) => {
  try {
    const result = await keyringService.testWigleCredentials();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Mapbox tokens (all)
router.get('/settings/mapbox', requireAuth, async (req, res) => {
  try {
    const tokens = await keyringService.listMapboxTokens();
    const tokensWithMasked = await Promise.all(
      tokens.map(async (t) => {
        const token = await keyringService.getMapboxToken(t.label);
        return {
          label: t.label,
          isPrimary: t.isPrimary,
          token: token ? `${token.substring(0, 10)}...${token.slice(-4)}` : null,
        };
      })
    );
    res.json({ tokens: tokensWithMasked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set Mapbox token
router.post('/settings/mapbox', requireAuth, async (req, res) => {
  try {
    const { token, label = 'default' } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token required' });
    }

    await keyringService.setMapboxToken(token, label);

    res.json({ success: true, label });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set primary Mapbox token
router.post('/settings/mapbox/primary', requireAuth, async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) {
      return res.status(400).json({ error: 'label required' });
    }
    await keyringService.setPrimaryMapboxToken(label);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Mapbox token
router.delete('/settings/mapbox/:label', requireAuth, async (req, res) => {
  try {
    await keyringService.deleteMapboxToken(req.params.label);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all stored credentials (names only)
router.get('/settings/list', requireAuth, async (req, res) => {
  try {
    const keys = await keyringService.listCredentials();
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
