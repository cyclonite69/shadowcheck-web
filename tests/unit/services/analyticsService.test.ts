/**
 * Analytics Service Unit Tests
 * Consolidated tests for analyticsService and underlying modules
 */

export {};

const { query } = require('../../../server/src/config/database');
const analyticsService = require('../../../server/src/services/analyticsService');
const { DatabaseError } = require('../../../server/src/errors/AppError');

// Mock database query
jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBulkAnalytics()', () => {
    it('should retrieve all analytics categories for dashboard', async () => {
      // Mock responses for each concurrent query
      const networkTypesMock = { rows: [{ network_type: 'WiFi', count: '100' }] };
      const signalStrengthMock = { rows: [{ signal_range: '-30', count: '50' }] };
      const securityMock = { rows: [{ security_type: 'WPA2-P', count: '80' }] };
      const topNetworksMock = { rows: [{ bssid: 'AA:BB', ssid: 'Test', observations: '10' }] };
      const totalNetworksMock = { rows: [{ count: '1000' }] };
      const radioTypesMock = { rows: [{ radio_type: 'WiFi', count: '600' }] };

      // getBulkAnalytics calls:
      // 1. analytics.getNetworkTypes()
      // 2. analytics.getSignalStrengthDistribution()
      // 3. analytics.getSecurityDistribution()
      // 4. analytics.getTopNetworks(50)
      // 5. analytics.getDashboardStats() (which calls 2 queries)

      query
        .mockResolvedValueOnce(networkTypesMock)
        .mockResolvedValueOnce(signalStrengthMock)
        .mockResolvedValueOnce(securityMock)
        .mockResolvedValueOnce(topNetworksMock)
        .mockResolvedValueOnce(totalNetworksMock)
        .mockResolvedValueOnce(radioTypesMock);

      const result = await analyticsService.getBulkAnalytics();

      expect(result).toHaveProperty('dashboard');
      expect(result).toHaveProperty('networkTypes');
      expect(result).toHaveProperty('signalStrength');
      expect(result).toHaveProperty('security');
      expect(result).toHaveProperty('topNetworks');
      expect(result).toHaveProperty('generatedAt');

      expect(result.networkTypes).toEqual([{ type: 'WiFi', count: 100 }]);
      expect(result.dashboard.totalNetworks).toBe(1000);
      expect(result.dashboard.wifiCount).toBe(600);

      expect(query).toHaveBeenCalledTimes(6);
    });

    it('should throw error if any underlying call fails', async () => {
      query.mockRejectedValueOnce(new Error('Parallel Failure'));

      await expect(analyticsService.getBulkAnalytics()).rejects.toThrow(DatabaseError);
    });
  });

  describe('Core Analytics Module', () => {
    describe('getSignalStrengthDistribution()', () => {
      it('should return signal distribution', async () => {
        const mockRows = [
          { signal_range: '-30', count: '5' },
          { signal_range: '-40', count: '15' },
        ];
        query.mockResolvedValueOnce({ rows: mockRows });

        const result = await analyticsService.getSignalStrengthDistribution();

        expect(result).toEqual([
          { range: '-30', count: 5 },
          { range: '-40', count: 15 },
        ]);
      });
    });

    describe('getTemporalActivity()', () => {
      it('should return temporal activity based on minTimestamp', async () => {
        const minTimestamp = 1600000000000;
        const mockRows = [
          { hour: '10', count: '100' },
          { hour: '11', count: '120' },
        ];
        query.mockResolvedValueOnce({ rows: mockRows });

        const result = await analyticsService.getTemporalActivity(minTimestamp);

        expect(result).toEqual([
          { hour: 10, count: 100 },
          { hour: 11, count: 120 },
        ]);
      });
    });

    describe('getRadioTypeOverTime()', () => {
      it('should return radio type distribution over time', async () => {
        const range = '24h';
        const minTimestamp = 1600000000000;
        const mockRows = [
          { date: '2023-01-01T10:00:00Z', network_type: 'WiFi', count: '50' },
          { date: '2023-01-01T10:00:00Z', network_type: 'BLE', count: '20' },
        ];
        query.mockResolvedValueOnce({ rows: mockRows });

        const result = await analyticsService.getRadioTypeOverTime(range, minTimestamp);

        expect(result).toEqual([
          { date: '2023-01-01T10:00:00Z', type: 'WiFi', count: 50 },
          { date: '2023-01-01T10:00:00Z', type: 'BLE', count: 20 },
        ]);
      });
    });
  });

  describe('Threat Analytics Module', () => {
    describe('getThreatDistribution()', () => {
      it('should return threat score distribution', async () => {
        const mockRows = [
          { range: '80-100', count: '5' },
          { range: '60-80', count: '10' },
        ];
        query.mockResolvedValueOnce({ rows: mockRows });

        const result = await analyticsService.getThreatDistribution();

        expect(result).toEqual([
          { range: '80-100', count: 5 },
          { range: '60-80', count: 10 },
        ]);
      });
    });

    describe('getThreatTrends()', () => {
      it('should return threat trends over time', async () => {
        const range = '7d';
        const minTimestamp = 1600000000000;
        const mockRows = [
          {
            date: '2023-01-01',
            avg_score: '45.5',
            critical_count: '2',
            high_count: '5',
            medium_count: '10',
            low_count: '20',
            network_count: '37',
          },
        ];
        query.mockResolvedValueOnce({ rows: mockRows });

        const result = await analyticsService.getThreatTrends(range, minTimestamp);

        expect(result).toEqual([
          {
            date: '2023-01-01',
            avgScore: '45.5',
            criticalCount: 2,
            highCount: 5,
            mediumCount: 10,
            lowCount: 20,
            networkCount: 37,
          },
        ]);
      });
    });
  });

  describe('Network Analytics Module', () => {
    describe('getNetworkTypes()', () => {
      it('should return network type distribution', async () => {
        const mockRows = [
          { network_type: 'WiFi', count: '100' },
          { network_type: 'BLE', count: '50' },
        ];
        query.mockResolvedValueOnce({ rows: mockRows });

        const result = await analyticsService.getNetworkTypes();

        expect(result).toEqual([
          { type: 'WiFi', count: 100 },
          { type: 'BLE', count: 50 },
        ]);
      });
    });

    describe('getSecurityDistribution()', () => {
      it('should return security distribution', async () => {
        const mockRows = [
          { security_type: 'WPA2-P', count: '80' },
          { security_type: 'OPEN', count: '20' },
        ];
        query.mockResolvedValueOnce({ rows: mockRows });

        const result = await analyticsService.getSecurityDistribution();

        expect(result).toEqual([
          { type: 'WPA2-P', count: 80 },
          { type: 'OPEN', count: 20 },
        ]);
      });
    });

    describe('getTopNetworks()', () => {
      it('should return top networks', async () => {
        const mockRows = [
          {
            bssid: 'AA:BB:CC:DD:EE:FF',
            ssid: 'Test WiFi',
            type: 'W',
            signal: -50,
            observations: '500',
            first_seen: '2023-01-01',
            last_seen: '2023-01-02',
          },
        ];
        query.mockResolvedValueOnce({ rows: mockRows });

        const result = await analyticsService.getTopNetworks(10);

        expect(result[0]).toMatchObject({
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Test WiFi',
          observations: 500,
        });
      });
    });

    describe('getDashboardStats()', () => {
      it('should return comprehensive dashboard stats', async () => {
        query.mockResolvedValueOnce({ rows: [{ count: '1000' }] }).mockResolvedValueOnce({
          rows: [
            { radio_type: 'WiFi', count: '700' },
            { radio_type: 'BLE', count: '300' },
          ],
        });

        const result = await analyticsService.getDashboardStats();

        expect(result.totalNetworks).toBe(1000);
        expect(result.wifiCount).toBe(700);
        expect(result.bleCount).toBe(300);
      });
    });
  });

  describe('Analytics Helpers', () => {
    describe('normalizeAnalyticsResult', () => {
      it('should convert counts to numbers', () => {
        const input = [{ type: 'A', count: '10' }];
        const result = analyticsService.normalizeAnalyticsResult(input);
        expect(result[0].count).toBe(10);
      });
    });

    describe('formatAnalyticsData', () => {
      it('should add generatedAt timestamp', () => {
        const input = { data: [1] };
        const result = analyticsService.formatAnalyticsData(input);
        expect(result.data).toEqual([1]);
        expect(result.generatedAt).toBeDefined();
      });
    });

    describe('validateAnalyticsParams', () => {
      it('should validate limit and range', () => {
        expect(analyticsService.validateAnalyticsParams({ limit: 100, range: '24h' }).valid).toBe(
          true
        );
        expect(analyticsService.validateAnalyticsParams({ limit: 0 }).valid).toBe(false);
        expect(analyticsService.validateAnalyticsParams({ range: 'invalid' }).valid).toBe(false);
      });
    });

    describe('applyFiltersToAnalytics', () => {
      it('should append WHERE clause and params', () => {
        const base = 'SELECT * FROM t';
        const filters = [{ condition: 'x = $1', param: 10 }];
        const result = analyticsService.applyFiltersToAnalytics(base, filters);
        expect(result.query).toBe('SELECT * FROM t WHERE x = $1');
        expect(result.params).toEqual([10]);
      });
    });

    describe('calculateAggregates', () => {
      it('should calculate sum/avg/min/max', () => {
        const data = [{ v: 10 }, { v: 20 }];
        expect(analyticsService.calculateAggregates(data, 'v', 'sum')).toBe(30);
        expect(analyticsService.calculateAggregates(data, 'v', 'avg')).toBe(15);
        expect(analyticsService.calculateAggregates(data, 'v', 'min')).toBe(10);
        expect(analyticsService.calculateAggregates(data, 'v', 'max')).toBe(20);
      });
    });

    describe('rangeToMilliseconds', () => {
      it('should convert 24h to correct ms', () => {
        const ms = analyticsService.rangeToMilliseconds('24h');
        const expected = 24 * 60 * 60 * 1000;
        const now = Date.now();
        expect(now - ms).toBeGreaterThanOrEqual(expected - 1000);
        expect(now - ms).toBeLessThanOrEqual(expected + 1000);
      });
    });
  });
});
