/**
 * Explorer Service Unit Tests
 */

import {
  checkHomeLocationForFilters,
  executeExplorerQuery,
  listNetworks,
  listNetworksV2,
} from '../../server/src/services/explorerService';
import * as explorerQueries from '../../server/src/services/explorerQueries';

const { query } = require('../../server/src/config/database');

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../server/src/services/explorerQueries', () => ({
  buildLegacyExplorerQuery: jest.fn(),
  buildExplorerV2Query: jest.fn(),
}));

describe('Explorer Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkHomeLocationForFilters', () => {
    it('should return true if no home filters are enabled', async () => {
      const result = await checkHomeLocationForFilters({ otherFilter: true });
      expect(result).toBe(true);
      expect(query).not.toHaveBeenCalled();
    });

    it('should query DB and return true if home location exists', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
      const result = await checkHomeLocationForFilters({ distanceFromHomeMin: 10 });
      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(expect.stringContaining("marker_type = 'home'"));
    });

    it('should query DB and return false if home location does not exist', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 });
      const result = await checkHomeLocationForFilters({ distanceFromHomeMax: 50 });
      expect(result).toBe(false);
    });

    it('should throw specific error if table is missing', async () => {
      const dbError = new Error('Relation does not exist') as any;
      dbError.code = '42P01';
      (query as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(checkHomeLocationForFilters({ distanceFromHomeMin: 10 })).rejects.toThrow(
        'Home location markers table is missing'
      );
    });

    it('should throw other DB errors', async () => {
      const dbError = new Error('Generic DB Error');
      (query as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(checkHomeLocationForFilters({ distanceFromHomeMin: 10 })).rejects.toThrow(
        'Generic DB Error'
      );
    });
  });

  describe('executeExplorerQuery', () => {
    it('should execute arbitrary SQL with params', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const result = await executeExplorerQuery('SELECT * FROM test WHERE id = $1', [1]);
      expect(result.rows).toEqual([{ id: 1 }]);
      expect(query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
    });
  });

  describe('listNetworks', () => {
    it('should build and execute legacy explorer query', async () => {
      const mockOpts = {
        homeLon: null,
        homeLat: null,
        search: 'test',
        sort: 'bssid',
        order: 'ASC' as const,
        qualityWhere: '',
        limit: 50,
        offset: 0,
      };

      (explorerQueries.buildLegacyExplorerQuery as jest.Mock).mockReturnValueOnce({
        sql: 'SELECT legacy',
        params: ['test'],
      });

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { total: 100, bssid: 'A' },
          { total: 100, bssid: 'B' },
        ],
      });

      const result = await listNetworks(mockOpts);
      expect(result.total).toBe(100);
      expect(result.rows.length).toBe(2);
      expect(query).toHaveBeenCalledWith('SELECT legacy', ['test']);
    });

    it('should handle empty result set', async () => {
      (explorerQueries.buildLegacyExplorerQuery as jest.Mock).mockReturnValueOnce({
        sql: 'SELECT empty',
        params: [],
      });

      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await listNetworks({} as any);
      expect(result.total).toBe(0);
      expect(result.rows).toEqual([]);
    });
  });

  describe('listNetworksV2', () => {
    it('should build and execute v2 explorer query', async () => {
      const mockOpts = {
        search: 'test',
        sort: 'bssid',
        order: 'ASC',
        limit: 50,
        offset: 0,
      };

      (explorerQueries.buildExplorerV2Query as jest.Mock).mockReturnValueOnce({
        sql: 'SELECT v2',
        params: ['test'],
      });

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total: 200, bssid: 'X' }],
      });

      const result = await listNetworksV2(mockOpts);
      expect(result.total).toBe(200);
      expect(result.rows.length).toBe(1);
      expect(query).toHaveBeenCalledWith('SELECT v2', ['test']);
    });

    it('should handle empty result set', async () => {
      (explorerQueries.buildExplorerV2Query as jest.Mock).mockReturnValueOnce({
        sql: 'SELECT empty v2',
        params: [],
      });

      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await listNetworksV2({} as any);
      expect(result.total).toBe(0);
      expect(result.rows).toEqual([]);
    });
  });

  describe('getNetworkByBssid', () => {
    it('should fetch network by BSSID', async () => {
      const mockBssid = 'AA:BB:CC:DD:EE:FF';
      const mockNetwork = { bssid: mockBssid, ssid: 'TestNet' };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockNetwork] });

      const result = await require('../../server/src/services/explorerService').getNetworkByBssid(
        mockBssid
      );
      expect(result).toEqual(mockNetwork);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('UPPER(bssid) = UPPER($1)'), [
        mockBssid,
      ]);
    });

    it('should return null if network not found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const result = await require('../../server/src/services/explorerService').getNetworkByBssid(
        'NOT:FOUND'
      );
      expect(result).toBeNull();
    });
  });
});
