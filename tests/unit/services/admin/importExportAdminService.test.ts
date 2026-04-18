export {};

const { 
  getBackupData, 
  exportMLTrainingData, 
  getImportCounts: getCountsImportExport, 
  truncateAllData 
} = require('../../../../server/src/services/admin/importExportAdminService');

jest.mock('../../../../server/src/config/container', () => ({
  adminDbService: {
    adminQuery: jest.fn(),
  },
  databaseService: {
    query: jest.fn(),
  },
}));

const { adminDbService, databaseService } = require('../../../../server/src/config/container');

describe('importExportAdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBackupData', () => {
    it('should fetch all related tables', async () => {
      databaseService.query.mockResolvedValue({ rows: [] });
      const result = await getBackupData();
      expect(databaseService.query).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ networks: [], observations: [], tags: [] });
    });
  });

  describe('exportMLTrainingData', () => {
    it('should fetch training data', async () => {
      databaseService.query.mockResolvedValue({ rows: [{ bssid: 'AA' }] });
      const result = await exportMLTrainingData();
      expect(result).toEqual([{ bssid: 'AA' }]);
    });
  });

  describe('getCountsImportExport', () => {
    it('should return counts from DB', async () => {
      databaseService.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });
      const result = await getCountsImportExport();
      expect(result).toEqual({ observations: 10, networks: 5 });
    });
  });

  describe('truncateAllData', () => {
    it('should call TRUNCATE on tables', async () => {
      adminDbService.adminQuery.mockResolvedValue({ rows: [] });
      await truncateAllData();
      expect(adminDbService.adminQuery).toHaveBeenCalledTimes(3);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('TRUNCATE TABLE app.observations'),
        []
      );
    });
  });
});
