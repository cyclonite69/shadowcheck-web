export {};

const mockAdminQuery = jest.fn();
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../server/src/config/container', () => ({
  adminDbService: {
    adminQuery: (...args: any[]) => mockAdminQuery(...args),
  },
}));

jest.mock('../../server/src/logging/logger', () => mockLogger);

describe('siblingDetectionAdminService', () => {
  let service: any;
  let state: any;

  beforeEach(() => {
    jest.resetModules();
    mockAdminQuery.mockReset();
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    service = require('../../server/src/services/admin/siblingDetectionAdminService');
    state = require('../../server/src/services/admin/siblingDetectionState').state;
    // Reset state manually if needed because resetModules might not clear it if it's imported in siblingDetectionAdminService
    state.running = false;
    state.startedAt = null;
    state.finishedAt = null;
    state.lastError = null;
    state.lastResult = null;
  });

  it('runs cursor-based chunks and stops when no more seeds exist', async () => {
    mockAdminQuery
      .mockResolvedValueOnce({
        rows: [{ seed_count: 3, upserted_count: 4, next_cursor: 'AA:AA:AA:AA:AA:03' }],
      })
      .mockResolvedValueOnce({
        rows: [{ seed_count: 2, upserted_count: 1, next_cursor: 'AA:AA:AA:AA:AA:05' }],
      })
      .mockResolvedValueOnce({
        rows: [{ seed_count: 0, upserted_count: 0, next_cursor: null }],
      });

    const result = await service.runSiblingRefreshJob({ batchSize: 100 });

    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.batchesRun).toBe(2);
    expect(result.seedsProcessed).toBe(5);
    expect(result.rowsUpserted).toBe(5);
    expect(result.lastCursor).toBe('AA:AA:AA:AA:AA:05');
    expect(mockAdminQuery).toHaveBeenCalledTimes(3);
  });

  it('handles missing row in result', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [] });
    const result = await service.runSiblingRefreshJob();
    expect(result.seedsProcessed).toBe(0);
  });

  it('honors maxBatches and returns completed=false when truncated', async () => {
    mockAdminQuery.mockResolvedValue({
      rows: [{ seed_count: 3, upserted_count: 2, next_cursor: 'AA:AA:AA:AA:AA:03' }],
    });

    const result = await service.runSiblingRefreshJob({ batchSize: 50, maxBatches: 1 });

    expect(result.success).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.batchesRun).toBe(1);
    expect(result.seedsProcessed).toBe(3);
    expect(result.rowsUpserted).toBe(2);
    expect(mockAdminQuery).toHaveBeenCalledTimes(1);
  });

  it('returns sibling stats from network_sibling_pairs', async () => {
    mockAdminQuery.mockResolvedValueOnce({
      rows: [{ total_pairs: 48, active_pairs: 48, strong_pairs: 23, candidate_pairs: 25 }],
    });

    const stats = await service.getSiblingStats();

    expect(stats.total_pairs).toBe(48);
    expect(stats.strong_pairs).toBe(23);
  });

  describe('startSiblingRefresh', () => {
    it('accepts and starts a new job if not already running', async () => {
      mockAdminQuery.mockResolvedValue({
        rows: [{ seed_count: 0, upserted_count: 0, next_cursor: null }],
      });

      const result = await service.startSiblingRefresh({ batchSize: 100 });

      expect(result.accepted).toBe(true);
      expect(result.status.running).toBe(true);
      expect(state.running).toBe(true);

      // Wait for the background job to finish
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(state.running).toBe(false);
      expect(state.lastResult).toBeDefined();
      expect(state.finishedAt).not.toBeNull();
    });

    it('rejects if already running', async () => {
      state.running = true;
      const result = await service.startSiblingRefresh();
      expect(result.accepted).toBe(false);
      expect(result.status.running).toBe(true);
    });

    it('handles errors in background job', async () => {
      mockAdminQuery.mockRejectedValue(new Error('DB Error'));

      await service.startSiblingRefresh();

      // Wait for the background job to finish
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(state.running).toBe(false);
      expect(state.lastError).toBe('DB Error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.objectContaining({ error: 'DB Error' })
      );
    });
  });
});
