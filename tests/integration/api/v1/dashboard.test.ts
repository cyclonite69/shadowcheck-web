import request from 'supertest';
import express from 'express';

// Mock container
jest.mock('../../../../server/src/config/container', () => ({
  keplerService: {
    checkHomeLocationExists: jest.fn().mockResolvedValue(true),
  },
  filterQueryBuilder: require('../../../../server/src/services/filterQueryBuilder/validators'),
}));

const { router, initDashboardRoutes } = require('../../../../server/src/api/routes/v1/dashboard');

const mockDashboardService = {
  getMetrics: jest.fn(),
  getThreats: jest.fn(),
};

initDashboardRoutes({ dashboardService: mockDashboardService });

const app = express();
app.use(express.json());
app.use('/api', router);

describe('Dashboard API Integration Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    mockDashboardService.getMetrics.mockResolvedValue({
      threatsCritical: 1,
      threatsHigh: 0,
      threatsMedium: 0,
      threatsLow: 0,
      totalNetworks: 10,
      wifiCount: 5,
      bleCount: 5,
      lastUpdated: new Date().toISOString(),
    });

    mockDashboardService.getThreats.mockResolvedValue([
      { id: 1, bssid: 'AA:BB:CC:DD:EE:FF', severity: 'critical' },
    ]);
  });

  describe('GET /api/dashboard/metrics', () => {
    it('should return 200 and metrics', async () => {
      const res = await request(app).get('/api/dashboard/metrics');
      expect(res.status).toBe(200);
      expect(res.body.threats.critical).toBe(1);
      expect(res.body.networks.total).toBe(10);
    });

    it('should handle invalid JSON query filters', async () => {
      const res = await request(app).get('/api/dashboard/metrics?filters=invalid-json');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/dashboard/summary', () => {
    it('should return 200 and summary', async () => {
      const res = await request(app).get('/api/dashboard/summary');
      expect(res.status).toBe(200);
      expect(res.body.summary.criticalThreats).toBe(1);
      expect(res.body.summary.totalNetworks).toBe(10);
    });
  });

  describe('GET /api/dashboard/threats', () => {
    it('should return 200 and threats list', async () => {
      const res = await request(app).get('/api/dashboard/threats');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.threats[0].bssid).toBe('AA:BB:CC:DD:EE:FF');
    });
  });
});
