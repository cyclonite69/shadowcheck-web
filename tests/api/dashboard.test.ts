/**
 * Dashboard API tests
 */

export {};

// Mock secretsManager
export {};

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

const NetworkRepository = require('../../server/src/repositories/networkRepository');
const DashboardService = require('../../server/src/services/dashboardService');

describe('Dashboard API', () => {
  let dashboardService: any;
  let networkRepository: any;

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

    it('should get network distribution from metrics', async () => {
      jest.spyOn(networkRepository, 'getDashboardMetrics').mockResolvedValue({
        totalNetworks: 1000,
        wifiCount: 600,
        bleCount: 200,
        bluetoothCount: 100,
        lteCount: 100,
      });

      const distribution = await dashboardService.getNetworkDistribution();

      expect(distribution).toEqual({
        wifi: 600,
        ble: 200,
        bluetooth: 100,
        lte: 100,
        total: 1000,
      });
    });

    it('should handle zero distribution values', async () => {
      jest.spyOn(networkRepository, 'getDashboardMetrics').mockResolvedValue({
        totalNetworks: 0,
        wifiCount: 0,
        bleCount: 0,
        bluetoothCount: 0,
        lteCount: 0,
      });

      const distribution = await dashboardService.getNetworkDistribution();

      expect(distribution).toEqual({
        wifi: 0,
        ble: 0,
        bluetooth: 0,
        lte: 0,
        total: 0,
      });
    });

    it('should throw error on database failure', async () => {
      jest
        .spyOn(networkRepository, 'getDashboardMetrics')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(dashboardService.getMetrics()).rejects.toThrow('Database connection failed');
    });
  });

  describe('NetworkRepository', () => {
    it('should execute dashboard metrics query (via mocked database)', async () => {
      const { query } = require('../../server/src/config/database');

      // NetworkRepository.getDashboardMetrics() now runs a single consolidated query.
      query.mockResolvedValueOnce({
        rows: [
          {
            total_networks: '100',
            wifi_count: '60',
            ble_count: '20',
            bluetooth_count: '10',
            lte_count: '10',
            nr_count: '0',
            gsm_count: '0',
            total_observations: '0',
            wifi_observations: '0',
            ble_observations: '0',
            bluetooth_observations: '0',
            lte_observations: '0',
            nr_observations: '0',
            gsm_observations: '0',
            threats_critical: '0',
            threats_high: '10',
            threats_medium: '0',
            threats_low: '0',
            enriched_count: '25',
          },
        ],
      });

      const metrics = await networkRepository.getDashboardMetrics();

      expect(metrics.totalNetworks).toBe(100);
      expect(metrics.enrichedCount).toBe(25);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('should handle missing data with defaults (via mocked database)', async () => {
      const { query } = require('../../server/src/config/database');

      // Mock empty responses
      query.mockResolvedValue({ rows: [] });

      const metrics = await networkRepository.getDashboardMetrics();

      expect(metrics.totalNetworks).toBe(0);
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
    //   .get('/api/dashboard/metrics')
    //   .expect(200)
    //   .expect('Content-Type', /json/);
    //
    // expect(response.body).toHaveProperty('totalNetworks');
    // expect(response.body).toHaveProperty('threatsCount');
  });
});
