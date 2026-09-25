import request from 'supertest';
import express from 'express';

const mockGetConfiguredAwsRegion = jest.fn().mockResolvedValue('us-east-1');
const mockValidateAwsRegion = jest
  .fn()
  .mockImplementation((val: any) => ({
    valid: Boolean(val),
    value: val,
    error: 'Invalid AWS Region',
  }));
const mockSetAwsRegion = jest.fn();

const mockSecretsManager = {
  awsLoaded: true,
  awsCache: {},
  load: jest.fn().mockResolvedValue(undefined),
  smReachable: true,
  smLastError: null as any,
  getSecret: jest.fn(),
  putSecret: jest.fn(),
};

jest.mock('../../server/src/config/container', () => ({
  secretsManager: mockSecretsManager,
}));

jest.mock('../../server/src/services/adminSettingsService', () => ({
  setAwsRegion: (...args: any[]) => mockSetAwsRegion(...args),
}));

jest.mock('../../server/src/middleware/authMiddleware', () => ({
  requireAuth: (req: any, res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => next(),
}));

jest.mock('../../server/src/api/routes/v1/settingsHelpers', () => ({
  __esModule: true,
  getErrorMessage: (err: any) => err.message,
  getConfiguredAwsRegion: mockGetConfiguredAwsRegion,
  validateAwsRegion: (...args: any[]) => mockValidateAwsRegion(...args),
  validateGenericKey: (val: any) => ({ valid: Boolean(val), value: val }),
  validateGoogleMapsKey: (val: any) => ({ valid: Boolean(val), value: val }),
  getIncomingValue: (body: any, key: string) => body[key] || body.token || body.value,
}));

jest.mock('../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

// We must require the routes after all mocks are in place
const {
  registerProviderSecretRoutes,
} = require('../../server/src/api/routes/v1/settingsSecretRoutes');
const adminSettingsRouter = require('../../server/src/api/routes/v1/settings');

describe('settings routes', () => {
  let app: any;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    const router = express.Router();
    registerProviderSecretRoutes({ router, secretsManager: mockSecretsManager });
    app.use('/api', router);
    app.use('/api', adminSettingsRouter);
  });

  describe('settingsSecretRoutes (Provider Secrets)', () => {
    it('should get mapbox-unlimited status', async () => {
      mockSecretsManager.getSecret = jest.fn().mockResolvedValueOnce('pk.123');
      const res = await request(app).get('/api/settings/mapbox-unlimited');
      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
    });

    it('should post google-maps key', async () => {
      mockSecretsManager.putSecret = jest.fn().mockResolvedValueOnce(undefined);
      const res = await request(app).post('/api/settings/google-maps').send({ apiKey: 'test_key' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('admin settings routes', () => {
    it('should get aws settings', async () => {
      mockGetConfiguredAwsRegion.mockResolvedValueOnce('us-east-1');
      const res = await request(app).get('/api/settings/aws');
      expect(res.status).toBe(200);
      expect(res.body.region).toBe('us-east-1');
    });

    it('should fallback to env AWS_REGION if DB region is null', async () => {
      mockGetConfiguredAwsRegion.mockResolvedValueOnce(null);
      process.env.AWS_REGION = 'us-west-1';
      const res = await request(app).get('/api/settings/aws');
      expect(res.status).toBe(200);
      expect(res.body.region).toBe('us-west-1');
      delete process.env.AWS_REGION;
    });

    it('should handle error when getting aws settings fails', async () => {
      mockGetConfiguredAwsRegion.mockRejectedValueOnce(new Error('DB connection failed'));
      const res = await request(app).get('/api/settings/aws');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB connection failed');
    });

    it('should post aws region', async () => {
      mockValidateAwsRegion.mockReturnValueOnce({ valid: true, value: 'us-west-2' });
      mockSetAwsRegion.mockResolvedValueOnce(undefined);
      const res = await request(app).post('/api/settings/aws').send({ region: 'us-west-2' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSetAwsRegion).toHaveBeenCalledWith('us-west-2');
    });

    it('should reject invalid aws region', async () => {
      mockValidateAwsRegion.mockReturnValueOnce({ valid: false, error: 'Invalid AWS Region' });
      const res = await request(app).post('/api/settings/aws').send({ region: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid AWS Region');
    });

    it('should handle error when setting aws region fails', async () => {
      mockValidateAwsRegion.mockReturnValueOnce({ valid: true, value: 'us-west-2' });
      mockSetAwsRegion.mockRejectedValueOnce(new Error('Write error'));
      const res = await request(app).post('/api/settings/aws').send({ region: 'us-west-2' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Write error');
    });

    it('should reload secrets successfully', async () => {
      mockSecretsManager.load.mockResolvedValueOnce(undefined);
      mockSecretsManager.smReachable = true;
      mockSecretsManager.smLastError = null;
      mockSecretsManager.awsLoaded = true;
      mockSecretsManager.awsCache = {};

      const res = await request(app).post('/api/settings/reload-secrets');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        smReachable: true,
        smLastError: null,
      });
      expect(mockSecretsManager.load).toHaveBeenCalled();
      expect(mockSecretsManager.awsLoaded).toBe(false);
      expect(mockSecretsManager.awsCache).toBeNull();
    });

    it('should handle error when reloading secrets fails', async () => {
      mockSecretsManager.load.mockRejectedValueOnce(new Error('Secrets Manager unreachable'));
      const res = await request(app).post('/api/settings/reload-secrets');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Secrets Manager unreachable');
    });
  });
});
