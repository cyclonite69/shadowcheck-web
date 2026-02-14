export {};
const express = require('express');
const router = express.Router();
const keyringService = require('../../../services/keyringService').default;
const secretsManager = require('../../../services/secretsManager').default;
const { requireAuth } = require('../../../middleware/authMiddleware');
const { validateString } = require('../../../validation/schemas');

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
 * Validates a generic API key string.
 * @param {any} value - Raw key input
 * @param {string} field - Field name for error messages
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
function validateGenericKey(value, field) {
  const validation = validateString(String(value || ''), 1, 256, field);
  if (!validation.valid) {
    return validation;
  }
  return { valid: true, value: String(value).trim() };
}

/**
 * Validates an AWS region string.
 * @param {any} value - Raw region input
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
function validateAwsRegion(value) {
  const validation = validateString(String(value || ''), 1, 64, 'aws_region');
  if (!validation.valid) {
    return validation;
  }
  return { valid: true, value: String(value).trim() };
}

// Get WiGLE credentials (masked)
router.get('/settings/wigle', requireAuth, async (req, res) => {
  try {
    const apiName = await secretsManager.getSecret('wigle_api_name');
    const apiToken = await secretsManager.getSecret('wigle_api_token');
    res.json({ configured: Boolean(apiName && apiToken) });
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
    await secretsManager.putSecrets({
      wigle_api_name: String(apiName).trim(),
      wigle_api_token: String(apiToken).trim(),
    });
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
    const tokensWithMeta = tokens.map((t) => ({
      label: t.label,
      isPrimary: t.isPrimary,
    }));
    const fallbackToken = await secretsManager.getSecret('mapbox_token');
    res.json({
      configured: tokensWithMeta.length > 0 || Boolean(fallbackToken),
      tokens: tokensWithMeta,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set Mapbox token
router.post('/settings/mapbox', async (req, res) => {
  try {
    const { token, value, label = 'default' } = req.body;
    const incomingToken = value ?? token;

    const tokenValidation = validateMapboxToken(incomingToken);
    if (!tokenValidation.valid) {
      return res.status(400).json({ error: tokenValidation.error });
    }

    const labelValidation = validateLabel(label);
    if (!labelValidation.valid) {
      return res.status(400).json({ error: labelValidation.error });
    }

    await keyringService.setMapboxToken(tokenValidation.value, labelValidation.value);
    await secretsManager.putSecret('mapbox_token', tokenValidation.value);
    res.json({ success: true, label: labelValidation.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Mapbox unlimited (geocoding) key (masked)
router.get('/settings/mapbox-unlimited', async (req, res) => {
  try {
    const apiKey = await secretsManager.getSecret('mapbox_unlimited_api_key');
    res.json({ configured: Boolean(apiKey) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set Mapbox unlimited (geocoding) key
router.post('/settings/mapbox-unlimited', async (req, res) => {
  try {
    const { apiKey, value } = req.body;
    const incomingValue = apiKey ?? value;
    const keyValidation = validateGenericKey(incomingValue, 'mapbox_unlimited_api_key');
    if (!keyValidation.valid) {
      return res.status(400).json({ error: keyValidation.error });
    }

    await keyringService.setCredential('mapbox_unlimited_api_key', keyValidation.value);
    await secretsManager.putSecret('mapbox_unlimited_api_key', keyValidation.value);
    res.json({ success: true });
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
    const apiKey = await secretsManager.getSecret('google_maps_api_key');
    res.json({ configured: Boolean(apiKey) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set Google Maps API key
router.post('/settings/google-maps', async (req, res) => {
  try {
    const { apiKey, value } = req.body;
    const incomingValue = apiKey ?? value;
    const keyValidation = validateGoogleMapsKey(incomingValue);
    if (!keyValidation.valid) {
      return res.status(400).json({ error: keyValidation.error });
    }

    await keyringService.setCredential('google_maps_api_key', keyValidation.value);
    await secretsManager.putSecret('google_maps_api_key', keyValidation.value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get OpenCage API key (masked)
router.get('/settings/opencage', async (req, res) => {
  try {
    const apiKey = await secretsManager.getSecret('opencage_api_key');
    res.json({ configured: Boolean(apiKey) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set OpenCage API key
router.post('/settings/opencage', async (req, res) => {
  try {
    const { apiKey, value } = req.body;
    const incomingValue = apiKey ?? value;
    const keyValidation = validateGenericKey(incomingValue, 'opencage_api_key');
    if (!keyValidation.valid) {
      return res.status(400).json({ error: keyValidation.error });
    }

    await keyringService.setCredential('opencage_api_key', keyValidation.value);
    await secretsManager.putSecret('opencage_api_key', keyValidation.value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get LocationIQ API key (masked)
router.get('/settings/locationiq', async (req, res) => {
  try {
    const apiKey = await secretsManager.getSecret('locationiq_api_key');
    res.json({ configured: Boolean(apiKey) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set LocationIQ API key
router.post('/settings/locationiq', async (req, res) => {
  try {
    const { apiKey, value } = req.body;
    const incomingValue = apiKey ?? value;
    const keyValidation = validateGenericKey(incomingValue, 'locationiq_api_key');
    if (!keyValidation.valid) {
      return res.status(400).json({ error: keyValidation.error });
    }

    await keyringService.setCredential('locationiq_api_key', keyValidation.value);
    await secretsManager.putSecret('locationiq_api_key', keyValidation.value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get AWS credentials (masked)
router.get('/settings/aws', async (req, res) => {
  try {
    const accessKeyId = await secretsManager.getSecret('aws_access_key_id');
    const secretAccessKey = await secretsManager.getSecret('aws_secret_access_key');
    const sessionToken = await secretsManager.getSecret('aws_session_token');
    const region = await secretsManager.getSecret('aws_region');

    const configured = Boolean(accessKeyId && secretAccessKey && region);
    res.json({ configured, region: region || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set AWS credentials
router.post('/settings/aws', async (req, res) => {
  try {
    const { accessKeyId, secretAccessKey, sessionToken, region } = req.body;
    const idValidation = validateGenericKey(accessKeyId, 'aws_access_key_id');
    if (!idValidation.valid) {
      return res.status(400).json({ error: idValidation.error });
    }
    const secretValidation = validateGenericKey(secretAccessKey, 'aws_secret_access_key');
    if (!secretValidation.valid) {
      return res.status(400).json({ error: secretValidation.error });
    }
    const regionValidation = validateAwsRegion(region);
    if (!regionValidation.valid) {
      return res.status(400).json({ error: regionValidation.error });
    }

    await keyringService.setCredential('aws_access_key_id', idValidation.value);
    await keyringService.setCredential('aws_secret_access_key', secretValidation.value);
    await keyringService.setCredential('aws_region', regionValidation.value);
    const awsUpdates: Record<string, string> = {
      aws_access_key_id: idValidation.value,
      aws_secret_access_key: secretValidation.value,
      aws_region: regionValidation.value,
    };
    if (sessionToken) {
      const tokenValidation = validateGenericKey(sessionToken, 'aws_session_token');
      if (!tokenValidation.valid) {
        return res.status(400).json({ error: tokenValidation.error });
      }
      await keyringService.setCredential('aws_session_token', tokenValidation.value);
      awsUpdates.aws_session_token = tokenValidation.value;
    }
    await secretsManager.putSecrets(awsUpdates);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Smarty credentials (masked)
router.get('/settings/smarty', async (req, res) => {
  try {
    const authId = await secretsManager.getSecret('smarty_auth_id');
    const authToken = await secretsManager.getSecret('smarty_auth_token');
    res.json({ configured: Boolean(authId && authToken) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set Smarty credentials
router.post('/settings/smarty', async (req, res) => {
  try {
    const { authId, authToken } = req.body;
    const idValidation = validateGenericKey(authId, 'smarty_auth_id');
    if (!idValidation.valid) {
      return res.status(400).json({ error: idValidation.error });
    }
    const tokenValidation = validateGenericKey(authToken, 'smarty_auth_token');
    if (!tokenValidation.valid) {
      return res.status(400).json({ error: tokenValidation.error });
    }

    await keyringService.setCredential('smarty_auth_id', idValidation.value);
    await keyringService.setCredential('smarty_auth_token', tokenValidation.value);
    await secretsManager.putSecrets({
      smarty_auth_id: idValidation.value,
      smarty_auth_token: tokenValidation.value,
    });
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
