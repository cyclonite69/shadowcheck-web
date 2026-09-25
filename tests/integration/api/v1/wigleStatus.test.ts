import request from 'supertest';
import express from 'express';

jest.mock('../../../../server/src/services/secretsManager', () => ({
  get: jest.fn(),
}));

jest.mock('../../../../server/src/middleware/authMiddleware', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../../server/src/services/wigleRequestLedger', () => ({
  getQuotaStatus: jest.fn().mockReturnValue({
    windowHours: 24,
    counts: { search: 0, detail: 0, stats: 0 },
    softLimits: { search: 50, detail: 200, stats: 10 },
    hardLimits: { search: 100, detail: 400, stats: 20 },
  }),
  resetQuotaLedger: jest.fn(),
}));

const secretsManager = require('../../../../server/src/services/secretsManager');
const ledger = require('../../../../server/src/services/wigleRequestLedger');
const statusRouter = require('../../../../server/src/api/routes/v1/wigle/status').default;

const app = express();
app.use(express.json());
app.use('/api/wigle', statusRouter);

describe('wigleStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ledger.getQuotaStatus.mockReturnValue({
      windowHours: 24,
      counts: { search: 0, detail: 0, stats: 0 },
      softLimits: { search: 50, detail: 200, stats: 10 },
      hardLimits: { search: 100, detail: 400, stats: 20 },
    });
  });

  it('should return configured status', async () => {
    secretsManager.get.mockImplementation((key: string) => {
      if (key === 'wigle_api_name') {
        return 'name';
      }
      if (key === 'wigle_api_token') {
        return 'token';
      }
      return null;
    });
    const res = await request(app).get('/api/wigle/api-status');
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
  });

  it('should return unconfigured status', async () => {
    secretsManager.get.mockReturnValue(null);
    const res = await request(app).get('/api/wigle/api-status');
    expect(res.body.configured).toBe(false);
  });

  it('GET /quota-status returns quota data', async () => {
    const res = await request(app).get('/api/wigle/quota-status');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.quota).toHaveProperty('counts');
    expect(res.body.quota).toHaveProperty('softLimits');
  });

  it('POST /quota-reset calls resetQuotaLedger and returns updated quota', async () => {
    const res = await request(app).post('/api/wigle/quota-reset');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(ledger.resetQuotaLedger).toHaveBeenCalledTimes(1);
    expect(res.body.quota).toHaveProperty('counts');
  });
});
