const {
  captureImportMetrics,
  createImportHistoryEntry,
  markImportBackupTaken,
  completeImportSuccess,
  failImportHistory,
  getImportHistory,
  getDeviceSources,
  getImportCounts: getCountsHistory,
} = require('../../../server/src/services/adminImportHistoryService');

// Mock dependencies
jest.mock('../../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

const { adminQuery: historyAdminQuery } = require('../../../server/src/services/adminDbService');
const { query: historyDbQuery } = require('../../../server/src/config/database');

describe('adminImportHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('captureImportMetrics', () => {
    it('should query multiple tables and return metrics object', async () => {
      historyAdminQuery.mockResolvedValue({ rows: [{ value: '100' }] });
      const metrics = await captureImportMetrics();
      expect(metrics.networks).toBe(100);
      expect(historyAdminQuery).toHaveBeenCalledTimes(8);
    });

    it('should set metric to null when a query fails and continue remaining metrics', async () => {
      historyAdminQuery
        .mockRejectedValueOnce(new Error('relation does not exist')) // networks fails
        .mockResolvedValue({ rows: [{ value: '50' }] }); // rest succeed
      const metrics = await captureImportMetrics();
      expect(metrics.networks).toBeNull();
      expect(metrics.observations).toBe(50);
    });

    it('should set metric to null when row value is null', async () => {
      historyAdminQuery.mockResolvedValue({ rows: [{ value: null }] });
      const metrics = await captureImportMetrics();
      expect(metrics.networks).toBeNull();
    });
  });

  describe('createImportHistoryEntry', () => {
    it('should insert a new history row and return the id', async () => {
      historyAdminQuery.mockResolvedValue({ rows: [{ id: 123 }] });
      const id = await createImportHistoryEntry('tag', 'file.sqlite', {});
      expect(id).toBe(123);
    });

    it('should honor a custom status when provided', async () => {
      historyAdminQuery.mockResolvedValue({ rows: [{ id: 456 }] });
      const id = await createImportHistoryEntry('tag', 'file.sqlite', {}, 'pending');
      expect(id).toBe(456);
      expect(historyAdminQuery).toHaveBeenCalledWith(
        expect.stringContaining('VALUES ($1, $2, $4, $3)'),
        ['tag', 'file.sqlite', '{}', 'pending']
      );
    });

    it('should return 0 when the insert fails', async () => {
      historyAdminQuery.mockRejectedValueOnce(new Error('DB error'));
      const id = await createImportHistoryEntry('tag', 'file.sqlite', {});
      expect(id).toBe(0);
    });
  });

  describe('markImportBackupTaken', () => {
    it('should update the row with backup_taken=TRUE', async () => {
      await markImportBackupTaken(123);
      expect(historyAdminQuery).toHaveBeenCalledWith(
        expect.stringContaining('backup_taken = TRUE'),
        [123]
      );
    });
  });

  describe('completeImportSuccess', () => {
    it('should update history with success metrics', async () => {
      await completeImportSuccess(123, 10, 0, '5.5', {});
      expect(historyAdminQuery).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining([123, 10, 0, '5.5', '{}', 'success'])
      );
    });
  });

  describe('failImportHistory', () => {
    it('should update history with failure details (no duration)', async () => {
      await failImportHistory(123, 'some error');
      expect(historyAdminQuery).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining([123, 'some error'])
      );
      // duration_s not included when omitted
      const [, params] = historyAdminQuery.mock.calls[0];
      expect(params).toHaveLength(2);
    });

    it('should include duration_s when provided', async () => {
      await failImportHistory(456, 'timeout', '12.3');
      const [sql, params] = historyAdminQuery.mock.calls[0];
      expect(sql).toContain('duration_s');
      expect(params).toEqual([456, '12.3', 'timeout']);
    });
  });

  describe('getImportHistory', () => {
    it('should return recent history rows', async () => {
      const mockRows = [{ id: 1 }];
      historyAdminQuery.mockResolvedValue({ rows: mockRows });
      const result = await getImportHistory(10);
      expect(result).toEqual(mockRows);
      expect(historyAdminQuery.mock.calls[0][1]).toEqual([10, null, null]);
    });

    it('uses a stable started-at and id cursor for older rows', async () => {
      historyAdminQuery.mockResolvedValue({ rows: [] });
      await getImportHistory(10, { startedAt: '2026-10-01T12:00:00.000Z', id: 42 });

      const [sql, params] = historyAdminQuery.mock.calls[0];
      expect(sql).toContain('(ih.started_at, ih.id) < ($2::timestamptz, $3::bigint)');
      expect(sql).toContain('ORDER BY ih.started_at DESC, ih.id DESC');
      expect(params).toEqual([10, '2026-10-01T12:00:00.000Z', 42]);
    });
  });

  describe('getDeviceSources', () => {
    it('should return list of sources', async () => {
      const mockRows = [{ source_tag: 'tag1' }];
      historyAdminQuery.mockResolvedValue({ rows: mockRows });
      const result = await getDeviceSources();
      expect(result).toEqual(mockRows);
    });
  });

  describe('getCountsHistory', () => {
    it('should return counts from DB', async () => {
      historyDbQuery.mockResolvedValue({ rows: [{ observations: 10, networks: 5 }] });
      const result = await getCountsHistory();
      expect(result).toEqual({ observations: 10, networks: 5 });
    });

    it('should return zero counts when rows is empty', async () => {
      historyDbQuery.mockResolvedValue({ rows: [] });
      const result = await getCountsHistory();
      expect(result).toEqual({ observations: 0, networks: 0 });
    });
  });
});
