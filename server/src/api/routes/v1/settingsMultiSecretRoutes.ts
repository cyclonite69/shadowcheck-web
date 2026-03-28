export {};
import type { Request, Response } from 'express';

const { requireAuth } = require('../../../middleware/authMiddleware');
const {
  getErrorMessage,
  getIncomingValue,
  validateGenericKey,
  validateLabel,
  validateMapboxToken,
  validateString,
} = require('./settingsHelpers');

const registerWiGLERoutes = ({ router, secretsManager }: { router: any; secretsManager: any }) => {
  router.get('/settings/wigle', requireAuth, async (_req: Request, res: Response) => {
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

  router.get('/settings/wigle/test', requireAuth, async (_req: Request, res: Response) => {
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
};

const registerMapboxTokenRoutes = ({ router, secretsManager }: { router: any; secretsManager: any }) => {
  router.get('/settings/mapbox', requireAuth, async (_req: Request, res: Response) => {
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
};

const registerMapboxCleanupRoutes = ({ router, secretsManager }: { router: any; secretsManager: any }) => {
  router.delete('/settings/mapbox/:label', requireAuth, async (_req: Request, res: Response) => {
    try {
      await secretsManager.deleteSecret('mapbox_token');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  router.get('/settings/list', requireAuth, async (_req: Request, res: Response) => {
    try {
      const keys = Array.from(secretsManager.secrets.keys());
      res.json({ keys });
    } catch (error) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
};

const registerSmartyRoutes = ({ router, secretsManager }: { router: any; secretsManager: any }) => {
  router.get('/settings/smarty', requireAuth, async (_req: Request, res: Response) => {
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
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
};

module.exports = {
  registerMapboxCleanupRoutes,
  registerMapboxTokenRoutes,
  registerSmartyRoutes,
  registerWiGLERoutes,
};
