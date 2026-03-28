export {};
import type { Request, Response } from 'express';

const { requireAuth } = require('../../../middleware/authMiddleware');
const {
  getErrorMessage,
  getIncomingValue,
  validateGenericKey,
  validateGoogleMapsKey,
} = require('./settingsHelpers');

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
  validateValue: (value: unknown) => { valid: boolean; error?: string; value?: string };
  router: any;
  secretsManager: any;
  requireAuthForPost?: boolean;
}) => {
  router.get(getPath, requireAuth, async (_req: Request, res: Response) => {
    try {
      const value = await secretsManager.getSecret(secretKey);
      res.json({ configured: Boolean(value), [responseKey]: value || '' });
    } catch (error) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  const postMiddleware = requireAuthForPost ? [requireAuth] : [];
  router.post(postPath, ...postMiddleware, async (req: Request, res: Response) => {
    try {
      const incomingValue = getIncomingValue(req.body, 'apiKey');
      const validation = validateValue(incomingValue);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      await secretsManager.putSecret(secretKey, validation.value);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
};

const registerProviderSecretRoutes = ({ router, secretsManager }: { router: any; secretsManager: any }) => {
  registerSingleSecretRoutes({
    getPath: '/settings/mapbox-unlimited',
    postPath: '/settings/mapbox-unlimited',
    secretKey: 'mapbox_unlimited_api_key',
    validateValue: (value: unknown) => validateGenericKey(value, 'mapbox_unlimited_api_key'),
    router,
    secretsManager,
  });

  registerSingleSecretRoutes({
    getPath: '/settings/google-maps',
    postPath: '/settings/google-maps',
    secretKey: 'google_maps_api_key',
    validateValue: validateGoogleMapsKey,
    router,
    secretsManager,
    requireAuthForPost: false,
  });

  registerSingleSecretRoutes({
    getPath: '/settings/opencage',
    postPath: '/settings/opencage',
    secretKey: 'opencage_api_key',
    validateValue: (value: unknown) => validateGenericKey(value, 'opencage_api_key'),
    router,
    secretsManager,
  });

  registerSingleSecretRoutes({
    getPath: '/settings/geocodio',
    postPath: '/settings/geocodio',
    secretKey: 'geocodio_api_key',
    validateValue: (value: unknown) => validateGenericKey(value, 'geocodio_api_key'),
    router,
    secretsManager,
  });

  registerSingleSecretRoutes({
    getPath: '/settings/locationiq',
    postPath: '/settings/locationiq',
    secretKey: 'locationiq_api_key',
    validateValue: (value: unknown) => validateGenericKey(value, 'locationiq_api_key'),
    router,
    secretsManager,
  });
};

module.exports = {
  registerProviderSecretRoutes,
};
