import request from 'supertest';
import express from 'express';

jest.mock('../../server/src/middleware/authMiddleware', () => ({
  requireAuth: (req: any, res: any, next: any) => next(),
}));

jest.mock('../../server/src/api/routes/v1/settingsHelpers', () => ({
  getErrorMessage: (err: any) => err.message,
  getIncomingValue: (body: any, key: string) => body[key] || body.token || body.value,
  validateGenericKey: (val: any, _key: string) => ({ valid: Boolean(val), value: val }),
  validateLabel: (val: any) => ({ valid: true, value: val || 'default' }),
  validateMapboxToken: (val: any) => ({ valid: Boolean(val), value: val }),
  validateString: (val: any, min: number, _max: number, _key: string) => ({ valid: Boolean(val) && val.length >= min, value: val }),
}));

const {
  registerWiGLERoutes,
  registerMapboxTokenRoutes,
  registerMapboxCleanupRoutes,
  registerSmartyRoutes,
} = require('../../server/src/api/routes/v1/settingsMultiSecretRoutes');

describe('settingsMultiSecretRoutes', () => {
  let app: any;
  let mockSecretsManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSecretsManager = {
      getSecret: jest.fn(),
      get: jest.fn(),
      putSecrets: jest.fn(),
      putSecret: jest.fn(),
      deleteSecret: jest.fn(),
      secrets: new Map([['key1', 'val1']]),
    };
    global.fetch = jest.fn();

    app = express();
    app.use(express.json());
    const router = express.Router();
    registerWiGLERoutes({ router, secretsManager: mockSecretsManager });
    registerMapboxTokenRoutes({ router, secretsManager: mockSecretsManager });
    registerMapboxCleanupRoutes({ router, secretsManager: mockSecretsManager });
    registerSmartyRoutes({ router, secretsManager: mockSecretsManager });
    app.use('/api', router);
  });

  describe('WiGLE routes', () => {
    it('should get wigle status', async () => {
      mockSecretsManager.getSecret.mockResolvedValueOnce('apiName');
      mockSecretsManager.getSecret.mockResolvedValueOnce('apiToken');
      const res = await request(app).get('/api/settings/wigle');
      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
    });

    it('should post wigle settings', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: 'testUser' }),
      });
      const res = await request(app).post('/api/settings/wigle').send({ apiName: 'name', apiToken: 'token' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSecretsManager.putSecrets).toHaveBeenCalled();
    });

    it('saves both wigle_api_name and wigle_api_token to secrets manager (regression: was only saving token)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: 'testUser' }),
      });
      await request(app).post('/api/settings/wigle').send({ apiName: 'myname', apiToken: 'mytoken' });
      const savedSecrets = mockSecretsManager.putSecrets.mock.calls[0][0];
      expect(savedSecrets).toHaveProperty('wigle_api_name', 'myname');
      expect(savedSecrets).toHaveProperty('wigle_api_token', 'mytoken');
      expect(savedSecrets).toHaveProperty('wigle_api_encoded');
    });

    it('returns 400 when apiName is missing', async () => {
      const res = await request(app).post('/api/settings/wigle').send({ apiToken: 'token' });
      expect(res.status).toBe(400);
      expect(mockSecretsManager.putSecrets).not.toHaveBeenCalled();
    });

    it('returns 400 when apiToken is missing', async () => {
      const res = await request(app).post('/api/settings/wigle').send({ apiName: 'name' });
      expect(res.status).toBe(400);
      expect(mockSecretsManager.putSecrets).not.toHaveBeenCalled();
    });

    it('should test wigle connection using name+token (same encoding as runtime)', async () => {
      mockSecretsManager.get.mockImplementation((key: string) => {
        if (key === 'wigle_api_name') {return 'n';}
        if (key === 'wigle_api_token') {return 't';}
        return null;
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: 'testUser' }),
      });
      const res = await request(app).get('/api/settings/wigle/test');
      expect(res.status).toBe(200);
    });

    it('returns no credentials when wigle name/token missing', async () => {
      mockSecretsManager.get.mockReturnValue(null);
      const res = await request(app).get('/api/settings/wigle/test');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No credentials stored');
    });
  });

  describe('Mapbox routes', () => {
    it('should get mapbox token', async () => {
      mockSecretsManager.getSecret.mockResolvedValueOnce('mapbox_token_val');
      const res = await request(app).get('/api/settings/mapbox');
      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
    });

    it('should post mapbox token', async () => {
      const res = await request(app).post('/api/settings/mapbox').send({ token: 'pk.123' });
      expect(res.status).toBe(200);
      expect(mockSecretsManager.putSecret).toHaveBeenCalled();
    });

    it('should delete mapbox token', async () => {
      const res = await request(app).delete('/api/settings/mapbox/default');
      expect(res.status).toBe(200);
      expect(mockSecretsManager.deleteSecret).toHaveBeenCalled();
    });

    it('should list keys', async () => {
      const res = await request(app).get('/api/settings/list');
      expect(res.status).toBe(200);
      expect(res.body.keys).toContain('key1');
    });
  });

  describe('Smarty routes', () => {
    it('should get smarty settings', async () => {
      mockSecretsManager.getSecret.mockResolvedValueOnce('id');
      mockSecretsManager.getSecret.mockResolvedValueOnce('token');
      const res = await request(app).get('/api/settings/smarty');
      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
    });

    it('should post smarty settings', async () => {
      const res = await request(app).post('/api/settings/smarty').send({ authId: 'id', authToken: 'token' });
      expect(res.status).toBe(200);
      expect(mockSecretsManager.putSecrets).toHaveBeenCalled();
    });
  });
});
