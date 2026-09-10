import express from 'express';
import request from 'supertest';

const siblingDetectionAdminService = {
  startSiblingRefresh: jest.fn(),
  cancelSiblingRefresh: jest.fn(),
  getSiblingRefreshStatusReconciled: jest.fn(),
  getSiblingStats: jest.fn(),
  getSiblingStatsByRule: jest.fn(),
  purgeSiblingPairs: jest.fn(),
};
const adminSiblingService = {
  setNetworkSiblingOverride: jest.fn(),
  getNetworkSiblingLinks: jest.fn(),
  getSiblingComponentBssids: jest.fn(),
  getNetworkSiblingLinksBatch: jest.fn(),
};
const logger = {
  error: jest.fn(),
};

jest.mock('../../server/src/config/container', () => ({
  siblingDetectionAdminService,
  adminSiblingService,
}));

jest.mock('../../server/src/logging/logger', () => logger);

const siblingRouter = require('../../server/src/api/routes/v1/admin/siblings');

const app = express();
app.use(express.json());
app.use('/api', (req, _res, next) => {
  (req as any).user = { username: 'operator' };
  next();
});
app.use('/api', siblingRouter);

describe('admin sibling routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes and saves a manual sibling override', async () => {
    adminSiblingService.setNetworkSiblingOverride.mockResolvedValueOnce(undefined);

    const response = await request(app).post('/api/admin/siblings/override').send({
      bssidA: ' aa:bb:cc:dd:ee:01 ',
      bssidB: 'aa:bb:cc:dd:ee:02',
      relation: 'not_sibling',
      notes: ' reviewed ',
    });

    expect(response.status).toBe(200);
    expect(adminSiblingService.setNetworkSiblingOverride).toHaveBeenCalledWith(
      'AA:BB:CC:DD:EE:01',
      'AA:BB:CC:DD:EE:02',
      'not_sibling',
      'operator',
      'reviewed',
      1
    );
  });

  it.each([
    [{ bssidA: '', bssidB: 'AA:BB:CC:DD:EE:02' }, 'Both bssidA and bssidB are required'],
    [
      { bssidA: 'AA:BB:CC:DD:EE:01', bssidB: 'AA:BB:CC:DD:EE:01' },
      'A network cannot be paired with itself',
    ],
  ])('rejects invalid manual overrides', async (body, error) => {
    const response = await request(app).post('/api/admin/siblings/override').send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(error);
  });

  it('returns service errors for manual overrides', async () => {
    adminSiblingService.setNetworkSiblingOverride.mockRejectedValueOnce(new Error('save failed'));

    const response = await request(app).post('/api/admin/siblings/override').send({
      bssidA: 'AA:BB:CC:DD:EE:01',
      bssidB: 'AA:BB:CC:DD:EE:02',
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('save failed');
  });

  it('loads direct links and a full sibling component', async () => {
    adminSiblingService.getNetworkSiblingLinks.mockResolvedValueOnce([{ bssid: 'B' }]);
    adminSiblingService.getSiblingComponentBssids.mockResolvedValueOnce(['A', 'B', 'C']);

    const links = await request(app).get('/api/admin/siblings/linked/aa:bb:cc:dd:ee:01');
    const component = await request(app).get('/api/admin/siblings/component/aa:bb:cc:dd:ee:01');

    expect(links.status).toBe(200);
    expect(links.body.bssid).toBe('AA:BB:CC:DD:EE:01');
    expect(component.body).toEqual({
      ok: true,
      seed: 'AA:BB:CC:DD:EE:01',
      bssids: ['A', 'B', 'C'],
      size: 3,
    });
  });

  it('deduplicates batch link requests and handles an empty batch', async () => {
    adminSiblingService.getNetworkSiblingLinksBatch.mockResolvedValueOnce([{ bssid: 'A' }]);

    const populated = await request(app)
      .post('/api/admin/siblings/linked-batch')
      .send({ bssids: [' aa:bb:cc:dd:ee:01 ', 'AA:BB:CC:DD:EE:01', '', null] });
    const empty = await request(app).post('/api/admin/siblings/linked-batch').send({});

    expect(populated.status).toBe(200);
    expect(adminSiblingService.getNetworkSiblingLinksBatch).toHaveBeenCalledWith([
      'AA:BB:CC:DD:EE:01',
    ]);
    expect(empty.body).toEqual({ ok: true, links: [] });
  });

  it('starts or rejects a sibling refresh based on service status', async () => {
    siblingDetectionAdminService.startSiblingRefresh
      .mockResolvedValueOnce({ accepted: true, status: { running: true } })
      .mockResolvedValueOnce({ accepted: false, status: { running: true } });

    const started = await request(app)
      .post('/api/admin/siblings/refresh')
      .send({ batchSize: 100, maxDistanceM: 50 });
    const duplicate = await request(app).post('/api/admin/siblings/refresh').send({});

    expect(started.status).toBe(202);
    expect(siblingDetectionAdminService.startSiblingRefresh).toHaveBeenCalledWith({
      batchSize: 100,
      maxOctetDelta: undefined,
      maxDistanceM: 50,
      minCandidateConf: undefined,
      minStrongConf: undefined,
      maxBatches: undefined,
      incremental: undefined,
    });
    expect(duplicate.status).toBe(409);
  });

  it('forwards incremental=true to startSiblingRefresh when set in body', async () => {
    siblingDetectionAdminService.startSiblingRefresh.mockResolvedValueOnce({
      accepted: true,
      status: { running: true },
    });

    const response = await request(app)
      .post('/api/admin/siblings/refresh')
      .send({ incremental: true });

    expect(response.status).toBe(202);
    expect(siblingDetectionAdminService.startSiblingRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ incremental: true })
    );
  });

  it('forwards incremental=false to startSiblingRefresh when explicitly set', async () => {
    siblingDetectionAdminService.startSiblingRefresh.mockResolvedValueOnce({
      accepted: true,
      status: { running: true },
    });

    const response = await request(app)
      .post('/api/admin/siblings/refresh')
      .send({ incremental: false });

    expect(response.status).toBe(202);
    expect(siblingDetectionAdminService.startSiblingRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ incremental: false })
    );
  });

  it('cancels a refresh and reports a rejected cancellation', async () => {
    siblingDetectionAdminService.cancelSiblingRefresh
      .mockResolvedValueOnce({ accepted: true, message: 'cancelled' })
      .mockResolvedValueOnce({ accepted: false, message: 'not running' });

    const cancelled = await request(app).post('/api/admin/siblings/cancel');
    const rejected = await request(app).post('/api/admin/siblings/cancel');

    expect(cancelled.status).toBe(200);
    expect(rejected.status).toBe(409);
  });

  it('returns refresh status, aggregate stats, and purge results', async () => {
    siblingDetectionAdminService.getSiblingRefreshStatusReconciled.mockResolvedValueOnce({
      running: false,
    });
    siblingDetectionAdminService.getSiblingStats.mockResolvedValueOnce({ total: 4 });
    siblingDetectionAdminService.getSiblingStatsByRule.mockResolvedValueOnce([{ rule: 'oui' }]);
    siblingDetectionAdminService.purgeSiblingPairs.mockResolvedValueOnce({ deleted: 4 });

    const status = await request(app).get('/api/admin/siblings/refresh/status');
    const stats = await request(app).get('/api/admin/siblings/stats');
    const purge = await request(app).delete('/api/admin/siblings/pairs');

    expect(status.body.status).toEqual({ running: false });
    expect(stats.body).toEqual({
      ok: true,
      stats: { total: 4 },
      byRule: [{ rule: 'oui' }],
    });
    expect(purge.body.deleted).toBe(4);
  });

  it.each([
    ['getNetworkSiblingLinks', 'get', '/api/admin/siblings/linked/AA:BB:CC:DD:EE:01'],
    ['getSiblingComponentBssids', 'get', '/api/admin/siblings/component/AA:BB:CC:DD:EE:01'],
    ['getNetworkSiblingLinksBatch', 'post', '/api/admin/siblings/linked-batch'],
    ['startSiblingRefresh', 'post', '/api/admin/siblings/refresh'],
    ['cancelSiblingRefresh', 'post', '/api/admin/siblings/cancel'],
    ['getSiblingRefreshStatusReconciled', 'get', '/api/admin/siblings/refresh/status'],
    ['getSiblingStats', 'get', '/api/admin/siblings/stats'],
    ['purgeSiblingPairs', 'delete', '/api/admin/siblings/pairs'],
  ])('returns 500 when %s fails', async (method, verb, path) => {
    const service =
      method in adminSiblingService ? adminSiblingService : siblingDetectionAdminService;
    (service as any)[method].mockRejectedValueOnce(new Error('service failed'));

    const operation = (request(app) as any)[verb](path);
    if (method === 'getNetworkSiblingLinksBatch') {
      operation.send({ bssids: ['AA:BB:CC:DD:EE:01'] });
    }
    const response = await operation;

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('service failed');
  });
});
