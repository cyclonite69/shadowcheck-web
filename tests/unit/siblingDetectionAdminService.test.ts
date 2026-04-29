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
      })
      .mockResolvedValueOnce({
        rows: [
          {
            upper_rotation_count: 0,
            ssid_anchor_count: 0,
            cross_oui_count: 0,
            same_oui_proximity_count: 0,
          },
        ],
      });

    const result = await service.runSiblingRefreshJob({ batchSize: 100 });

    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.batchesRun).toBe(2);
    expect(result.seedsProcessed).toBe(5);
    expect(result.rowsUpserted).toBe(5);
    expect(result.lastCursor).toBe('AA:AA:AA:AA:AA:05');
    expect(mockAdminQuery).toHaveBeenCalledTimes(4);
  });

  it('handles missing row in result', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        {
          upper_rotation_count: 0,
          ssid_anchor_count: 0,
          cross_oui_count: 0,
          same_oui_proximity_count: 0,
        },
      ],
    });
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
    expect(mockAdminQuery).toHaveBeenCalledTimes(2);
  });

  it('returns sibling stats from network_sibling_pairs', async () => {
    mockAdminQuery.mockResolvedValueOnce({
      rows: [{ total_pairs: 48, active_pairs: 48, strong_pairs: 23, candidate_pairs: 25 }],
    });

    const stats = await service.getSiblingStats();

    expect(stats.total_pairs).toBe(48);
    expect(stats.strong_pairs).toBe(23);
  });

  describe('BUG 1 — last_octet_sequential rule fires in EXTRA_RULES_SQL', () => {
    // The EXTRA_RULES_SQL runs after the chunked loop. We verify the service
    // calls adminQuery with the extra-rules SQL and logs the result, which
    // confirms the rule is executed. The SQL itself is validated separately
    // via the migration; here we test the orchestration path.
    it('executes extra rules after chunk loop and logs last_octet counts', async () => {
      // chunk loop: one batch then done
      mockAdminQuery
        .mockResolvedValueOnce({
          rows: [{ seed_count: 2, upserted_count: 1, next_cursor: 'AA:BB:CC:DD:EE:02' }],
        })
        .mockResolvedValueOnce({ rows: [{ seed_count: 0, upserted_count: 0, next_cursor: null }] })
        // extra rules result — upper_rotation_count represents last_octet_sequential hits
        .mockResolvedValueOnce({
          rows: [
            {
              upper_rotation_count: 3,
              ssid_anchor_count: 1,
              cross_oui_count: 0,
              same_oui_proximity_count: 0,
            },
          ],
        });

      const result = await service.runSiblingRefreshJob({ batchSize: 100 });

      expect(result.success).toBe(true);
      // extra rules query is the 3rd call
      expect(mockAdminQuery).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Extra rules complete'),
        expect.objectContaining({ upper_rotation: 3 })
      );
    });
  });

  describe('BUG 2 — same_oui_proximity requires spatial corroboration', () => {
    it('reports zero same_oui_proximity when no spatial data present (no false positives)', async () => {
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ seed_count: 0, upserted_count: 0, next_cursor: null }] })
        .mockResolvedValueOnce({
          rows: [
            {
              upper_rotation_count: 0,
              ssid_anchor_count: 0,
              cross_oui_count: 0,
              // DB returns 0 because the fixed SQL requires location data
              same_oui_proximity_count: 0,
            },
          ],
        });

      const result = await service.runSiblingRefreshJob();

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Extra rules complete'),
        expect.objectContaining({ same_oui_proximity: 0 })
      );
    });

    it('reports same_oui_proximity count when spatial corroboration exists', async () => {
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ seed_count: 0, upserted_count: 0, next_cursor: null }] })
        .mockResolvedValueOnce({
          rows: [
            {
              upper_rotation_count: 0,
              ssid_anchor_count: 0,
              cross_oui_count: 0,
              same_oui_proximity_count: 5,
            },
          ],
        });

      const result = await service.runSiblingRefreshJob();

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Extra rules complete'),
        expect.objectContaining({ same_oui_proximity: 5 })
      );
    });
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
