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
  getWigleObservations,
  getKmlPointsForMap,
  getUserStats,
} from '../../../server/src/services/wigleService';
import { query } from '../../../server/src/config/database';
import * as wigleQueriesRepo from '../../../server/src/repositories/wigleQueriesRepository';
import * as wiglePersistenceRepo from '../../../server/src/repositories/wiglePersistenceRepository';
import secretsManager from '../../../server/src/services/secretsManager';

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/repositories/wigleQueriesRepository');
jest.mock('../../../server/src/repositories/wiglePersistenceRepository');
jest.mock('../../../server/src/services/secretsManager');

describe('wigleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWigleNetworkByBSSID', () => {
    it('should return a network if found', async () => {
      const mockRow = { bssid: 'AA:BB:CC:DD:EE:FF', ssid: 'TestNetwork' };
      (query as jest.Mock).mockResolvedValue({ rows: [mockRow] });

      const result = await getWigleNetworkByBSSID('AA:BB:CC:DD:EE:FF');
      expect(result).toEqual(mockRow);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['AA:BB:CC:DD:EE:FF']);
    });

    it('should return null if not found', async () => {
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

  describe('getUserStats', () => {
    it('should throw error if credentials missing', async () => {
      (secretsManager.get as jest.Mock).mockReturnValue(undefined);
      await expect(getUserStats()).rejects.toThrow('WiGLE API credentials not configured');
    });
  });
});
