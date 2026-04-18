import * as repository from '../../server/src/services/wigleImport/runRepository';

// Mock the database
jest.mock('../../server/src/config/database', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    query: jest.fn(),
    pool: {
      connect: jest.fn(() => Promise.resolve(mockClient)),
    },
  };
});

const { query, pool } = require('../../server/src/config/database');

describe('wigleImportRunRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createImportRun', () => {
    it('should insert a new run and return the result', async () => {
      const mockRun = { id: 1, status: 'running' };
      query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.createImportRun({ ssid: 'test-ssid' });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['v2', 'test-ssid', null])
      );
      expect(result).toEqual(mockRun);
    });
  });

  describe('findLatestResumableRun', () => {
    it('should find the latest resumable run', async () => {
      const mockRun = { id: 1, status: 'paused' };
      query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.findLatestResumableRun({ ssid: 'test' }, [
        'paused',
        'failed',
      ]);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(String), ['paused', 'failed']])
      );
      expect(result).toEqual(mockRun);
    });
  });

  describe('reconcileRunProgress', () => {
    it('should reconcile progress within a transaction', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            { pages_fetched: 5, rows_returned: 100, rows_inserted: 80, last_successful_page: 5 },
          ],
        }) // summary
        .mockResolvedValueOnce({ rows: [{ next_cursor: 'cursor123' }] }) // latestCursor
        .mockResolvedValueOnce({ rows: [{ id: 1, pages_fetched: 5 }] }) // update
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await repository.reconcileRunProgress(1);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });
  });

  describe('markRunFailure', () => {
    it('should update run status to failed', async () => {
      const mockRun = { id: 1, status: 'failed' };
      query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.markRunFailure(1, 'error message');

      expect(query).toHaveBeenCalledWith(expect.any(String), [1, 'error message']);
      expect(result).toEqual(mockRun);
    });
  });

  describe('markRunControlStatus', () => {
    it('should update run status to paused', async () => {
      const mockRun = { id: 1, status: 'paused' };
      query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.markRunControlStatus(1, 'paused');

      expect(query).toHaveBeenCalledWith(expect.any(String), [1, 'paused']);
      expect(result).toEqual(mockRun);
    });
  });

  describe('resumeRunState', () => {
    it('should resume a run', async () => {
      const mockRun = { id: 1, status: 'running' };
      query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.resumeRunState(1);

      expect(query).toHaveBeenCalledWith(expect.any(String), [1]);
      expect(result).toEqual(mockRun);
    });
  });

  describe('completeRun', () => {
    it('should complete a run', async () => {
      const mockRun = { id: 1, status: 'completed' };
      query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.completeRun(1, 'finished well');

      expect(query).toHaveBeenCalledWith(expect.any(String), [1, 'finished well']);
      expect(result).toEqual(mockRun);
    });
  });

  describe('getRunOrThrow', () => {
    it('should return run if found', async () => {
      const mockRun = { id: 1 };
      query.mockResolvedValueOnce({ rows: [mockRun] });
      const result = await repository.getRunOrThrow(1);
      expect(result).toEqual(mockRun);
    });

    it('should throw if run not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await expect(repository.getRunOrThrow(1)).rejects.toThrow('WiGLE import run 1 not found');
    });
  });

  describe('getImportRun', () => {
    it('should return serialized run with pages', async () => {
      const mockRun = { id: 1, request_params: {} };
      const mockPages = [{ page_number: 1 }];
      query.mockResolvedValueOnce({ rows: [mockRun] }); // getRunRow
      query.mockResolvedValueOnce({ rows: mockPages }); // getRunPages

      const result = await repository.getImportRun(1);
      expect(result.id).toBe(1);
      expect(result.pages).toHaveLength(1);
    });
  });

  describe('persistPageFailure', () => {
    it('should insert or update page failure', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });
      await repository.persistPageFailure(1, 2, 'cursor', 'error');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.wigle_import_run_pages'),
        [1, 2, 'cursor', 'error']
      );
    });
  });

  describe('listImportRuns', () => {
    it('should list runs with filters', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1, request_params: {} }] });
      const result = await repository.listImportRuns({
        status: 'running',
        state: 'IL',
        searchTerm: 'fbi',
        incompleteOnly: true,
        limit: 10,
      });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining(
          'WHERE status = $1 AND state = $2 AND search_term ILIKE $3 AND status IN'
        ),
        ['running', 'IL', '%fbi%', 10]
      );
      expect(result).toHaveLength(1);
    });

    it('should list runs without filters', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await repository.listImportRuns();
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT *'), [20]);
    });
  });

  describe('getImportCompletenessSummary', () => {
    it('should return completeness summary', async () => {
      query.mockResolvedValueOnce({ rows: [{ state: 'IL', stored_count: 100 }] });
      const result = await repository.getImportCompletenessSummary({
        searchTerm: 'fbi',
        state: 'IL',
      });
      expect(query).toHaveBeenCalledWith(expect.stringContaining('WITH latest_runs AS'), [
        '%fbi%',
        'IL',
      ]);
      expect(result[0].state).toBe('IL');
    });
  });

  describe('getLatestResumableImportRun', () => {
    it('should return null if no run found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await repository.getLatestResumableImportRun({ ssid: 'test' }, ['paused']);
      expect(result).toBeNull();
    });

    it('should return serialized run if found', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // findLatestResumableRun
      query.mockResolvedValueOnce({ rows: [{ id: 1, request_params: {} }] }); // getRunRow
      query.mockResolvedValueOnce({ rows: [] }); // getRunPages
      const result = await repository.getLatestResumableImportRun({ ssid: 'test' }, ['paused']);
      expect(result!.id).toBe(1);
    });
  });

  describe('countRecentCancelledByFingerprint', () => {
    it('should return count of recent cancelled runs', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: 5 }] });
      const result = await repository.countRecentCancelledByFingerprint('fp', 120);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'), ['fp', 120]);
      expect(result).toBe(5);
    });

    it('should handle missing count result', async () => {
      query.mockResolvedValueOnce({ rows: [{}] });
      const result = await repository.countRecentCancelledByFingerprint('fp');
      expect(result).toBe(0);
    });
  });

  describe('findGlobalCancelledClusterIds', () => {
    it('should return IDs of global cancelled runs', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 10 }, { id: 20 }] });
      const result = await repository.findGlobalCancelledClusterIds();
      expect(result).toEqual([10, 20]);
    });
  });

  describe('bulkDeleteCancelledRunsByIds', () => {
    it('should return 0 for empty IDs', async () => {
      const result = await repository.bulkDeleteCancelledRunsByIds([]);
      expect(result).toBe(0);
      expect(query).not.toHaveBeenCalled();
    });

    it('should delete runs and return rowCount', async () => {
      query.mockResolvedValueOnce({ rowCount: 3 });
      const result = await repository.bulkDeleteCancelledRunsByIds([1, 2, 3]);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM'), [[1, 2, 3]]);
      expect(result).toBe(3);
    });
  });
});
