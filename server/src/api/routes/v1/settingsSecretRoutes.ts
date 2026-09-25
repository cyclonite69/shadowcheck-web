export {};
import type { Request, Response } from 'express';
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../../middleware/authMiddleware');
const helpers = require('./settingsHelpers');

const registerSingleSecretRoutes = ({
  getPath,
  postPath,
  responseKey = 'value',
  secretKey,
  validateValue,
  router,
  secretsManager,
  requireAuthForPost = true,
}: {
  getPath: string;
  postPath: string;
  responseKey?: string;
  secretKey: string;
  validateValue: any;
  router: any;
  secretsManager: any;
  requireAuthForPost?: boolean;
}) => {
  router.get(getPath, requireAuth, async (_req: Request, res: Response) => {
    try {
      const value = await secretsManager.getSecret(secretKey);
      res.json({ configured: Boolean(value), [responseKey]: value || '' });
    } catch (error) {
      res.status(500).json({ error: helpers.getErrorMessage(error) });
    }
  });

  const postMiddleware = requireAuthForPost ? [requireAuth] : [];
  router.post(postPath, ...postMiddleware, async (req: Request, res: Response) => {
    try {
      const incomingValue = helpers.getIncomingValue(req.body, 'apiKey');

      const validator = (typeof validateValue === 'string') ? helpers[validateValue] : validateValue;
      const validation = validator(incomingValue);

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      await secretsManager.putSecret(secretKey, validation.value);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: helpers.getErrorMessage(error) });
    }
  });
};

const registerProviderSecretRoutes = ({ router, secretsManager }: { router: any; secretsManager: any }) => {
  registerSingleSecretRoutes({
    getPath: '/settings/mapbox-unlimited',
    postPath: '/settings/mapbox-unlimited',
    secretKey: 'mapbox_unlimited_api_key',
    validateValue: 'validateGenericKey',
    router,
    secretsManager,
  });

  registerSingleSecretRoutes({
    getPath: '/settings/google-maps',
    postPath: '/settings/google-maps',
    secretKey: 'google_maps_api_key',
    validateValue: 'validateGoogleMapsKey',
    router,
    secretsManager,
    requireAuthForPost: false,
  });

  registerSingleSecretRoutes({
    getPath: '/settings/opencage',
    postPath: '/settings/opencage',
    secretKey: 'opencage_api_key',
    validateValue: 'validateGenericKey',
    router,
    secretsManager,
  });

  registerSingleSecretRoutes({
    getPath: '/settings/geocodio',
    postPath: '/settings/geocodio',
    secretKey: 'geocodio_api_key',
    validateValue: 'validateGenericKey',
    router,
    secretsManager,
  });

  registerSingleSecretRoutes({
    getPath: '/settings/locationiq',
    postPath: '/settings/locationiq',
    secretKey: 'locationiq_api_key',
    validateValue: 'validateGenericKey',
    router,
    secretsManager,
  });
};

module.exports = {
  registerProviderSecretRoutes,
};
