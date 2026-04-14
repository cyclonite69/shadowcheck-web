export {};

const threatScoringService = require('../../server/src/services/threatScoringService') as any;
const { query } = require('../../server/src/config/database') as any;
const logger = require('../../server/src/logging/logger') as any;

jest.mock('../../server/src/config/database');
jest.mock('../../server/src/logging/logger');

describe('ThreatScoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset stats between tests if needed, but since it's a singleton,
    // we might need a way to reset it.
    // Looking at the code, stats are private.
  });

  describe('computeThreatScores', () => {
    it('should compute threat scores successfully', async () => {
      query.mockResolvedValueOnce({ rowCount: 5 });

      const result = await threatScoringService.computeThreatScores(10, 24);

      expect(result).toEqual({
        success: true,
        processed: 5,
        updated: 5,
        executionTimeMs: expect.any(Number),
      });

      expect(query).toHaveBeenCalledWith(expect.stringContaining('WITH targets AS'), [10]);
      expect(logger.info).toHaveBeenCalledWith('Starting unified threat score computation', {
        batchSize: 10,
        maxAgeHours: 24,
      });
    });

    it('should skip if already running', async () => {
      // We can't easily set isRunning to true from outside,
      // but we can trigger it by not awaiting a long-running query.

      let resolveQuery: any;
      const queryPromise = new Promise((resolve) => {
        resolveQuery = resolve;
      });
      query.mockReturnValueOnce(queryPromise);

      const firstCall = threatScoringService.computeThreatScores(10, 24);
      const secondCall = await threatScoringService.computeThreatScores(10, 24);

      expect(secondCall).toEqual({ skipped: true });
      expect(logger.warn).toHaveBeenCalledWith('Threat scoring already running, skipping');

      resolveQuery({ rowCount: 5 });
      await firstCall;
    });

    it('should handle errors and update stats', async () => {
      const error = new Error('DB Error');
      query.mockRejectedValueOnce(error);

      await expect(threatScoringService.computeThreatScores()).rejects.toThrow('DB Error');

      const stats = threatScoringService.getStats();
      expect(stats.lastError).toBe('DB Error');
      expect(logger.error).toHaveBeenCalledWith('Threat score computation failed', {
        error: 'DB Error',
      });
    });
  });

  describe('markAllForRecompute', () => {
    it('should call computeThreatScores with large batch size', async () => {
      query.mockResolvedValueOnce({ rowCount: 100 });

      const result = await threatScoringService.markAllForRecompute();

      expect(result).toEqual({ success: true, rowsAffected: 100 });
      expect(query).toHaveBeenCalledWith(expect.any(String), [1000000]);
    });
  });

  describe('getStats', () => {
    it('should return service stats', () => {
      const stats = threatScoringService.getStats();
      expect(stats).toHaveProperty('isRunning');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('totalUpdated');
    });
  });

  describe('getQuickThreats', () => {
    it('should fetch quick threats with filters', async () => {
      const mockRows = [{ bssid: 'B1', threat_score: 90, total_count: '1' }];
      query.mockResolvedValueOnce({ rows: mockRows });

      const params = {
        limit: 10,
        offset: 0,
        minObservations: 5,
        minUniqueDays: 2,
        minUniqueLocations: 1,
        minRangeKm: 0.1,
        minThreatScore: 30,
        minTimestamp: Date.now() - 86400000,
      };

      const result = await threatScoringService.getQuickThreats(params);

      expect(result.rows).toEqual(mockRows);
      expect(result.totalCount).toBe(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([params.minTimestamp, params.limit, params.offset])
      );
    });

    it('should return zero totalCount if no rows found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await threatScoringService.getQuickThreats({
        limit: 10,
        offset: 0,
        minObservations: 0,
        minUniqueDays: 0,
        minUniqueLocations: 0,
        minRangeKm: 0,
        minThreatScore: 0,
        minTimestamp: 0,
      });

      expect(result.totalCount).toBe(0);
      expect(result.rows).toEqual([]);
    });
  });

  describe('getDetailedThreats', () => {
    it('should fetch detailed threats', async () => {
      const mockRows = [{ bssid: 'B1', final_threat_score: 95 }];
      query.mockResolvedValueOnce({ rows: mockRows });

      const result = await threatScoringService.getDetailedThreats();

      expect(result).toEqual(mockRows);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    });
  });
});
