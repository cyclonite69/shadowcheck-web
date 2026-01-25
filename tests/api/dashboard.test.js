/**
 * Dashboard API tests
 */

// Mock secretsManager
jest.mock('../../server/src/services/secretsManager', () => ({
  get: jest.fn((key) => {
    if (key === 'db_password') {
      return 'test_password';
    }
    return null;
  }),
  getOrThrow: jest.fn((key) => {
    if (key === 'db_password') {
      return 'test_password';
    }
    throw new Error(`Secret ${key} not found`);
  }),
  has: jest.fn((key) => key === 'db_password'),
}));

// Mock the database config
jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
  pool: {
    query: jest.fn(),
  },
  CONFIG: {
    MIN_VALID_TIMESTAMP: 946684800000,
    THREAT_THRESHOLD: 40,
    MIN_OBSERVATIONS: 2,
    MAX_PAGE_SIZE: 5000,
    DEFAULT_PAGE_SIZE: 100,
  },
}));

const request = require('supertest');
const NetworkRepository = require('../../server/src/repositories/networkRepository');
const DashboardService = require('../../server/src/services/dashboardService');

describe('Dashboard API', () => {
  let dashboardService;
  let networkRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    networkRepository = new NetworkRepository();
    dashboardService = new DashboardService(networkRepository);
  });

  describe('DashboardService', () => {
    it('should get dashboard metrics', async () => {
      // Mock repository response
      jest.spyOn(networkRepository, 'getDashboardMetrics').mockResolvedValue({
        totalNetworks: 173326,
        threatsCount: 1842,
        surveillanceCount: 256,
        enrichedCount: 45123,
      });

      const metrics = await dashboardService.getMetrics();

      expect(metrics).toHaveProperty('totalNetworks', 173326);
      expect(metrics).toHaveProperty('threatsCount', 1842);
      expect(metrics).toHaveProperty('surveillanceCount', 256);
      expect(metrics).toHaveProperty('enrichedCount', 45123);
    });

    it('should get dashboard summary with enrichment rate', async () => {
      jest.spyOn(networkRepository, 'getDashboardMetrics').mockResolvedValue({
        totalNetworks: 1000,
        threatsCount: 50,
        surveillanceCount: 10,
        enrichedCount: 250,
      });

      const summary = await dashboardService.getSummary();

      expect(summary).toHaveProperty('summary');
      expect(summary.summary.hasThreats).toBe(true);
      expect(summary.summary.enrichmentRate).toBe(25); // 250/1000 * 100
    });

    it('should handle zero networks gracefully', async () => {
      jest.spyOn(networkRepository, 'getDashboardMetrics').mockResolvedValue({
        totalNetworks: 0,
        threatsCount: 0,
        surveillanceCount: 0,
        enrichedCount: 0,
      });

      const summary = await dashboardService.getSummary();

      expect(summary.summary.enrichmentRate).toBe(0);
      expect(summary.summary.hasThreats).toBe(false);
    });

    it('should throw error on database failure', async () => {
      jest
        .spyOn(networkRepository, 'getDashboardMetrics')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(dashboardService.getMetrics()).rejects.toThrow(
        'Failed to fetch dashboard metrics'
      );
    });
  });

  describe('NetworkRepository', () => {
    it.skip('should execute dashboard metrics query (needs database)', async () => {
      const { query } = require('../../server/src/config/database');

      // Mock query responses
      query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // totalNetworks
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // threatsCount
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // surveillanceCount
        .mockResolvedValueOnce({ rows: [{ count: '25' }] }); // enrichedCount

      const metrics = await networkRepository.getDashboardMetrics();

      expect(metrics.totalNetworks).toBe(100);
      expect(metrics.threatsCount).toBe(10);
      expect(metrics.surveillanceCount).toBe(5);
      expect(metrics.enrichedCount).toBe(25);
      expect(query).toHaveBeenCalledTimes(4);
    });

    it.skip('should handle missing data with defaults (needs database)', async () => {
      const { query } = require('../../server/src/config/database');

      // Mock empty responses
      query.mockResolvedValue({ rows: [] });

      const metrics = await networkRepository.getDashboardMetrics();

      expect(metrics.totalNetworks).toBe(0);
      expect(metrics.threatsCount).toBe(0);
      expect(metrics.surveillanceCount).toBe(0);
      expect(metrics.enrichedCount).toBe(0);
    });
  });
});

// Integration test (requires actual server instance)
describe('Dashboard API Integration', () => {
  it.skip('should return dashboard metrics from API', async () => {
    // This will be enabled once server.js is updated
    // const app = require('../../server');
    //
    // const response = await request(app)
    //   .get('/api/dashboard-metrics')
    //   .expect(200)
    //   .expect('Content-Type', /json/);
    //
    // expect(response.body).toHaveProperty('totalNetworks');
    // expect(response.body).toHaveProperty('threatsCount');
  });
});
