export {};

jest.mock('../../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleService', () => ({
  importWigleV3Observation: jest.fn(),
  importWigleV3NetworkDetail: jest.fn(),
  getWigleObservations: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleDetailService', () => ({
  fetchUpstream: jest.fn(),
  importObservations: jest.fn(),
}));

jest.mock('../../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  },
}));

jest.mock('../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { adminQuery } = require('../../../server/src/services/adminDbService');
const wigleService = require('../../../server/src/services/wigleService');
const {
  fetchUpstream,
  importObservations,
} = require('../../../server/src/services/wigleDetailService');
const {
  listOrphanNetworks,
  getOrphanNetworkCounts,
  backfillOrphanNetworkFromWigle,
} = require('../../../server/src/services/adminOrphanNetworksService');

describe('adminOrphanNetworksService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure adminQuery always returns a Promise so wigleRequestLedger.recordRequest
    // can call .catch on it (resetMocks: true strips the implementation between tests)
    adminQuery.mockResolvedValue({ rows: [] });
    global.fetch = jest.fn();
    fetchUpstream.mockResolvedValue({ ok: true, data: null, status: 200 });
    importObservations.mockResolvedValue({ newCount: 0, totalCount: 0, failedCount: 0 });
    require('../../../server/src/services/wigleRequestLedger').resetQuotaLedger();
  });

  describe('listOrphanNetworks', () => {
    it('should list orphan networks with defaults', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'test' }] });
      const result = await listOrphanNetworks();
      expect(result.length).toBe(1);
      expect(adminQuery).toHaveBeenCalled();
      const [sql, params] = adminQuery.mock.calls[0];
      expect(sql).toContain('o.bssid');
      expect(sql).toContain('o.ssid');
      expect(sql).toContain('o.type');
      expect(sql).toContain('o.frequency');
      expect(sql).toContain('o.capabilities');
      expect(sql).toContain('FROM app.networks_orphans o');
      expect(sql).toContain('LEFT JOIN app.orphan_network_backfills ob ON ob.bssid = o.bssid');
      expect(sql).toContain('ORDER BY o.moved_at DESC, o.bssid ASC');
      expect(sql).toContain('LIMIT $1');
      expect(sql).toContain('OFFSET $2');
      expect(params).toEqual([50, 0]);
    });

    it('should list orphan networks with search', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'test' }] });
      const result = await listOrphanNetworks({ search: 'query' });
      expect(result.length).toBe(1);
      expect(adminQuery).toHaveBeenCalled();
      const [sql, params] = adminQuery.mock.calls[0];
      expect(sql).toContain('o.bssid ILIKE $1 ESCAPE');
      expect(sql).toContain('o.ssid ILIKE $2 ESCAPE');
      expect(params).toEqual(['%query%', '%query%', 50, 0]);
    });

    it('should handle empty results', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [] });
      const result = await listOrphanNetworks();
      expect(result.length).toBe(0);
    });

    it('should propagate database error', async () => {
      adminQuery.mockRejectedValueOnce(new Error('DB Error'));
      await expect(listOrphanNetworks()).rejects.toThrow('DB Error');
    });

    it('should handle invalid sort parameters', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [] });
      const result = await listOrphanNetworks({ sortBy: 'invalid', sortDir: 'invalid' });
      expect(result.length).toBe(0);
    });
  });

  describe('getOrphanNetworkCounts', () => {
    it('should get count', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ total: 5 }] });
      const result = await getOrphanNetworkCounts();
      expect(result.total).toBe(5);
      expect(adminQuery).toHaveBeenCalled();
      const [sql, params] = adminQuery.mock.calls[0];
      expect(sql).toContain('SELECT COUNT(*)::int AS total');
      expect(sql).toContain('FROM app.networks_orphans');
      expect(params).toEqual([]);
    });

    it('should get count with search', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
      const result = await getOrphanNetworkCounts({ search: 'query' });
      expect(result.total).toBe(2);
      expect(adminQuery).toHaveBeenCalled();
      const [sql, params] = adminQuery.mock.calls[0];
      expect(sql).toContain('SELECT COUNT(*)::int AS total');
      expect(sql).toContain('FROM app.networks_orphans');
      expect(sql).toContain('WHERE (bssid ILIKE $1 ESCAPE');
      expect(params).toEqual(['%query%', '%query%']);
    });

    it('should return 0 when no records found', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });
      const result = await getOrphanNetworkCounts();
      expect(result.total).toBe(0);
    });

    it('should propagate database error', async () => {
      adminQuery.mockRejectedValueOnce(new Error('DB Error'));
      await expect(getOrphanNetworkCounts()).rejects.toThrow('DB Error');
    });
  });

  describe('backfillOrphanNetworkFromWigle', () => {
    it('should throw if orphan not found', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [] });
      await expect(backfillOrphanNetworkFromWigle('00:11:22')).rejects.toThrow(
        'Orphan network not found'
      );
      expect(adminQuery).toHaveBeenCalled();
      const [sql, params] = adminQuery.mock.calls[0];
      expect(sql).toContain('SELECT bssid, ssid, type');
      expect(sql).toContain('FROM app.networks_orphans');
      expect(sql).toContain('WHERE bssid = $1');
      expect(sql).toContain('LIMIT 1');
      expect(params).toEqual(['00:11:22']);
    });

    it('should return error status when upstream payload is invalid', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });
      fetchUpstream.mockResolvedValueOnce({
        ok: false,
        status: 500,
        data: { message: 'upstream failed' },
      });
      const res = await backfillOrphanNetworkFromWigle('00:11:22');
      expect(res.status).toBe('error');

      const calls = adminQuery.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toContain('SELECT bssid, ssid, type');
      expect(calls[0][0]).toContain('FROM app.networks_orphans');
      expect(calls[0][0]).toContain('WHERE bssid = $1');
      expect(calls[0][0]).toContain('LIMIT 1');
      expect(calls[1][0]).toContain('INSERT INTO app.orphan_network_backfills');
      expect(calls[1][1]).toEqual([
        '00:11:22',
        'error',
        null,
        false,
        0,
        'API response missing network data',
      ]);
    });

    it('should handle API 404', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });
      fetchUpstream.mockResolvedValueOnce({
        ok: false,
        status: 404,
        data: { message: 'not found' },
      });
      adminQuery.mockResolvedValueOnce({ rows: [] }); // record attempt

      const res = await backfillOrphanNetworkFromWigle('00:11:22');
      expect(res.status).toBe('no_wigle_match');

      const calls = adminQuery.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toContain('SELECT bssid, ssid, type');
      expect(calls[0][0]).toContain('FROM app.networks_orphans');
      expect(calls[0][0]).toContain('WHERE bssid = $1');
      expect(calls[0][0]).toContain('LIMIT 1');
      expect(calls[1][0]).toContain('INSERT INTO app.orphan_network_backfills');
      expect(calls[1][1]).toEqual(['00:11:22', 'no_wigle_match', null, false, 0, null]);
    });

    it('should return error on API non-ok status', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });
      fetchUpstream.mockResolvedValueOnce({
        ok: false,
        status: 500,
        data: { message: 'err' },
      });
      adminQuery.mockResolvedValueOnce({ rows: [] }); // record attempt

      const res = await backfillOrphanNetworkFromWigle('00:11:22');
      expect(res.status).toBe('error');

      const calls = adminQuery.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toContain('SELECT bssid, ssid, type');
      expect(calls[0][0]).toContain('FROM app.networks_orphans');
      expect(calls[0][0]).toContain('WHERE bssid = $1');
      expect(calls[0][0]).toContain('LIMIT 1');
      expect(calls[1][0]).toContain('INSERT INTO app.orphan_network_backfills');
      expect(calls[1][1]).toEqual([
        '00:11:22',
        'error',
        null,
        false,
        0,
        'API response missing network data',
      ]);
    });

    it('should successfully backfill network', async () => {
      // First query to get orphan
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });

      const wigleData = {
        success: true,
        networkId: 'NET1',
        locationClusters: [
          {
            locations: [{ ssid: 'test', lat: 1, lon: 1 }],
          },
        ],
      };

      fetchUpstream.mockResolvedValueOnce({ ok: true, status: 200, data: wigleData });

      wigleService.importWigleV3NetworkDetail.mockResolvedValueOnce();
      importObservations.mockResolvedValueOnce({ newCount: 1, totalCount: 1, failedCount: 0 });
      wigleService.getWigleObservations.mockResolvedValueOnce({ total: 1 });
      // record attempt query
      adminQuery.mockResolvedValueOnce({ rows: [] });

      const res = await backfillOrphanNetworkFromWigle('00:11:22');
      expect(res.ok).toBe(true);
      expect(res.status).toBe('wigle_match_imported_v3');
      expect(res.importedObservations).toBe(1);

      const calls = adminQuery.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toContain('SELECT bssid, ssid, type');
      expect(calls[0][0]).toContain('FROM app.networks_orphans');
      expect(calls[0][0]).toContain('WHERE bssid = $1');
      expect(calls[0][0]).toContain('LIMIT 1');
      expect(calls[1][0]).toContain('INSERT INTO app.orphan_network_backfills');
      expect(calls[1][1]).toEqual(['00:11:22', 'wigle_match_imported_v3', 'NET1', true, 1, null]);
    });

    it('should handle API rate limit response', async () => {
      adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22', type: 'WIFI' }] });
      fetchUpstream.mockResolvedValueOnce({
        ok: false,
        status: 429,
        data: { success: false, message: 'too many queries' },
      });

      await expect(backfillOrphanNetworkFromWigle('00:11:22')).rejects.toThrow('rate limit');
    });
  });
});
