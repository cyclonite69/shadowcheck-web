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
    it('should update history with failure details', async () => {
      await failImportHistory(123, 'some error');
      expect(historyAdminQuery).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining([123, 'some error'])
      );
    });
  });

  describe('getImportHistory', () => {
    it('should return recent history rows', async () => {
      const mockRows = [{ id: 1 }];
      historyAdminQuery.mockResolvedValue({ rows: mockRows });
      const result = await getImportHistory(10);
      expect(result).toEqual(mockRows);
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
  });
});
