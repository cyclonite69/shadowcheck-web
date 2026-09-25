export {};

const {
  getBackupData,
  exportMLTrainingData,
  getImportCounts: getCountsImportExport,
  truncateAllData,
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

      const calls = databaseService.query.mock.calls;
      expect(calls[0][0]).toEqual('SELECT * FROM app.network_entries ORDER BY bssid');
      expect(calls[0][1]).toEqual([]);

      expect(calls[1][0]).toEqual('SELECT * FROM app.observations ORDER BY time DESC LIMIT 10000');
      expect(calls[1][1]).toEqual([]);

      expect(calls[2][0]).toEqual('SELECT * FROM app.network_tags ORDER BY bssid');
      expect(calls[2][1]).toEqual([]);
    });

    it('should propagate database error', async () => {
      databaseService.query.mockRejectedValueOnce(new Error('DB Error'));
      await expect(getBackupData()).rejects.toThrow('DB Error');
    });
  });

  describe('exportMLTrainingData', () => {
    it('should fetch training data', async () => {
      databaseService.query.mockResolvedValue({ rows: [{ bssid: 'AA' }] });
      const result = await exportMLTrainingData();
      expect(result).toEqual([{ bssid: 'AA' }]);

      expect(databaseService.query).toHaveBeenCalled();
      const [sql, params] = databaseService.query.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('ne.bssid');
      expect(sql).toContain('ne.ssid');
      expect(sql).toContain('ne.observations AS observation_count');
      expect(sql).toContain('ne.unique_days');
      expect(sql).toContain('ne.unique_locations');
      expect(sql).toContain('ne.signal AS max_signal');
      expect(sql).toContain('ne.max_distance_meters');
      expect(sql).toContain(
        "CASE WHEN nt.threat_tag IN ('THREAT', 'INVESTIGATE') THEN 1 ELSE 0 END AS is_threat"
      );
      expect(sql).toContain('nt.threat_tag');
      expect(sql).toContain('nt.is_ignored');
      expect(sql).toContain('FROM app.network_entries ne');
      expect(sql).toContain('LEFT JOIN app.network_tags nt ON ne.bssid = nt.bssid');
      expect(sql).toContain('WHERE nt.threat_tag IS NOT NULL');
      expect(sql).toContain('ORDER BY ne.bssid');
      expect(params).toEqual([]);
    });

    it('should propagate database error', async () => {
      databaseService.query.mockRejectedValueOnce(new Error('DB Error'));
      await expect(exportMLTrainingData()).rejects.toThrow('DB Error');
    });
  });

  describe('getCountsImportExport', () => {
    it('should return counts from DB', async () => {
      databaseService.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });
      const result = await getCountsImportExport();
      expect(result).toEqual({ observations: 10, networks: 5 });

      const calls = databaseService.query.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toEqual('SELECT COUNT(*) as count FROM app.observations');
      expect(calls[0][1]).toEqual([]);
      expect(calls[1][0]).toEqual('SELECT COUNT(*) as count FROM app.network_entries');
      expect(calls[1][1]).toEqual([]);
    });

    it('should propagate database error', async () => {
      databaseService.query.mockRejectedValueOnce(new Error('DB Error'));
      await expect(getCountsImportExport()).rejects.toThrow('DB Error');
    });
  });

  describe('truncateAllData', () => {
    const originalDbName = process.env.DB_NAME;
    const originalPgDatabase = process.env.PGDATABASE;
    const originalUnsafeOverride = process.env.ALLOW_UNSAFE_DATA_RESET;

    afterEach(() => {
      if (originalDbName === undefined) {
        delete process.env.DB_NAME;
      } else {
        process.env.DB_NAME = originalDbName;
      }
      if (originalPgDatabase === undefined) {
        delete process.env.PGDATABASE;
      } else {
        process.env.PGDATABASE = originalPgDatabase;
      }
      if (originalUnsafeOverride === undefined) {
        delete process.env.ALLOW_UNSAFE_DATA_RESET;
      } else {
        process.env.ALLOW_UNSAFE_DATA_RESET = originalUnsafeOverride;
      }
    });

    it('refuses destructive resets against non-test databases', async () => {
      process.env.DB_NAME = 'shadowcheck_db';
      delete process.env.PGDATABASE;
      delete process.env.ALLOW_UNSAFE_DATA_RESET;

      await expect(truncateAllData()).rejects.toThrow(
        'Refusing destructive network reset against database'
      );
      expect(adminDbService.adminQuery).not.toHaveBeenCalled();
    });

    it('allows an explicit unsafe override for non-test databases', async () => {
      process.env.DB_NAME = 'shadowcheck_db';
      delete process.env.PGDATABASE;
      process.env.ALLOW_UNSAFE_DATA_RESET = 'true';
      adminDbService.adminQuery.mockResolvedValue({ rows: [] });

      await expect(truncateAllData()).resolves.toBeUndefined();
      expect(adminDbService.adminQuery).toHaveBeenCalledTimes(3);
    });

    it('should call TRUNCATE on tables', async () => {
      process.env.DB_NAME = 'shadowcheck_test';
      adminDbService.adminQuery.mockResolvedValue({ rows: [] });
      await truncateAllData();
      expect(adminDbService.adminQuery).toHaveBeenCalledTimes(3);

      const calls = adminDbService.adminQuery.mock.calls;
      expect(calls[0][0]).toEqual('TRUNCATE TABLE app.observations CASCADE');
      expect(calls[0][1]).toEqual([]);
      expect(calls[1][0]).toEqual('TRUNCATE TABLE app.network_entries CASCADE');
      expect(calls[1][1]).toEqual([]);
      expect(calls[2][0]).toEqual('TRUNCATE TABLE app.network_tags CASCADE');
      expect(calls[2][1]).toEqual([]);
    });

    it('should propagate database error', async () => {
      adminDbService.adminQuery.mockRejectedValueOnce(new Error('DB Error'));
      await expect(truncateAllData()).rejects.toThrow('DB Error');
    });
  });
});
