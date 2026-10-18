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

jest.mock('../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

const { query, pool } = require('../../server/src/config/database');
const { adminQuery } = require('../../server/src/services/adminDbService');

describe('wigleImportRunRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createImportRun', () => {
    it('should insert a new run and return the result', async () => {
      const mockRun = { id: 1, status: 'running' };
      adminQuery.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.createImportRun({ ssid: 'test-ssid' });

      expect(adminQuery).toHaveBeenCalledWith(
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
      adminQuery.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.markRunFailure(1, 'error message');

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [1, 'error message']);
      expect(result).toEqual(mockRun);
    });
  });

  describe('markRunControlStatus', () => {
    it('should update run status to paused', async () => {
      const mockRun = { id: 1, status: 'paused' };
      adminQuery.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.markRunControlStatus(1, 'paused');

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [1, 'paused']);
      expect(result).toEqual(mockRun);
    });

    it('should update run status and last_error when errorMessage is provided', async () => {
      const mockRun = { id: 1, status: 'paused', last_error: 'transient timeout' };
      adminQuery.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.markRunControlStatus(1, 'paused', 'transient timeout');

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [
        1,
        'paused',
        'transient timeout',
      ]);
      expect(result).toEqual(mockRun);
    });
  });

  describe('resumeRunState', () => {
    it('should resume a run', async () => {
      const mockRun = { id: 1, status: 'running' };
      adminQuery.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.resumeRunState(1);

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [1]);
      expect(result).toEqual(mockRun);
    });
  });

  describe('completeRun', () => {
    it('should complete a run', async () => {
      const mockRun = { id: 1, status: 'completed' };
      adminQuery.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.completeRun(1, 'finished well');

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [1, 'finished well']);
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
      adminQuery.mockResolvedValueOnce({ rowCount: 1 });
      await repository.persistPageFailure(1, 2, 'cursor', 'error');
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.wigle_import_run_pages'),
        [1, 2, 'cursor', 'error']
      );
    });
  });

  describe('listImportRuns', () => {
    it('should list runs with filters', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1, request_params: {} }] });
      query.mockResolvedValueOnce({ rows: [{ total: 1 }] });
      const result = await repository.listImportRuns({
        status: 'running',
        state: 'IL',
        searchTerm: 'fbi',
        incompleteOnly: true,
        limit: 10,
      });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 1);
    });

    it('should list runs without filters', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
      const result = await repository.listImportRuns();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 0);
    });

    // Pagination tests
    it('should return correct offset/limit in response', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 100 }] });

      const result = await repository.listImportRuns({ limit: 25, offset: 50 });

      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50);
    });

    it('should apply LIMIT and OFFSET in SQL query', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 100 }] });

      await repository.listImportRuns({ limit: 20, offset: 40 });

      const dataCall = query.mock.calls[0];
      expect(dataCall[1]).toContain(20); // LIMIT
      expect(dataCall[1]).toContain(40); // OFFSET
    });

    it('should default to limit=20, offset=0', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 50 }] });

      const result = await repository.listImportRuns();

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should return total count from COUNT query', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 42 }] });

      const result = await repository.listImportRuns();

      expect(result.total).toBe(42);
    });

    it('should handle zero total count', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ total: 0 }] });

      const result = await repository.listImportRuns();

      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
    });

    // Sorting tests
    it('should use started_at DESC as default sort', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

      await repository.listImportRuns();

      const dataCall = query.mock.calls[0];
      expect(dataCall[0]).toContain('ORDER BY started_at DESC');
    });

    it('should accept single sort key', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

      await repository.listImportRuns({ sortBy: 'status' });

      const dataCall = query.mock.calls[0];
      expect(dataCall[0]).toContain('status ASC'); // defaults to ASC
    });

    it('should apply specified sort direction', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

      await repository.listImportRuns({ sortBy: 'status', sortDir: 'desc' });

      const dataCall = query.mock.calls[0];
      expect(dataCall[0]).toContain('status DESC');
    });

    it('should accept multiple sort keys with matching directions', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

      await repository.listImportRuns({ sortBy: 'status,started_at', sortDir: 'asc,desc' });

      const dataCall = query.mock.calls[0];
      expect(dataCall[0]).toContain('status ASC, started_at DESC');
    });

    it('should reject invalid sort keys (SQL injection prevention)', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

      await repository.listImportRuns({ sortBy: 'invalid_column; DROP TABLE' });

      const dataCall = query.mock.calls[0];
      // Invalid key should be filtered out, using default
      expect(dataCall[0]).toContain('ORDER BY started_at DESC');
    });

    it('should allow all keys in SORT_ALLOWLIST', async () => {
      const allowlistKeys = [
        'started_at',
        'updated_at',
        'completed_at',
        'status',
        'state',
        'search_term',
        'rows_inserted',
        'rows_returned',
        'pages_fetched',
        'total_pages',
        'source',
      ];

      for (const key of allowlistKeys) {
        query.mockClear();
        query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

        await repository.listImportRuns({ sortBy: key });

        const dataCall = query.mock.calls[0];
        expect(dataCall[0]).toContain(`${key} ASC`);
      }
    });

    it('should revert to default sort when all keys are invalid', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

      await repository.listImportRuns({ sortBy: 'malicious1,malicious2' });

      const dataCall = query.mock.calls[0];
      expect(dataCall[0]).toContain('ORDER BY started_at DESC');
    });

    it('should execute two queries (data + count)', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

      await repository.listImportRuns();

      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getImportCompletenessSummary', () => {
    it('should return completeness summary', async () => {
      query.mockResolvedValueOnce({
        rows: [{ state: 'IL', local_rows: 105, local_unique_bssids: 100 }],
      });
      const result = await repository.getImportCompletenessSummary({
        searchTerm: 'fbi',
        state: 'IL',
      });
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('WITH latest_runs AS');
      expect(sql).toContain("source IN ('wigle', 'wigle_v2', 'v3_batch', 'v3_manual')");
      expect(sql).toContain('LOWER(search_term) = LOWER($1)');
      expect(sql).toContain('ssid ILIKE $1');
      expect(sql).toContain('COUNT(*)::integer AS local_rows');
      expect(sql).toContain('COUNT(DISTINCT bssid)::integer AS local_unique_bssids');
      expect(sql).toContain('FROM app.wigle_ledger_events e');
      expect(sql).toContain("LOWER(e.query_params->>'ssidlike') = LOWER($1)");
      expect(sql).toContain("TRIM(UPPER(e.query_params->>'region')) = $2");
      expect(params).toEqual(['fbi', 'IL']);
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
      expect(adminQuery).not.toHaveBeenCalled();
    });

    it('should delete runs and return rowCount', async () => {
      adminQuery.mockResolvedValueOnce({ rowCount: 3 });
      const result = await repository.bulkDeleteCancelledRunsByIds([1, 2, 3]);
      expect(adminQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM'), [[1, 2, 3]]);
      expect(result).toBe(3);
    });
  });

  describe('deleteImportRun', () => {
    it('should return true when a deletable run is found and deleted', async () => {
      adminQuery.mockResolvedValueOnce({ rowCount: 1 });
      const result = await repository.deleteImportRun(42);
      expect(result).toBe(true);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('completed', 'cancelled', 'failed')"),
        [42]
      );
    });

    it('should return false when run does not exist or is not in a deletable status', async () => {
      adminQuery.mockResolvedValueOnce({ rowCount: 0 });
      const result = await repository.deleteImportRun(99);
      expect(result).toBe(false);
    });

    it('should return false when rowCount is null', async () => {
      adminQuery.mockResolvedValueOnce({ rowCount: null });
      const result = await repository.deleteImportRun(7);
      expect(result).toBe(false);
    });

    it('should pass the run id as a parameter', async () => {
      adminQuery.mockResolvedValueOnce({ rowCount: 1 });
      await repository.deleteImportRun(123);
      const [, params] = adminQuery.mock.calls[0];
      expect(params).toEqual([123]);
    });
  });
});
