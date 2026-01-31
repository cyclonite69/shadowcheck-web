export {};
const express = require('express');
const router = express.Router();
const keyringService = require('../../../services/keyringService');
const secretsManager = require('../../../services/secretsManager');
const { validateString } = require('../../../validation/schemas');

// Middleware to require authentication (reuse from server.js)
/**
 * Normalizes API key input from headers or query params.
 * @param {any} value - Raw API key value
 * @returns {string|null} Normalized API key or null
 */
function normalizeApiKey(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const validation = validateString(String(value), 1, 256, 'api_key');
  if (!validation.valid) {
    return null;
  }
  return String(value).trim();
}

/**
 * Validates a mapbox token string.
 * @param {any} value - Raw token input
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
function validateMapboxToken(value) {
  const validation = validateString(String(value || ''), 1, 256, 'token');
  if (!validation.valid) {
    return validation;
  }

  const token = String(value).trim();
  if (!token.startsWith('pk.') && !token.startsWith('sk.')) {
    return { valid: false, error: 'token must start with pk. or sk.' };
  }

  return { valid: true, value: token };
}

/**
 * Validates a label string for stored tokens.
 * @param {any} value - Raw label input
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
function validateLabel(value) {
  const validation = validateString(String(value || ''), 1, 64, 'label');
  if (!validation.valid) {
    return validation;
  }
  return { valid: true, value: String(value).trim() };
}

/**
 * Validates a Google Maps API key string.
 * @param {any} value - Raw key input
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
function validateGoogleMapsKey(value) {
  const validation = validateString(String(value || ''), 10, 256, 'google_maps_api_key');
  if (!validation.valid) {
    return validation;
  }
  return { valid: true, value: String(value).trim() };
}

/**
 * Requires API key authentication for settings routes.
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next handler
 */
const requireAuth = (req, res, next) => {
  const apiKey = normalizeApiKey(req.headers['x-api-key'] || req.query.api_key);
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
router.post('/settings/wigle', async (req, res) => {
  try {
    const { apiName, apiToken } = req.body;

    const apiNameValidation = validateString(String(apiName || ''), 1, 128, 'apiName');
    if (!apiNameValidation.valid) {
      return res.status(400).json({ error: apiNameValidation.error });
    }

    const apiTokenValidation = validateString(String(apiToken || ''), 1, 256, 'apiToken');
    if (!apiTokenValidation.valid) {
      return res.status(400).json({ error: apiTokenValidation.error });
    }

    await keyringService.setWigleCredentials(String(apiName).trim(), String(apiToken).trim());

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
router.get('/settings/mapbox', async (req, res) => {
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
router.post('/settings/mapbox', async (req, res) => {
  try {
    const { token, label = 'default' } = req.body;

    const tokenValidation = validateMapboxToken(token);
    if (!tokenValidation.valid) {
      return res.status(400).json({ error: tokenValidation.error });
    }

    const labelValidation = validateLabel(label);
    if (!labelValidation.valid) {
      return res.status(400).json({ error: labelValidation.error });
    }

    await keyringService.setMapboxToken(tokenValidation.value, labelValidation.value);

    res.json({ success: true, label: labelValidation.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set primary Mapbox token
router.post('/settings/mapbox/primary', requireAuth, async (req, res) => {
  try {
    const { label } = req.body;
    const labelValidation = validateLabel(label);
    if (!labelValidation.valid) {
      return res.status(400).json({ error: labelValidation.error });
    }
    await keyringService.setPrimaryMapboxToken(labelValidation.value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Google Maps API key (masked)
router.get('/settings/google-maps', async (req, res) => {
  try {
    const apiKey =
      (await keyringService.getCredential('google_maps_api_key')) ||
      secretsManager.get('google_maps_api_key');
    if (!apiKey) {
      return res.json({ configured: false });
    }
    res.json({
      configured: true,
      apiKey: `${apiKey.substring(0, 6)}...${apiKey.slice(-4)}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set Google Maps API key
router.post('/settings/google-maps', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const keyValidation = validateGoogleMapsKey(apiKey);
    if (!keyValidation.valid) {
      return res.status(400).json({ error: keyValidation.error });
    }

    await keyringService.setCredential('google_maps_api_key', keyValidation.value);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Mapbox token
router.delete('/settings/mapbox/:label', requireAuth, async (req, res) => {
  try {
    const labelValidation = validateLabel(req.params.label);
    if (!labelValidation.valid) {
      return res.status(400).json({ error: labelValidation.error });
    }
    await keyringService.deleteMapboxToken(labelValidation.value);
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
