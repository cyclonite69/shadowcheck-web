/**
 * AdminMaintenanceService Unit Tests
 */

import { adminQuery, getAdminPool } from '../../../server/src/services/adminDbService';
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
      expect(query).toHaveBeenCalled();
      const [sql] = (query as jest.Mock).mock.calls[0];
      expect(sql).toContain('SELECT COUNT(*) as total');
      expect(sql).toContain(
        'COUNT(DISTINCT (bssid, observed_at, lat, lon, accuracy)) as unique_obs'
      );
      expect(sql).toContain('FROM app.observations');
      expect(sql).toContain('WHERE lat IS NOT NULL AND lon IS NOT NULL');
    });

    it('should return default stats if no rows returned', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const stats = await getDuplicateObservationStats();

      expect(stats).toEqual({ total: 0, unique_obs: 0 });
    });

    it('should propagate database error', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));
      await expect(getDuplicateObservationStats()).rejects.toThrow('DB Error');
    });
  });

  describe('deleteDuplicateObservations', () => {
    it('should return row count after deleting duplicates', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: 20 });

      const result = await deleteDuplicateObservations();

      expect(result).toBe(20);
      expect(adminQuery).toHaveBeenCalled();
      const [sql] = (adminQuery as jest.Mock).mock.calls[0];
      expect(sql).toContain('DELETE FROM app.observations');
      expect(sql).toContain('WHERE id IN (');
      expect(sql).toContain('SELECT id');
      expect(sql).toContain('SELECT id,');
      expect(sql).toContain('ROW_NUMBER() OVER (');
      expect(sql).toContain('PARTITION BY bssid, observed_at, lat, lon, accuracy');
      expect(sql).toContain('ORDER BY id');
      expect(sql).toContain(') as rn');
      expect(sql).toContain('FROM app.observations');
      expect(sql).toContain('WHERE lat IS NOT NULL AND lon IS NOT NULL');
      expect(sql).toContain(') t');
      expect(sql).toContain('WHERE rn > 1');
    });

    it('should return 0 if rowCount is null', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: null });

      const result = await deleteDuplicateObservations();

      expect(result).toBe(0);
    });

    it('should propagate database error', async () => {
      (adminQuery as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));
      await expect(deleteDuplicateObservations()).rejects.toThrow('DB Error');
    });
  });

  describe('getObservationCount', () => {
    it('should return total observation count', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ total: '150' }] });

      const count = await getObservationCount();

      expect(count).toBe(150);
      expect(query).toHaveBeenCalled();
      const [sql] = (query as jest.Mock).mock.calls[0];
      expect(sql).toContain('SELECT COUNT(*) as total');
      expect(sql).toContain('FROM app.observations');
      expect(sql).toContain('WHERE lat IS NOT NULL AND lon IS NOT NULL');
    });

    it('should return 0 if no results returned', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const count = await getObservationCount();

      expect(count).toBe(0);
    });

    it('should propagate database error', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));
      await expect(getObservationCount()).rejects.toThrow('DB Error');
    });
  });

  describe('refreshColocationView', () => {
    it('should skip and resolve without calling database', async () => {
      await refreshColocationView(1600000000000);
      expect(adminQuery).not.toHaveBeenCalled();
    });
  });

  describe('truncateAllData', () => {
    it('should preserve the VISINT_UNMATCHED sentinel while clearing other networks', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      (getAdminPool as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(client),
      });

      await truncateAllData();

      expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(client.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DELETE FROM app.observations')
      );
      expect(client.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('DELETE FROM app.ssid_history')
      );
      expect(client.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('DELETE FROM app.networks')
      );
      expect(client.query).toHaveBeenNthCalledWith(5, 'COMMIT');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('should propagate database error', async () => {
      const client = {
        query: jest.fn().mockRejectedValueOnce(new Error('DB Error')),
        release: jest.fn(),
      };
      (getAdminPool as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(client),
      });

      await expect(truncateAllData()).rejects.toThrow('DB Error');
      expect(client.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });
});
