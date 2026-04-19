const { pool, query } = require('../../../../server/src/config/database');
import * as runRepository from '../../../../server/src/services/wigleImport/runRepository';

jest.mock('../../../../server/src/config/database', () => ({
  pool: {
    connect: jest.fn(),
  },
  query: jest.fn(),
}));

describe('runRepository', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
  });

  describe('getRunOrThrow', () => {
    it('should throw if run not found', async () => {
      query.mockResolvedValue({ rows: [] });
      await expect(runRepository.getRunOrThrow(999)).rejects.toThrow('WiGLE import run 999 not found');
    });

    it('should throw if database query fails', async () => {
      query.mockRejectedValue(new Error('DB Connection Error'));
      await expect(runRepository.getRunOrThrow(1)).rejects.toThrow('DB Connection Error');
    });
  });

  describe('reconcileRunProgress', () => {
    it('should rollback and throw on error', async () => {
      mockClient.query.mockImplementation((text: string) => {
        if (text === 'BEGIN') return Promise.resolve();
        throw new Error('Transaction Failed');
      });

      await expect(runRepository.reconcileRunProgress(1)).rejects.toThrow('Transaction Failed');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw if pool.connect fails', async () => {
      pool.connect.mockRejectedValue(new Error('Pool Connection Error'));
      await expect(runRepository.reconcileRunProgress(1)).rejects.toThrow('Pool Connection Error');
    });
  });

  describe('createImportRun', () => {
    it('should throw if insert fails', async () => {
      query.mockRejectedValue(new Error('Insert Failed'));
      await expect(runRepository.createImportRun({})).rejects.toThrow('Insert Failed');
    });
  });

  describe('markRunFailure', () => {
    it('should throw if update fails', async () => {
      query.mockRejectedValue(new Error('Update Failed'));
      await expect(runRepository.markRunFailure(1, 'error')).rejects.toThrow('Update Failed');
    });
  });

  describe('markRunControlStatus', () => {
    it('should return null if no run updated', async () => {
      query.mockResolvedValue({ rows: [] });
      const result = await runRepository.markRunControlStatus(1, 'paused');
      expect(result).toBeNull();
    });

    it('should throw if update fails', async () => {
      query.mockRejectedValue(new Error('Status Update Failed'));
      await expect(runRepository.markRunControlStatus(1, 'paused')).rejects.toThrow('Status Update Failed');
    });
  });

  describe('resumeRunState', () => {
    it('should return null if no run updated', async () => {
      query.mockResolvedValue({ rows: [] });
      const result = await runRepository.resumeRunState(1);
      expect(result).toBeNull();
    });
  });

  describe('completeRun', () => {
    it('should throw if update fails', async () => {
      query.mockRejectedValue(new Error('Complete Update Failed'));
      await expect(runRepository.completeRun(1)).rejects.toThrow('Complete Update Failed');
    });
  });

  describe('persistPageFailure', () => {
    it('should throw if insert fails', async () => {
      query.mockRejectedValue(new Error('Persist Failure Failed'));
      await expect(runRepository.persistPageFailure(1, 1, 'cursor', 'msg')).rejects.toThrow('Persist Failure Failed');
    });
  });

  describe('listImportRuns', () => {
    it('should handle search filters and throw on error', async () => {
      query.mockRejectedValue(new Error('Query Failed'));
      await expect(runRepository.listImportRuns({ status: 'failed', searchTerm: 'test' })).rejects.toThrow('Query Failed');
    });
  });

  describe('getImportCompletenessSummary', () => {
    it('should throw if query fails', async () => {
      query.mockRejectedValue(new Error('Summary Query Failed'));
      await expect(runRepository.getImportCompletenessSummary({ state: 'CA' })).rejects.toThrow('Summary Query Failed');
    });
  });

  describe('bulkDeleteCancelledRunsByIds', () => {
    it('should return 0 if empty array passed', async () => {
      const result = await runRepository.bulkDeleteCancelledRunsByIds([]);
      expect(result).toBe(0);
      expect(query).not.toHaveBeenCalled();
    });

    it('should throw if delete fails', async () => {
      query.mockRejectedValue(new Error('Delete Failed'));
      await expect(runRepository.bulkDeleteCancelledRunsByIds([1])).rejects.toThrow('Delete Failed');
    });
  });

  describe('countRecentCancelledByFingerprint', () => {
    it('should return 0 if no results', async () => {
      query.mockResolvedValue({ rows: [{}] });
      const result = await runRepository.countRecentCancelledByFingerprint('fingerprint');
      expect(result).toBe(0);
    });

    it('should throw if query fails', async () => {
      query.mockRejectedValue(new Error('Count Failed'));
      await expect(runRepository.countRecentCancelledByFingerprint('f')).rejects.toThrow('Count Failed');
    });
  });

  describe('findGlobalCancelledClusterIds', () => {
    it('should throw if query fails', async () => {
      query.mockRejectedValue(new Error('Find Cluster Failed'));
      await expect(runRepository.findGlobalCancelledClusterIds()).rejects.toThrow('Find Cluster Failed');
    });
  });
});
