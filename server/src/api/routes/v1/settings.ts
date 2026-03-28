export {};
import type { Request, Response } from 'express';
const express = require('express');
const router = express.Router();
const { secretsManager } = require('../../../config/container');
const { adminQuery } = require('../../../services/adminDbService');
const { requireAuth } = require('../../../middleware/authMiddleware');
const { validateString } = require('../../../validation/schemas');
const {
  getConfiguredAwsRegion,
  getErrorMessage,
  getIncomingValue,
  validateAwsRegion,
  validateGenericKey,
  validateGoogleMapsKey,
  validateLabel,
  validateMapboxToken,
} = require('./settingsHelpers');

// Get WiGLE credentials (masked)
router.get('/settings/wigle', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiName = await secretsManager.getSecret('wigle_api_name');
    const apiToken = await secretsManager.getSecret('wigle_api_token');
    res.json({
      configured: Boolean(apiName && apiToken),
      apiName: apiName || '',
      apiToken: apiToken || '',
    });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Set WiGLE credentials
router.post('/settings/wigle', async (req: Request, res: Response) => {
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
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Test WiGLE credentials
router.get('/settings/wigle/test', requireAuth, async (req: Request, res: Response) => {
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
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Get Mapbox token status
router.get('/settings/mapbox', requireAuth, async (req: Request, res: Response) => {
  try {
    const token = await secretsManager.getSecret('mapbox_token');
    res.json({
      configured: Boolean(token),
      value: token || '',
      tokens: token ? [{ label: 'default', isPrimary: true }] : [],
    });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Set Mapbox token
router.post('/settings/mapbox', requireAuth, async (req: Request, res: Response) => {
  try {
    const { token, value, label = 'default' } = req.body;
    const incomingToken = getIncomingValue(req.body, 'token');

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
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Get Mapbox unlimited (geocoding) key (masked)
router.get('/settings/mapbox-unlimited', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await secretsManager.getSecret('mapbox_unlimited_api_key');
    res.json({ configured: Boolean(apiKey), value: apiKey || '' });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Set Mapbox unlimited (geocoding) key
router.post('/settings/mapbox-unlimited', requireAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey, value } = req.body;
    const incomingValue = getIncomingValue(req.body, 'apiKey');
    const keyValidation = validateGenericKey(incomingValue, 'mapbox_unlimited_api_key');
    if (!keyValidation.valid) {
      return res.status(400).json({ error: keyValidation.error });
    }

    await secretsManager.putSecret('mapbox_unlimited_api_key', keyValidation.value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Get Google Maps API key (masked)
router.get('/settings/google-maps', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await secretsManager.getSecret('google_maps_api_key');
    res.json({ configured: Boolean(apiKey), value: apiKey || '' });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Set Google Maps API key
router.post('/settings/google-maps', async (req: Request, res: Response) => {
  try {
    const { apiKey, value } = req.body;
    const incomingValue = getIncomingValue(req.body, 'apiKey');
    const keyValidation = validateGoogleMapsKey(incomingValue);
    if (!keyValidation.valid) {
      return res.status(400).json({ error: keyValidation.error });
    }

    await secretsManager.putSecret('google_maps_api_key', keyValidation.value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Get OpenCage API key (masked)
router.get('/settings/opencage', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await secretsManager.getSecret('opencage_api_key');
    res.json({ configured: Boolean(apiKey), value: apiKey || '' });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Set OpenCage API key
router.post('/settings/opencage', requireAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey, value } = req.body;
    const incomingValue = getIncomingValue(req.body, 'apiKey');
    const keyValidation = validateGenericKey(incomingValue, 'opencage_api_key');
    if (!keyValidation.valid) {
      return res.status(400).json({ error: keyValidation.error });
    }

    await secretsManager.putSecret('opencage_api_key', keyValidation.value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Get Geocodio API key (masked)
router.get('/settings/geocodio', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await secretsManager.getSecret('geocodio_api_key');
    res.json({ configured: Boolean(apiKey), value: apiKey || '' });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Set Geocodio API key
router.post('/settings/geocodio', requireAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey, value } = req.body;
    const incomingValue = getIncomingValue(req.body, 'apiKey');
    const keyValidation = validateGenericKey(incomingValue, 'geocodio_api_key');
    if (!keyValidation.valid) {
      return res.status(400).json({ error: keyValidation.error });
    }

    await secretsManager.putSecret('geocodio_api_key', keyValidation.value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Get LocationIQ API key (masked)
router.get('/settings/locationiq', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await secretsManager.getSecret('locationiq_api_key');
    res.json({ configured: Boolean(apiKey), value: apiKey || '' });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Set LocationIQ API key
router.post('/settings/locationiq', requireAuth, async (req: Request, res: Response) => {
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
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Get AWS runtime configuration (region only; credentials use provider chain)
router.get('/settings/aws', requireAuth, async (req: Request, res: Response) => {
  try {
    const region =
      (await getConfiguredAwsRegion()) || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

    res.json({
      configured: Boolean(region),
      region: region || null,
      mode: 'runtime_provider_chain',
    });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Set AWS region only (credentials must come from runtime provider chain)
router.post('/settings/aws', requireAuth, async (req: Request, res: Response) => {
  try {
    const { region } = req.body;
    const regionValidation = validateAwsRegion(region);
    if (!regionValidation.valid) {
      return res.status(400).json({ error: regionValidation.error });
    }

    await adminQuery(
      `
      INSERT INTO app.settings (key, value, description)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            description = EXCLUDED.description,
            updated_at = NOW()
    `,
      [
        'aws_region',
        JSON.stringify(regionValidation.value),
        'AWS region for runtime provider chain integrations',
      ]
    );

    res.json({ success: true, mode: 'runtime_provider_chain' });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Get Smarty credentials (masked)
router.get('/settings/smarty', requireAuth, async (req: Request, res: Response) => {
  try {
    const authId = await secretsManager.getSecret('smarty_auth_id');
    const authToken = await secretsManager.getSecret('smarty_auth_token');
    res.json({
      configured: Boolean(authId && authToken),
      authId: authId || '',
      authToken: authToken || '',
    });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Set Smarty credentials
router.post('/settings/smarty', async (req: Request, res: Response) => {
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
    const _msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: _msg });
  }
});

// Delete Mapbox token
router.delete('/settings/mapbox/:label', requireAuth, async (req: Request, res: Response) => {
  try {
    await secretsManager.deleteSecret('mapbox_token');
    res.json({ success: true });
  } catch (error) {
    const _msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: _msg });
  }
});

// List all stored credentials (names only)
router.get('/settings/list', requireAuth, async (req: Request, res: Response) => {
  try {
    const keys = Array.from(secretsManager.secrets.keys());
    res.json({ keys });
  } catch (error) {
    const _msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: _msg });
  }
});

module.exports = router;
