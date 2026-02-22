export {};
const express = require('express');
const router = express.Router();
const { secretsManager } = require('../../../config/container');
const { requireAuth } = require('../../../middleware/authMiddleware');
const { validateString } = require('../../../validation/schemas');

/**
 * Validates a mapbox token string.
 * @param {any} value - Raw token input
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
function validateMapboxToken(value) {
  const validation = validateString(String(value || ''), 'token');
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
  const validation = validateString(String(value || ''), 'label');
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
  const validation = validateString(String(value || ''), 'google_maps_api_key');
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
  const validation = validateString(String(value || ''), field);
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
  const validation = validateString(String(value || ''), 'aws_region');
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

    const name = String(apiName).trim();
    const token = String(apiToken).trim();
    const encoded = Buffer.from(`${name}:${token}`).toString('base64');

    try {
      await secretsManager.putSecrets({
        wigle_api_name: name,
        wigle_api_token: token,
        wigle_api_encoded: encoded,
      });
    } catch (smError: any) {
      console.error('[WiGLE Settings] Failed to save to Secrets Manager:', smError);
      return res.status(500).json({
        error: 'Failed to save credentials to AWS Secrets Manager',
        details: smError?.message || String(smError),
      });
    }

    // Test credentials
    let testResult;
    try {
      const response = await fetch('https://api.wigle.net/api/v2/profile/user', {
        headers: { Accept: 'application/json', Authorization: `Basic ${encoded}` },
      });
      if (response.ok) {
        const data = await response.json();
        testResult = { success: true, user: (data as any).user };
      } else {
        testResult = { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error: any) {
      testResult = { success: false, error: error.message };
    }

    res.json({
      success: true,
      test: testResult,
    });
  } catch (error: any) {
    console.error('[WiGLE Settings] Unexpected error:', error);
    res.status(500).json({ error: error?.message || String(error) });
  }
});

// Test WiGLE credentials
router.get('/settings/wigle/test', requireAuth, async (req, res) => {
  try {
    const encoded = secretsManager.get('wigle_api_encoded');
    if (!encoded) {
      return res.json({ success: false, error: 'No credentials stored' });
    }
    const response = await fetch('https://api.wigle.net/api/v2/profile/user', {
      headers: { Accept: 'application/json', Authorization: `Basic ${encoded}` },
    });
    if (response.ok) {
      const data = await response.json();
      res.json({ success: true, user: (data as any).user });
    } else {
      res.json({ success: false, error: `HTTP ${response.status}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Mapbox token status
router.get('/settings/mapbox', async (req, res) => {
  try {
    const token = await secretsManager.getSecret('mapbox_token');
    res.json({
      configured: Boolean(token),
      tokens: token ? [{ label: 'default', isPrimary: true }] : [],
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

    await secretsManager.putSecret('mapbox_unlimited_api_key', keyValidation.value);
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
    await secretsManager.deleteSecret('mapbox_token');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all stored credentials (names only)
router.get('/settings/list', requireAuth, async (req, res) => {
  try {
    const keys = Array.from(secretsManager.secrets.keys());
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
