import {
  getWigleNetworkByBSSID,
  getUserStats,
  getWigleDatabase,
  getWigleDetail,
  getWigleObservations,
  getKmlPointsForMap,
  normalizeUserStats,
} from '../../../server/src/services/wigleService';
const { query } = require('../../../server/src/config/database');
const { fetchWigle } = require('../../../server/src/services/wigleClient');
const secretsManager = require('../../../server/src/services/secretsManager');

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleClient', () => ({
  fetchWigle: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleRequestLedger', () => ({
  assertCanRequest: jest.fn(),
  recordRequest: jest.fn().mockResolvedValue(null),
  updateLedgerOutcome: jest.fn(),
  recordConsecutive429: jest.fn(),
  getCircuitBreakerStatus: jest.fn().mockReturnValue({ isOpen: false }),
}));

jest.mock('../../../server/src/services/secretsManager', () => ({
  get: jest.fn(),
}));

describe('wigleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWigleNetworkByBSSID', () => {
    it('should throw if database query fails', async () => {
      query.mockRejectedValue(new Error('DB Error'));
      await expect(getWigleNetworkByBSSID('00:11:22:33:44:55')).rejects.toThrow('DB Error');
    });
  });

  describe('getWigleDatabase', () => {
    it('should throw if v2 count query fails', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return Promise.reject(new Error('Count Error'));
        }
        return Promise.resolve({ rows: [] });
      });
      await expect(getWigleDatabase({ includeTotal: true })).rejects.toThrow('Count Error');
    });

    it('should throw if v3 query fails', async () => {
      query.mockRejectedValue(new Error('V3 Error'));
      await expect(getWigleDatabase({ version: 'v3' })).rejects.toThrow('V3 Error');
    });
  });

  describe('getWigleDetail', () => {
    it('should throw if primary query fails', async () => {
      query.mockRejectedValue(new Error('Detail Error'));
      await expect(getWigleDetail('00:11')).rejects.toThrow('Detail Error');
    });
  });

  describe('getWigleObservations', () => {
    it('should throw if Promise.all fails due to one query failing', async () => {
      query.mockRejectedValue(new Error('Obs Error'));
      await expect(getWigleObservations('00:11')).rejects.toThrow('Obs Error');
    });
  });

  describe('getKmlPointsForMap', () => {
    it('should throw if count query fails when includeTotal is true', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return Promise.reject(new Error('KML Count Error'));
        }
        return Promise.resolve({ rows: [] });
      });
      await expect(getKmlPointsForMap({ includeTotal: true })).rejects.toThrow('KML Count Error');
    });
  });

  describe('getUserStats', () => {
    it('normalizes raw WiGLE user stats without unsupported fields', () => {
      const result = normalizeUserStats({
        user: 'fallback-user',
        rank: 99,
        statistics: {
          userName: 'stats-user',
          rank: 12,
          discoveredWiFiGPS: 101,
          discoveredBtGPS: 202,
          discoveredCellGPS: 303,
          discoveredWiFi: 404,
          discoveredBt: 505,
          discoveredCell: 606,
          totalWiFiLocations: 707,
          first: '20200101-00000',
          last: '20260528-00000',
          eventMonthCount: 808,
          class: 'not-real',
          points: 9001,
        },
      });

      expect(result.user).toBe('stats-user');
      expect(result.rank).toBe(12);
      expect(result).not.toHaveProperty('class');
      expect(result).not.toHaveProperty('points');
    });

    it('should throw if credentials are missing', async () => {
      secretsManager.get.mockReturnValue(null);
      await expect(getUserStats()).rejects.toThrow('WiGLE API credentials not configured');
    });

    it('should throw if fetchWigle returns non-ok response', async () => {
      secretsManager.get.mockReturnValue('value');
      fetchWigle.mockResolvedValue({
        response: {
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Unauthorized' }),
        },
        ledgerId: null,
      });
      await expect(getUserStats()).rejects.toThrow('Unauthorized');
    });

    it('should throw if fetchWigle returns non-ok response without message', async () => {
      secretsManager.get.mockReturnValue('value');
      fetchWigle.mockResolvedValue({
        response: {
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('JSON parse error')),
        },
        ledgerId: null,
      });
      await expect(getUserStats()).rejects.toThrow('WiGLE API error: 500');
    });

    it('should throw if fetchWigle rejects', async () => {
      secretsManager.get.mockReturnValue('value');
      fetchWigle.mockRejectedValue(new Error('Network Timeout'));
      await expect(getUserStats()).rejects.toThrow('Network Timeout');
    });

    it('should successfully fetch and normalize user stats', async () => {
      secretsManager.get.mockReturnValue('value');
      const rawPayload = {
        success: true,
        user: 'ignored_user',
        rank: 999,
        statistics: {
          userName: 'test_user',
          rank: 123,
          class: 'Elite',
          points: 125000,
          discoveredWiFiGPS: 100,
          discoveredBtGPS: 200,
          discoveredCellGPS: 300,
          discoveredWiFi: 400,
          discoveredBt: 500,
          discoveredCell: 600,
          totalWiFiLocations: 700,
          first: '2026-01-01',
          last: '2026-05-28',
          eventMonthCount: 50,
        },
      };
      fetchWigle.mockResolvedValue({
        response: {
          ok: true,
          status: 200,
          json: () => Promise.resolve(rawPayload),
        },
        ledgerId: null,
      });

      const stats = await getUserStats();
      expect(stats).toEqual({
        user: 'test_user',
        rank: 123,
        imageBadgeUrl: null,
        discoveredWiFiGPS: 100,
        discoveredBtGPS: 200,
        discoveredCellGPS: 300,
        discoveredWiFi: 400,
        discoveredBt: 500,
        discoveredCell: 600,
        totalWiFiLocations: 700,
        first: '2026-01-01',
        last: '2026-05-28',
        eventMonthCount: 50,
      });
      expect(stats.class).toBeUndefined();
      expect(stats.points).toBeUndefined();
    });
  });
});
