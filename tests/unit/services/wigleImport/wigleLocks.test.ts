import {
  WIGLE_GLOBAL_LOCK_CLASSID,
  WIGLE_GLOBAL_LOCK_OBJID,
  WIGLE_RUN_LOCK_CLASSID,
  acquireGlobalWigleLock,
  acquireRunWigleLock,
  releaseRunWigleLock,
  releaseGlobalWigleLock,
  findActiveWigleRunId,
  transitionRunToRunning,
} from '../../../../server/src/services/wigleImport/wigleLocks';

describe('wigleLocks', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
    };
  });

  describe('constants', () => {
    it('defines distinct lock namespaces and objids', () => {
      expect(WIGLE_GLOBAL_LOCK_CLASSID).toBe(9192000);
      expect(WIGLE_GLOBAL_LOCK_OBJID).toBe(1);
      expect(WIGLE_RUN_LOCK_CLASSID).toBe(9192001);
      expect(WIGLE_GLOBAL_LOCK_CLASSID).not.toBe(WIGLE_RUN_LOCK_CLASSID);
    });
  });

  describe('acquireGlobalWigleLock', () => {
    it('returns true when advisory lock is acquired', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ acquired: true }] });

      const acquired = await acquireGlobalWigleLock(mockClient);

      expect(acquired).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        [9192000, 1]
      );
    });

    it('returns false when advisory lock is denied', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ acquired: false }] });

      const acquired = await acquireGlobalWigleLock(mockClient);

      expect(acquired).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        [9192000, 1]
      );
    });
  });

  describe('acquireRunWigleLock', () => {
    it('returns true when per-run advisory lock is acquired', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ acquired: true }] });

      const acquired = await acquireRunWigleLock(mockClient, 42);

      expect(acquired).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        [9192001, 42]
      );
    });

    it('returns false when per-run advisory lock is denied', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ acquired: false }] });

      const acquired = await acquireRunWigleLock(mockClient, 42);

      expect(acquired).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        [9192001, 42]
      );
    });
  });

  describe('releaseRunWigleLock', () => {
    it('returns true when per-run advisory lock is successfully released', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ released: true }] });

      const released = await releaseRunWigleLock(mockClient, 42);

      expect(released).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock($1, $2) AS released',
        [9192001, 42]
      );
    });

    it('returns false without throwing when query errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('connection terminated'));

      const released = await releaseRunWigleLock(mockClient, 42);

      expect(released).toBe(false);
    });
  });

  describe('releaseGlobalWigleLock', () => {
    it('returns true when global advisory lock is successfully released', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ released: true }] });

      const released = await releaseGlobalWigleLock(mockClient);

      expect(released).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock($1, $2) AS released',
        [9192000, 1]
      );
    });

    it('returns false without throwing when query errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('connection reset'));

      const released = await releaseGlobalWigleLock(mockClient);

      expect(released).toBe(false);
    });
  });

  describe('findActiveWigleRunId', () => {
    it('returns active runId from pg_locks when lock exists', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ active_run_id: 105 }],
      });

      const activeId = await findActiveWigleRunId(mockClient);

      expect(activeId).toBe(105);
      expect(mockClient.query).toHaveBeenCalled();
      const [sql, params] = mockClient.query.mock.calls[0];
      expect(sql).toContain('pg_locks');
      expect(sql).toContain('current_database()');
      expect(params).toEqual([9192001]);
    });

    it('returns null when no active per-run lock exists', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const activeId = await findActiveWigleRunId(mockClient);

      expect(activeId).toBeNull();
    });

    it('returns null if objid is not a finite number', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ active_run_id: 'not-a-number' }],
      });

      const activeId = await findActiveWigleRunId(mockClient);

      expect(activeId).toBeNull();
    });
  });

  describe('transitionRunToRunning', () => {
    it('updates run to running and returns row', async () => {
      const mockRun = { id: 7, status: 'running', updated_at: new Date() };
      mockClient.query.mockResolvedValueOnce({ rows: [mockRun] });

      const run = await transitionRunToRunning(mockClient, 7);

      expect(run).toEqual(mockRun);
      expect(mockClient.query).toHaveBeenCalled();
      const [sql, params] = mockClient.query.mock.calls[0];
      expect(sql).toContain("status = 'running'");
      expect(sql).toContain("status IN ('running', 'paused', 'failed')");
      expect(params).toEqual([7]);
    });

    it('returns null if run does not exist or was cancelled/completed', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const run = await transitionRunToRunning(mockClient, 7);

      expect(run).toBeNull();
    });
  });
});
