export {};
import type { Request, Response } from 'express';
const express = require('express');
const router = express.Router();
const { secretsManager } = require('../../../config/container');
const { adminQuery } = require('../../../services/adminDbService');
const { requireAuth } = require('../../../middleware/authMiddleware');
const { registerProviderSecretRoutes } = require('./settingsSecretRoutes');
const {
  registerMapboxCleanupRoutes,
  registerMapboxTokenRoutes,
  registerSmartyRoutes,
  registerWiGLERoutes,
} = require('./settingsMultiSecretRoutes');

registerProviderSecretRoutes({ router, secretsManager });
registerWiGLERoutes({ router, secretsManager });
registerMapboxTokenRoutes({ router, secretsManager });
registerSmartyRoutes({ router, secretsManager });
registerMapboxCleanupRoutes({ router, secretsManager });
const { getConfiguredAwsRegion, getErrorMessage, validateAwsRegion } = require('./settingsHelpers');

// Get AWS runtime configuration (region only; credentials use provider chain)
router.get('/settings/aws', requireAuth, async (req: Request, res: Response) => {
  try {
    const configuredRegion = await getConfiguredAwsRegion();
    const region = configuredRegion || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

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

module.exports = router;
