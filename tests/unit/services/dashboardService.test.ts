const DashboardService = require('../../../server/src/services/dashboardService');

describe('DashboardService', () => {
  let dashboardService: any;
  const mockRepo = {
    getDashboardMetrics: jest.fn(),
    getThreatenedNetworks: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    dashboardService = new DashboardService(mockRepo);
  });

  test('getMetrics() should return metrics with timestamp', async () => {
    const mockMetrics = {
      totalNetworks: 10,
      wifiCount: 5,
      bleCount: 2,
      bluetoothCount: 1,
      lteCount: 2,
    };
    mockRepo.getDashboardMetrics.mockResolvedValue(mockMetrics);

    const result = await dashboardService.getMetrics({}, {});
    expect(result).toMatchObject(mockMetrics);
    expect(result).toHaveProperty('lastUpdated');
  });

  test('getThreats() should return sorted threats', async () => {
    const mockNetworks = [
      {
        bssid: '1',
        ssid: 'A',
        threatScore: 50,
        threatLevel: 'high',
        type: 'wifi',
        signal: -50,
        observations: 1,
        lastSeen: '2026-04-01',
      },
      {
        bssid: '2',
        ssid: 'B',
        threatScore: 80,
        threatLevel: 'critical',
        type: 'wifi',
        signal: -40,
        observations: 5,
        lastSeen: '2026-04-01',
      },
    ];
    mockRepo.getThreatenedNetworks.mockResolvedValue(mockNetworks);

    const result = await dashboardService.getThreats();
    expect(result[0].bssid).toBe('2'); // Highest score first
    expect(result.length).toBe(2);
  });

  test('getNetworkDistribution() should return aggregated distribution', async () => {
    const mockMetrics = {
      totalNetworks: 10,
      wifiCount: 5,
      bleCount: 2,
      bluetoothCount: 1,
      lteCount: 2,
    };
    mockRepo.getDashboardMetrics.mockResolvedValue(mockMetrics);

    const result = await dashboardService.getNetworkDistribution();
    expect(result).toEqual({ wifi: 5, ble: 2, bluetooth: 1, lte: 2, total: 10 });
  });

  describe('Error handling', () => {
    test('getMetrics() should throw and log error', async () => {
      const error = new Error('Database connection failed');
      mockRepo.getDashboardMetrics.mockRejectedValue(error);

      await expect(dashboardService.getMetrics()).rejects.toThrow('Database connection failed');
    });

    test('getThreats() should throw and log error', async () => {
      const error = new Error('Query timed out');
      mockRepo.getThreatenedNetworks.mockRejectedValue(error);

      await expect(dashboardService.getThreats()).rejects.toThrow('Query timed out');
    });

    test('getNetworkDistribution() should throw and log error', async () => {
      const error = new Error('Invalid query');
      mockRepo.getDashboardMetrics.mockRejectedValue(error);

      await expect(dashboardService.getNetworkDistribution()).rejects.toThrow('Invalid query');
    });
  });
});
