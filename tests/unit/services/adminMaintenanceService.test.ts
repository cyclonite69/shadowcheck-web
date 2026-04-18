/**
 * AdminMaintenanceService Unit Tests
 */

import { adminQuery } from '../../../server/src/services/adminDbService';
import { query } from '../../../server/src/config/database';
import {
  getDuplicateObservationStats,
  deleteDuplicateObservations,
  getObservationCount,
  refreshColocationView,
  truncateAllData,
} from '../../../server/src/services/adminMaintenanceService';

jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/config/database');

describe('AdminMaintenanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDuplicateObservationStats', () => {
    it('should return duplicate stats', async () => {
      const mockResult = { total: 100, unique_obs: 80 };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockResult] });

      const stats = await getDuplicateObservationStats();

      expect(stats).toEqual(mockResult);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as total'));
    });

    it('should return default stats if no rows returned', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const stats = await getDuplicateObservationStats();

      expect(stats).toEqual({ total: 0, unique_obs: 0 });
    });
  });

  describe('deleteDuplicateObservations', () => {
    it('should return row count after deleting duplicates', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: 20 });

      const result = await deleteDuplicateObservations();

      expect(result).toBe(20);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM app.observations')
      );
    });

    it('should return 0 if rowCount is null', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: null });

      const result = await deleteDuplicateObservations();

      expect(result).toBe(0);
    });
  });

  describe('getObservationCount', () => {
    it('should return total observation count', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ total: '150' }] });

      const count = await getObservationCount();

      expect(count).toBe(150);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as total'));
    });

    it('should return 0 if no results returned', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const count = await getObservationCount();

      expect(count).toBe(0);
    });

    it('should return 0 if total is missing', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{}] });

      const count = await getObservationCount();

      expect(count).toBe(0);
    });
  });

  describe('refreshColocationView', () => {
    it('should execute queries to refresh colocation view', async () => {
      (adminQuery as jest.Mock).mockResolvedValue({ rowCount: 1 });

      await refreshColocationView(1600000000000);

      expect(adminQuery).toHaveBeenCalledTimes(4);
      expect(adminQuery).toHaveBeenCalledWith(expect.stringContaining('DROP MATERIALIZED VIEW'));
      expect(adminQuery).toHaveBeenCalledWith(expect.stringContaining('CREATE MATERIALIZED VIEW'));
      expect(adminQuery).toHaveBeenCalledWith(expect.stringContaining('CREATE UNIQUE INDEX'));
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('REFRESH MATERIALIZED VIEW CONCURRENTLY')
      );

      // Check if minValidTimestamp is interpolated correctly
      const createViewCall = (adminQuery as jest.Mock).mock.calls.find((call) =>
        call[0].includes('CREATE MATERIALIZED VIEW')
      );
      expect(createViewCall[0]).toContain('1600000000000');
    });

    it('should throw error if minValidTimestamp is invalid', async () => {
      await expect(refreshColocationView(-1)).rejects.toThrow('Invalid minValidTimestamp');
      await expect(refreshColocationView(NaN)).rejects.toThrow('Invalid minValidTimestamp');
      await expect(refreshColocationView(Infinity)).rejects.toThrow('Invalid minValidTimestamp');
      expect(adminQuery).not.toHaveBeenCalled();
    });
  });

  describe('truncateAllData', () => {
    it('should truncate observations and networks tables', async () => {
      await truncateAllData();

      expect(adminQuery).toHaveBeenCalledTimes(2);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('TRUNCATE TABLE app.observations')
      );
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('TRUNCATE TABLE app.networks')
      );
    });
  });
});
