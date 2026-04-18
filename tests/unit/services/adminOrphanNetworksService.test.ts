export {};

jest.mock('../../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleService', () => ({
  importWigleV3Observation: jest.fn(),
  importWigleV3NetworkDetail: jest.fn(),
  getWigleObservations: jest.fn(),
}));

jest.mock('../../../server/src/services/secretsManager', () => ({
  default: {
    get: jest.fn(),
  },
}));

jest.mock('../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { adminQuery } = require('../../../server/src/services/adminDbService');
const wigleService = require('../../../server/src/services/wigleService');
const secretsManager = require('../../../server/src/services/secretsManager').default;
const {
  listOrphanNetworks,
  getOrphanNetworkCounts,
  backfillOrphanNetworkFromWigle,
} = require('../../../server/src/services/adminOrphanNetworksService');

describe('adminOrphanNetworksService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    require('../../../server/src/services/wigleRequestLedger').resetQuotaLedger();
  });

  describe('listOrphanNetworks', () => {
    it('should list orphan networks with defaults', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'test' }] });
      const result = await listOrphanNetworks();
      expect(result.length).toBe(1);
      expect(adminQuery).toHaveBeenCalled();
    });

    it('should list orphan networks with search', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'test' }] });
      const result = await listOrphanNetworks({ search: 'query' });
      expect(result.length).toBe(1);
    });
  });

  describe('getOrphanNetworkCounts', () => {
    it('should get count', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ total: 5 }] });
      const result = await getOrphanNetworkCounts();
      expect(result.total).toBe(5);
    });

    it('should get count with search', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
      const result = await getOrphanNetworkCounts({ search: 'query' });
      expect(result.total).toBe(2);
    });
  });

  describe('backfillOrphanNetworkFromWigle', () => {
    it('should throw if orphan not found', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [] });
      await expect(backfillOrphanNetworkFromWigle('00:11:22')).rejects.toThrow(
        'Orphan network not found'
      );
    });

    it('should throw if wigle credentials missing', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });
      secretsManager.get.mockReturnValue(null);
      await expect(backfillOrphanNetworkFromWigle('00:11:22')).rejects.toThrow(
        'WiGLE API credentials not configured'
      );
    });

    it('should handle API 404', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });
      secretsManager.get.mockReturnValue('token');
      (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 404, ok: false });
      adminQuery.mockResolvedValueOnce({ rows: [] }); // record attempt

      const res = await backfillOrphanNetworkFromWigle('00:11:22');
      expect(res.status).toBe('no_wigle_match');
    });

    it('should handle API non-ok status', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });
      secretsManager.get.mockReturnValue('token');
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 500,
          ok: false,
          text: () => Promise.resolve('err'),
        })
        .mockResolvedValueOnce({
          status: 500,
          ok: false,
          text: () => Promise.resolve('err'),
        });
      adminQuery.mockResolvedValueOnce({ rows: [] }); // record attempt

      await expect(backfillOrphanNetworkFromWigle('00:11:22')).rejects.toThrow(
        'WiGLE detail request failed'
      );
    });

    it('should successfully backfill network', async () => {
      // First query to get orphan
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });
      secretsManager.get.mockReturnValue('token');

      const wigleData = {
        success: true,
        networkId: 'NET1',
        locationClusters: [
          {
            locations: [{ ssid: 'test', lat: 1, lon: 1 }],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve(wigleData),
      });

      wigleService.importWigleV3NetworkDetail.mockResolvedValueOnce();
      wigleService.importWigleV3Observation.mockResolvedValueOnce(1);
      wigleService.getWigleObservations.mockResolvedValueOnce({ total: 1 });
      // record attempt query
      adminQuery.mockResolvedValueOnce({ rows: [] });

      const res = await backfillOrphanNetworkFromWigle('00:11:22');
      expect(res.ok).toBe(true);
      expect(res.status).toBe('wigle_match_imported_v3');
      expect(res.importedObservations).toBe(1);
    });

    it('should handle API rate limit response', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });
      secretsManager.get.mockReturnValue('token');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 429,
        ok: false,
        json: () => Promise.resolve({ success: false, message: 'too many queries' }),
        text: () => Promise.resolve(''),
      });

      await expect(backfillOrphanNetworkFromWigle('00:11:22')).rejects.toThrow(
        'WiGLE detail request failed (429):'
      );
    });
  });
});
