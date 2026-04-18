import {
  getWigleNetworkByBSSID,
  searchWigleDatabase,
  getWigleV2Networks,
  getWigleV2NetworksCount,
  checkWigleV3TableExists,
  getWigleV3Networks,
  getWigleV3NetworksCount,
  importWigleV3NetworkDetail,
  importWigleV3Observation,
  getWigleV3Observations,
  importWigleV2SearchResult,
  getWigleDatabase,
  getWigleDetail,
  getRecentWigleDetailImport,
  getWigleObservations,
  getKmlPointsForMap,
  getUserStats,
} from '../../../server/src/services/wigleService';
import { query } from '../../../server/src/config/database';
import * as wigleQueriesRepo from '../../../server/src/repositories/wigleQueriesRepository';
import * as wiglePersistenceRepo from '../../../server/src/repositories/wiglePersistenceRepository';
import secretsManager from '../../../server/src/services/secretsManager';
import { fetchWigle } from '../../../server/src/services/wigleClient';

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/repositories/wigleQueriesRepository');
jest.mock('../../../server/src/repositories/wiglePersistenceRepository');
jest.mock('../../../server/src/services/secretsManager');
jest.mock('../../../server/src/services/wigleClient', () => ({
  fetchWigle: jest.fn(),
}));

describe('wigleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('../../../server/src/services/wigleRequestLedger').resetQuotaLedger();
  });

  describe('getWigleNetworkByBSSID', () => {
    it('should return a network if found', async () => {
      const mockRow = { bssid: 'AA:BB:CC:DD:EE:FF', ssid: 'TestNetwork' };
      (wigleQueriesRepo.buildWigleNetworkByBssidQuery as jest.Mock).mockReturnValue({
        sql: 'SELECT * FROM bssid',
        queryParams: ['AA:BB:CC:DD:EE:FF'],
      });
      (query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const result = await getWigleNetworkByBSSID('AA:BB:CC:DD:EE:FF');
      expect(result).toEqual(mockRow);
      expect(wigleQueriesRepo.buildWigleNetworkByBssidQuery).toHaveBeenCalledWith(
        'AA:BB:CC:DD:EE:FF'
      );
      expect(query).toHaveBeenCalledWith('SELECT * FROM bssid', ['AA:BB:CC:DD:EE:FF']);
    });

    it('should return null if not found', async () => {
      (wigleQueriesRepo.buildWigleNetworkByBssidQuery as jest.Mock).mockReturnValue({
        sql: 'SELECT * FROM bssid',
        queryParams: ['AA:BB:CC:DD:EE:FF'],
      });
      (query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await getWigleNetworkByBSSID('AA:BB:CC:DD:EE:FF');
      expect(result).toBeNull();
    });
  });

  describe('searchWigleDatabase', () => {
    it('should call repository and query database', async () => {
      const mockSql = 'SELECT * FROM test';
      const mockParams = ['param'];
      (wigleQueriesRepo.buildWigleSearchQuery as jest.Mock).mockReturnValue({
        sql: mockSql,
        queryParams: mockParams,
      });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await searchWigleDatabase({ limit: 10 });
      expect(result).toEqual([{ id: 1 }]);
      expect(wigleQueriesRepo.buildWigleSearchQuery).toHaveBeenCalled();
      expect(query).toHaveBeenCalledWith(mockSql, mockParams);
    });
  });

  describe('getWigleV2Networks', () => {
    it('should call repository and query database', async () => {
      const mockSql = 'SELECT * FROM v2';
      const mockParams = ['param'];
      (wigleQueriesRepo.buildWigleV2NetworksQuery as jest.Mock).mockReturnValue({
        sql: mockSql,
        queryParams: mockParams,
      });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await getWigleV2Networks({
        limit: 10,
        offset: 0,
        whereClauses: [],
        queryParams: [],
      });
      expect(result).toEqual([{ id: 1 }]);
      expect(wigleQueriesRepo.buildWigleV2NetworksQuery).toHaveBeenCalled();
      expect(query).toHaveBeenCalledWith(mockSql, mockParams);
    });
  });

  describe('getWigleV2NetworksCount', () => {
    it('should return count from database', async () => {
      const mockSql = 'SELECT COUNT(*) FROM v2';
      const mockParams = ['param'];
      (wigleQueriesRepo.buildWigleV2CountQuery as jest.Mock).mockReturnValue({
        sql: mockSql,
        queryParams: mockParams,
      });
      (query as jest.Mock).mockResolvedValue({ rows: [{ total: '42' }] });

      const result = await getWigleV2NetworksCount([], []);
      expect(result).toEqual(42);
      expect(wigleQueriesRepo.buildWigleV2CountQuery).toHaveBeenCalled();
      expect(query).toHaveBeenCalledWith(mockSql, mockParams);
    });
  });

  describe('checkWigleV3TableExists', () => {
    it('should return true if table exists', async () => {
      (wigleQueriesRepo.buildWigleV3TableExistsQuery as jest.Mock).mockReturnValue({
        sql: 'table exists',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValue({ rows: [{ exists: true }] });
      const result = await checkWigleV3TableExists();
      expect(result).toBe(true);
    });

    it('should return false if table does not exist', async () => {
      (wigleQueriesRepo.buildWigleV3TableExistsQuery as jest.Mock).mockReturnValue({
        sql: 'table exists',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValue({ rows: [{ exists: false }] });
      const result = await checkWigleV3TableExists();
      expect(result).toBe(false);
    });

    it('should handle undefined result', async () => {
      (wigleQueriesRepo.buildWigleV3TableExistsQuery as jest.Mock).mockReturnValue({
        sql: 'table exists',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await checkWigleV3TableExists();
      expect(result).toBe(false);
    });
  });

  describe('getWigleV3Networks', () => {
    it('should call repository and query database', async () => {
      const mockSql = 'SELECT * FROM v3';
      const mockParams = ['param'];
      (wigleQueriesRepo.buildWigleV3NetworksQuery as jest.Mock).mockReturnValue({
        sql: mockSql,
        queryParams: mockParams,
      });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await getWigleV3Networks({ limit: 10, offset: 0 });
      expect(result).toEqual([{ id: 1 }]);
      expect(wigleQueriesRepo.buildWigleV3NetworksQuery).toHaveBeenCalled();
      expect(query).toHaveBeenCalledWith(mockSql, mockParams);
    });
  });

  describe('getWigleV3NetworksCount', () => {
    it('should return count from database', async () => {
      const mockSql = 'SELECT COUNT(*) FROM v3';
      const mockParams = ['param'];
      (wigleQueriesRepo.buildWigleV3CountQuery as jest.Mock).mockReturnValue({
        sql: mockSql,
        queryParams: mockParams,
      });
      (query as jest.Mock).mockResolvedValue({ rows: [{ total: '42' }] });

      const result = await getWigleV3NetworksCount([], []);
      expect(result).toEqual(42);
      expect(wigleQueriesRepo.buildWigleV3CountQuery).toHaveBeenCalled();
      expect(query).toHaveBeenCalledWith(mockSql, mockParams);
    });
  });

  describe('importWigleV3NetworkDetail', () => {
    it('should call persistence repository', async () => {
      const mockData = { netid: '123' };
      await importWigleV3NetworkDetail(mockData);
      expect(wiglePersistenceRepo.importWigleV3NetworkDetail).toHaveBeenCalledWith(
        { query },
        mockData
      );
    });
  });

  describe('importWigleV3Observation', () => {
    it('should call persistence repository', async () => {
      (wiglePersistenceRepo.importWigleV3Observation as jest.Mock).mockResolvedValue(1);
      const result = await importWigleV3Observation('123', { lat: 1 }, 'SSID');
      expect(result).toEqual(1);
      expect(wiglePersistenceRepo.importWigleV3Observation).toHaveBeenCalledWith(
        { query },
        '123',
        { lat: 1 },
        'SSID'
      );
    });
  });

  describe('getWigleV3Observations', () => {
    it('should call persistence repository', async () => {
      const mockRows = [{ id: 1 }];
      (wiglePersistenceRepo.getWigleV3Observations as jest.Mock).mockResolvedValue(mockRows);
      const result = await getWigleV3Observations('123');
      expect(result).toEqual(mockRows);
      expect(wiglePersistenceRepo.getWigleV3Observations).toHaveBeenCalledWith({ query }, '123');
    });
  });

  describe('importWigleV2SearchResult', () => {
    it('should call persistence repository with default executor', async () => {
      const mockNetwork = { bssid: '123' };
      await importWigleV2SearchResult(mockNetwork);
      expect(wiglePersistenceRepo.insertWigleV2SearchResult).toHaveBeenCalledWith(
        { query },
        mockNetwork
      );
    });

    it('should call persistence repository with custom executor', async () => {
      const mockNetwork = { bssid: '123' };
      const mockExecutor = { query: jest.fn() };
      await importWigleV2SearchResult(mockNetwork, mockExecutor);
      expect(wiglePersistenceRepo.insertWigleV2SearchResult).toHaveBeenCalledWith(
        mockExecutor,
        mockNetwork
      );
    });
  });

  describe('getWigleDatabase', () => {
    it('should handle v3 version', async () => {
      const mockRows = [{ id: 1 }];
      (wigleQueriesRepo.buildWigleV3NetworksQuery as jest.Mock).mockReturnValue({
        sql: 'sql',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows }); // for getWigleV3Networks
      (wigleQueriesRepo.buildWigleV3CountQuery as jest.Mock).mockReturnValue({
        sql: 'sql-count',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ total: '1' }] }); // for getWigleV3NetworksCount

      const result = await getWigleDatabase({
        version: 'v3',
        ssid: 'test',
        bssid: 'aa:bb',
        encryption: 'WPA2',
        includeTotal: true,
      });

      expect(result.rows).toEqual(mockRows);
      expect(result.total).toEqual(1);
    });

    it('should handle v3 version with NO filters', async () => {
      const mockRows = [{ id: 1 }];
      (wigleQueriesRepo.buildWigleV3NetworksQuery as jest.Mock).mockReturnValue({
        sql: 'sql',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getWigleDatabase({
        version: 'v3',
        includeTotal: false,
      });

      expect(result.rows).toEqual(mockRows);
    });

    it('should handle v2 version (default)', async () => {
      const mockRows = [{ id: 1 }];
      (wigleQueriesRepo.buildWigleV2NetworksQuery as jest.Mock).mockReturnValue({
        sql: 'sql',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows }); // for getWigleV2Networks
      (wigleQueriesRepo.buildWigleV2CountQuery as jest.Mock).mockReturnValue({
        sql: 'sql-count',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ total: '1' }] }); // for getWigleV2NetworksCount

      const result = await getWigleDatabase({
        version: 'v2',
        type: 'wifi',
        ssid: 'test',
        bssid: 'aa:bb',
        encryption: 'WPA2',
        includeTotal: true,
      });

      expect(result.rows).toEqual(mockRows);
      expect(result.total).toEqual(1);
    });

    it('should handle v2 version with empty type', async () => {
      const mockRows = [{ id: 1 }];
      (wigleQueriesRepo.buildWigleV2NetworksQuery as jest.Mock).mockReturnValue({
        sql: 'sql',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getWigleDatabase({
        version: 'v2',
        type: ' ',
      });

      expect(result.rows).toEqual(mockRows);
    });
  });

  describe('getWigleDetail', () => {
    it('should return from stored v3 detail if found', async () => {
      const mockRow = { netid: '123' };
      (wiglePersistenceRepo.getWigleDetail as jest.Mock).mockResolvedValue([mockRow]);

      const result = await getWigleDetail('123');
      expect(result).toEqual(mockRow);
    });

    it('should fallback to v2 search if v3 detail not found', async () => {
      (wiglePersistenceRepo.getWigleDetail as jest.Mock).mockResolvedValue([]);
      const mockRow = { bssid: '123' };
      (wigleQueriesRepo.buildWigleNetworkByBssidQuery as jest.Mock).mockReturnValue({
        sql: 'SELECT * FROM bssid',
        queryParams: ['123'],
      });
      (query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const result = await getWigleDetail('123');
      expect(result).toEqual(mockRow);
    });
  });

  describe('getRecentWigleDetailImport', () => {
    it('should return a record if imported within time limit', async () => {
      const mockRow = { netid: '123', imported_at: new Date() };
      (wigleQueriesRepo.buildRecentWigleDetailImportQuery as jest.Mock).mockReturnValue({
        sql: 'recent import',
        queryParams: ['123', 12],
      });
      (query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const result = await getRecentWigleDetailImport('123', 12);
      expect(result).toEqual(mockRow);
      expect(wigleQueriesRepo.buildRecentWigleDetailImportQuery).toHaveBeenCalledWith('123', 12);
      expect(query).toHaveBeenCalledWith('recent import', ['123', 12]);
    });

    it('should use default hours if invalid value provided', async () => {
      (wigleQueriesRepo.buildRecentWigleDetailImportQuery as jest.Mock).mockReturnValue({
        sql: 'recent import',
        queryParams: ['123', 24],
      });
      (query as jest.Mock).mockResolvedValue({ rows: [] });
      await getRecentWigleDetailImport('123', -1);
      expect(wigleQueriesRepo.buildRecentWigleDetailImportQuery).toHaveBeenCalledWith('123', 24);
      expect(query).toHaveBeenCalledWith('recent import', ['123', 24]);
    });

    it('should return null if no record found', async () => {
      (wigleQueriesRepo.buildRecentWigleDetailImportQuery as jest.Mock).mockReturnValue({
        sql: 'recent import',
        queryParams: ['123', 12],
      });
      (query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await getRecentWigleDetailImport('123', 12);
      expect(result).toBeNull();
    });
  });

  describe('getWigleObservations', () => {
    it('should return rows and total', async () => {
      (wigleQueriesRepo.buildWigleObservationsQuery as jest.Mock).mockReturnValue({
        sql: 'sql',
        queryParams: ['123'],
      });
      (wigleQueriesRepo.buildWigleObservationsCountQuery as jest.Mock).mockReturnValue({
        sql: 'count-sql',
        queryParams: ['123'],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] }); // for observations
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ total: '5' }] }); // for count

      const result = await getWigleObservations('123', 10, 0);
      expect(result.rows).toEqual([{ id: 1 }]);
      expect(result.total).toEqual(5);
    });

    it('should handle missing count result', async () => {
      (wigleQueriesRepo.buildWigleObservationsQuery as jest.Mock).mockReturnValue({
        sql: 'sql',
        queryParams: ['123'],
      });
      (wigleQueriesRepo.buildWigleObservationsCountQuery as jest.Mock).mockReturnValue({
        sql: 'count-sql',
        queryParams: ['123'],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getWigleObservations('123');
      expect(result.total).toBe(0);
    });
  });

  describe('getKmlPointsForMap', () => {
    it('should return rows and total when includeTotal is true', async () => {
      (wigleQueriesRepo.buildKmlPointsQuery as jest.Mock).mockReturnValue({
        sql: 'kml-sql',
        queryParams: ['aa:bb%'],
      });
      (wigleQueriesRepo.buildKmlPointsCountQuery as jest.Mock).mockReturnValue({
        sql: 'kml-count-sql',
        queryParams: ['aa:bb%'],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] }); // for rows
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ total: '10' }] }); // for count

      const result = await getKmlPointsForMap({ bssid: 'aa:bb', includeTotal: true });
      expect(result.rows).toEqual([{ id: 1 }]);
      expect(result.total).toEqual(10);
    });

    it('should return rows and null total when includeTotal is false', async () => {
      (wigleQueriesRepo.buildKmlPointsQuery as jest.Mock).mockReturnValue({
        sql: 'kml-sql',
        queryParams: ['aa:bb%', 10],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] }); // for rows

      const result = await getKmlPointsForMap({ bssid: 'aa:bb', includeTotal: false, offset: 10 });
      expect(result.rows).toEqual([{ id: 1 }]);
      expect(result.total).toBeNull();
    });

    it('should handle no filters', async () => {
      (wigleQueriesRepo.buildKmlPointsQuery as jest.Mock).mockReturnValue({
        sql: 'kml-sql',
        queryParams: [10],
      });
      (wigleQueriesRepo.buildKmlPointsCountQuery as jest.Mock).mockReturnValue({
        sql: 'kml-count-sql',
        queryParams: [],
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // rows query
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ total: '0' }] }); // count query
      const result = await getKmlPointsForMap({ limit: 10, includeTotal: true });
      expect(result.rows).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getUserStats', () => {
    it('should throw error if credentials missing', async () => {
      (secretsManager.get as jest.Mock).mockReturnValue(undefined);
      await expect(getUserStats()).rejects.toThrow('WiGLE API credentials not configured');
    });

    it('should return user stats on success', async () => {
      (secretsManager.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'wigle_api_name') return 'test_user';
        if (key === 'wigle_api_token') return 'test_token';
        return null;
      });

      const mockStats = { user: 'test_user', rank: 1 };
      (fetchWigle as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockStats),
      });

      const result = await getUserStats();
      expect(result).toEqual(mockStats);
      expect(fetchWigle).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.wigle.net/api/v2/stats/user',
          init: expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: expect.stringContaining('Basic '),
            }),
          }),
        })
      );
    });

    it('should throw error if WiGLE API returns error', async () => {
      (secretsManager.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'wigle_api_name') return 'test_user';
        if (key === 'wigle_api_token') return 'test_token';
        return null;
      });

      (fetchWigle as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ message: 'Unauthorized' }),
      });

      await expect(getUserStats()).rejects.toThrow('Unauthorized');
    });

    it('should throw default error message if json parsing fails on error', async () => {
      (secretsManager.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'wigle_api_name') return 'test_user';
        if (key === 'wigle_api_token') return 'test_token';
        return null;
      });

      (fetchWigle as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('JSON Parse Error')),
      });

      await expect(getUserStats()).rejects.toThrow('WiGLE API error: 500');
    });
  });
});
