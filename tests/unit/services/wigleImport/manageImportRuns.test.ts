import {
  dispatchImportRun,
  dispatchResumeImportRun,
  dispatchResumeLatestImportRun,
  reconcileOrphanRuns,
  startImportRun,
  resumeImportRun,
} from '../../../../server/src/services/wigleImport/use-cases/manageImportRuns';

// Mocks
const mockOrchestratorExecute = jest.fn();

jest.mock('../../../../server/src/services/adminDbService', () => ({
  getLongRunningAdminPool: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/params', () => ({
  validateImportQuery: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/wigleLocks', () => ({
  acquireGlobalWigleLock: jest.fn(),
  acquireRunWigleLock: jest.fn(),
  releaseRunWigleLock: jest.fn(),
  releaseGlobalWigleLock: jest.fn(),
  findActiveWigleRunId: jest.fn(),
  transitionRunToRunning: jest.fn(),
  WIGLE_RUN_LOCK_CLASSID: 9192001,
}));

jest.mock('../../../../server/src/services/wigleImport/runRepository', () => ({
  findLatestResumableRun: jest.fn(),
  getImportRun: jest.fn(),
  getRunOrThrow: jest.fn(),
  markRunControlStatus: jest.fn(),
  markRunFailure: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/runStateManager', () => ({
  cancelRun: jest.fn(),
  findLatestResumable: jest.fn(),
  initializeImportRun: jest.fn(),
  pauseRun: jest.fn(),
  prepareRunForResumption: jest.fn(),
}));

jest.mock(
  '../../../../server/src/services/wigleImport/orchestrators/WigleImportRunOrchestrator',
  () => ({
    WigleImportRunOrchestrator: jest.fn().mockImplementation(() => ({
      execute: (...args: any[]) => mockOrchestratorExecute(...args),
    })),
  })
);

const { getLongRunningAdminPool } = require('../../../../server/src/services/adminDbService');
const { validateImportQuery } = require('../../../../server/src/services/wigleImport/params');
const {
  acquireGlobalWigleLock,
  acquireRunWigleLock,
  releaseRunWigleLock,
  releaseGlobalWigleLock,
  findActiveWigleRunId,
  transitionRunToRunning,
} = require('../../../../server/src/services/wigleImport/wigleLocks');
const {
  findLatestResumableRun,
  getImportRun,
  getRunOrThrow,
  markRunControlStatus,
  markRunFailure,
} = require('../../../../server/src/services/wigleImport/runRepository');
const {
  initializeImportRun,
  findLatestResumable,
} = require('../../../../server/src/services/wigleImport/runStateManager');

describe('manageImportRuns - Asynchronous Dispatch and Orphan Reconciliation', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };

    getLongRunningAdminPool.mockReturnValue(mockPool);
    validateImportQuery.mockReturnValue(null);
    releaseGlobalWigleLock.mockResolvedValue(true);
    releaseRunWigleLock.mockResolvedValue(true);
    markRunFailure.mockResolvedValue(true);
  });

  describe('dispatchImportRun', () => {
    it('throws validation error if query is invalid', async () => {
      validateImportQuery.mockReturnValueOnce('Invalid SSID');

      await expect(dispatchImportRun({ ssid: '' })).rejects.toThrow('Invalid SSID');
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('throws if longRunningAdminPool is null', async () => {
      getLongRunningAdminPool.mockReturnValueOnce(null);

      await expect(dispatchImportRun({ ssid: 'TestNet' })).rejects.toThrow(
        /Long-running admin database pool not initialized/
      );
    });

    it('returns already_running (409-style payload) when global lock is held by another run', async () => {
      acquireGlobalWigleLock.mockResolvedValueOnce(false);
      findActiveWigleRunId.mockResolvedValueOnce(99);
      findLatestResumableRun.mockResolvedValueOnce(null);
      getImportRun.mockResolvedValueOnce({ id: 99, status: 'running' });

      const result = await dispatchImportRun({ ssid: 'NewNet' });

      expect(result).toEqual({
        status: 'already_running',
        activeRunId: 99,
        isSameRun: false,
        run: undefined,
        error: 'Another WiGLE import (run 99) is currently running',
      });
      expect(mockClient.release).toHaveBeenCalledTimes(1);
      expect(initializeImportRun).not.toHaveBeenCalled();
    });

    it('returns already_running with isSameRun: true when global lock is held by identical query run', async () => {
      acquireGlobalWigleLock.mockResolvedValueOnce(false);
      findActiveWigleRunId.mockResolvedValueOnce(55);
      findLatestResumableRun.mockResolvedValueOnce({ id: 55, status: 'running' });
      getImportRun.mockResolvedValueOnce({ id: 55, status: 'running' });

      const result = await dispatchImportRun({ ssid: 'SameNet' });

      expect(result).toEqual({
        status: 'already_running',
        activeRunId: 55,
        isSameRun: true,
        run: { id: 55, status: 'running' },
        error: undefined,
      });
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('acquires global and per-run locks, transitions to running, and dispatches background worker', async () => {
      let resolveWorker!: (val?: any) => void;
      const workerPromise = new Promise((resolve) => {
        resolveWorker = resolve;
      });

      acquireGlobalWigleLock.mockResolvedValueOnce(true);
      initializeImportRun.mockResolvedValueOnce({ id: 101, status: 'running' });
      acquireRunWigleLock.mockResolvedValueOnce(true);
      transitionRunToRunning.mockResolvedValueOnce({ id: 101, status: 'running' });
      getImportRun.mockResolvedValueOnce({ id: 101, status: 'running' });
      mockOrchestratorExecute.mockImplementationOnce(() => workerPromise);

      const result = await dispatchImportRun({ ssid: 'TestNet' });

      expect(result.status).toBe('dispatched');
      if (result.status === 'dispatched') {
        expect(result.run.id).toBe(101);
      }
      expect(acquireGlobalWigleLock).toHaveBeenCalledWith(mockClient);
      expect(acquireRunWigleLock).toHaveBeenCalledWith(mockClient, 101);
      expect(transitionRunToRunning).toHaveBeenCalledWith(mockClient, 101);

      // Verify worker is still running and locks are still held
      expect(releaseRunWigleLock).not.toHaveBeenCalled();
      expect(releaseGlobalWigleLock).not.toHaveBeenCalled();
      expect(mockClient.release).not.toHaveBeenCalled();

      // Resolve the worker and verify locks and client are released
      resolveWorker({ id: 101, status: 'completed' });
      await workerPromise;
      await new Promise(process.nextTick);

      expect(releaseRunWigleLock).toHaveBeenCalledWith(mockClient, 101);
      expect(releaseGlobalWigleLock).toHaveBeenCalledWith(mockClient);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('does not revoke worker locks or double-release client if getImportRun throws after worker spawned', async () => {
      let resolveWorker!: (val?: any) => void;
      const workerPromise = new Promise((resolve) => {
        resolveWorker = resolve;
      });

      acquireGlobalWigleLock.mockResolvedValueOnce(true);
      initializeImportRun.mockResolvedValueOnce({ id: 103, status: 'running' });
      acquireRunWigleLock.mockResolvedValueOnce(true);
      transitionRunToRunning.mockResolvedValueOnce({ id: 103, status: 'running' });
      getImportRun.mockRejectedValueOnce(new Error('Serialization timeout'));
      mockOrchestratorExecute.mockImplementationOnce(() => workerPromise);

      await expect(dispatchImportRun({ ssid: 'CrashNet' })).rejects.toThrow(
        'Serialization timeout'
      );

      // The outer dispatcher must NOT have released the locks or client while worker is running
      expect(releaseRunWigleLock).not.toHaveBeenCalled();
      expect(releaseGlobalWigleLock).not.toHaveBeenCalled();
      expect(mockClient.release).not.toHaveBeenCalled();

      // Background worker completes and cleans up
      resolveWorker({ id: 103, status: 'completed' });
      await workerPromise;
      await new Promise(process.nextTick);

      expect(releaseRunWigleLock).toHaveBeenCalledWith(mockClient, 103);
      expect(releaseGlobalWigleLock).toHaveBeenCalledWith(mockClient);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('cleans up locks and releases client if per-run lock fails', async () => {
      acquireGlobalWigleLock.mockResolvedValueOnce(true);
      initializeImportRun.mockResolvedValueOnce({ id: 102, status: 'running' });
      acquireRunWigleLock.mockResolvedValueOnce(false);

      await expect(dispatchImportRun({ ssid: 'TestNet' })).rejects.toThrow(
        /Failed to acquire per-run lock/
      );

      expect(releaseGlobalWigleLock).toHaveBeenCalledWith(mockClient);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('dispatchResumeImportRun', () => {
    it('throws if runId is invalid', async () => {
      await expect(dispatchResumeImportRun(Number.NaN)).rejects.toThrow('Invalid run id');
    });

    it('throws if run is already completed or cancelled', async () => {
      getRunOrThrow.mockResolvedValueOnce({ id: 10, status: 'completed' });
      await expect(dispatchResumeImportRun(10)).rejects.toThrow(/already completed/);

      getRunOrThrow.mockResolvedValueOnce({ id: 11, status: 'cancelled' });
      await expect(dispatchResumeImportRun(11)).rejects.toThrow(/cancelled/);
    });

    it('throws if attempting to resume a Bluetooth run via WiFi dispatch', async () => {
      getRunOrThrow.mockResolvedValueOnce({ id: 12, status: 'paused', source: 'wigle_bt' });
      await expect(dispatchResumeImportRun(12)).rejects.toThrow(
        /Cannot resume Bluetooth import run via WiFi/
      );
    });

    it('returns already_running with isSameRun: true if this runId is already executing', async () => {
      getRunOrThrow.mockResolvedValueOnce({ id: 20, status: 'running' });
      acquireGlobalWigleLock.mockResolvedValueOnce(false);
      findActiveWigleRunId.mockResolvedValueOnce(20);
      getImportRun.mockResolvedValueOnce({ id: 20, status: 'running' });

      const result = await dispatchResumeImportRun(20);

      expect(result.status).toBe('already_running');
      if (result.status === 'already_running') {
        expect(result.isSameRun).toBe(true);
        expect(result.activeRunId).toBe(20);
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('dispatches resumption when locks acquired', async () => {
      getRunOrThrow.mockResolvedValueOnce({ id: 25, status: 'paused' });
      acquireGlobalWigleLock.mockResolvedValueOnce(true);
      acquireRunWigleLock.mockResolvedValueOnce(true);
      transitionRunToRunning.mockResolvedValueOnce({ id: 25, status: 'running' });
      getImportRun.mockResolvedValueOnce({ id: 25, status: 'running' });
      mockOrchestratorExecute.mockResolvedValueOnce({ id: 25, status: 'completed' });

      const result = await dispatchResumeImportRun(25);

      expect(result.status).toBe('dispatched');
      if (result.status === 'dispatched') {
        expect(result.run.id).toBe(25);
      }
    });
  });

  describe('dispatchResumeLatestImportRun', () => {
    it('calls dispatchResumeImportRun if latest resumable run is found', async () => {
      findLatestResumable.mockResolvedValueOnce({ id: 88 });
      getRunOrThrow.mockResolvedValueOnce({ id: 88, status: 'paused' });
      acquireGlobalWigleLock.mockResolvedValueOnce(true);
      acquireRunWigleLock.mockResolvedValueOnce(true);
      transitionRunToRunning.mockResolvedValueOnce({ id: 88, status: 'running' });
      getImportRun.mockResolvedValueOnce({ id: 88, status: 'running' });

      const result = await dispatchResumeLatestImportRun({ ssid: 'ResNet' });

      expect(result.status).toBe('dispatched');
      if (result.status === 'dispatched') {
        expect(result.run.id).toBe(88);
      }
    });

    it('calls dispatchImportRun if no latest resumable run is found', async () => {
      findLatestResumable.mockResolvedValueOnce(null);
      acquireGlobalWigleLock.mockResolvedValueOnce(true);
      initializeImportRun.mockResolvedValueOnce({ id: 89, status: 'running' });
      acquireRunWigleLock.mockResolvedValueOnce(true);
      transitionRunToRunning.mockResolvedValueOnce({ id: 89, status: 'running' });
      getImportRun.mockResolvedValueOnce({ id: 89, status: 'running' });

      const result = await dispatchResumeLatestImportRun({ ssid: 'NewNet' });

      expect(result.status).toBe('dispatched');
      if (result.status === 'dispatched') {
        expect(result.run.id).toBe(89);
      }
    });

    it('delegates to dispatchResumeImportRun which rejects if latest run is already completed', async () => {
      findLatestResumable.mockResolvedValueOnce({ id: 91 });
      getRunOrThrow.mockResolvedValueOnce({ id: 91, status: 'completed' });

      await expect(dispatchResumeLatestImportRun({ ssid: 'FallbackNet' })).rejects.toThrow(
        'Cannot resume an import run that is already completed'
      );
    });
  });

  describe('startImportRun fail-closed locking', () => {
    it('throws if longRunningAdminPool is unavailable', async () => {
      getLongRunningAdminPool.mockReturnValueOnce(null);
      await expect(startImportRun({ ssid: 'FailClosedNet' })).rejects.toThrow(
        /Long-running admin database pool not initialized/
      );
    });
  });

  describe('resumeImportRun fail-closed locking', () => {
    it('throws if longRunningAdminPool is unavailable', async () => {
      getRunOrThrow.mockResolvedValueOnce({ id: 95, status: 'paused', source: 'wigle' });
      getLongRunningAdminPool.mockReturnValueOnce(null);
      await expect(resumeImportRun(95)).rejects.toThrow(
        /Long-running admin database pool not initialized/
      );
    });
  });

  describe('reconcileOrphanRuns', () => {
    it('aborts with ZERO mutating updates when global lock cannot be acquired', async () => {
      acquireGlobalWigleLock.mockResolvedValueOnce(false);
      findActiveWigleRunId.mockResolvedValueOnce(42);

      const result = await reconcileOrphanRuns();

      expect(result).toEqual({
        reconciledCount: 0,
        reconciledIds: [],
        status: 'skipped_active',
        activeRunId: 42,
      });

      // Crucial test assertion: ZERO mutating queries executed
      expect(mockClient.query).not.toHaveBeenCalled();
      expect(releaseGlobalWigleLock).not.toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('pauses dead orphaned runs when global lock is successfully acquired', async () => {
      acquireGlobalWigleLock.mockResolvedValueOnce(true);
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 301 }, { id: 302 }],
      });

      const result = await reconcileOrphanRuns();

      expect(result).toEqual({
        reconciledCount: 2,
        reconciledIds: [301, 302],
        status: 'reconciled',
      });

      expect(mockClient.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockClient.query.mock.calls[0];
      expect(sql).toContain('UPDATE app.wigle_import_runs');
      expect(sql).toContain("SET status = 'paused'");
      expect(sql).toContain("WHERE status = 'running'");
      expect(sql).toContain('AND NOT EXISTS');
      expect(params).toEqual([9192001]);

      // Lock must be released and client released in finally
      expect(releaseGlobalWigleLock).toHaveBeenCalledWith(mockClient);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('returns 0 reconciled when pool is null', async () => {
      getLongRunningAdminPool.mockReturnValueOnce(null);

      const result = await reconcileOrphanRuns();

      expect(result).toEqual({
        reconciledCount: 0,
        reconciledIds: [],
        status: 'skipped_active',
      });
    });

    it('reconciles orphan runs on existing client without releasing client or global lock', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 501 }] });
      const result = await reconcileOrphanRuns(mockClient);

      expect(result.reconciledCount).toBe(1);
      expect(result.reconciledIds).toEqual([501]);
      expect(releaseGlobalWigleLock).not.toHaveBeenCalled();
      expect(mockClient.release).not.toHaveBeenCalled();
    });
  });

  describe('executeImportWithLocks background failure handling', () => {
    it('marks run as paused on 429 rate limit error', async () => {
      acquireGlobalWigleLock.mockResolvedValueOnce(true);
      initializeImportRun.mockResolvedValueOnce({ id: 200, status: 'running' });
      acquireRunWigleLock.mockResolvedValueOnce(true);
      transitionRunToRunning.mockResolvedValueOnce({ id: 200, status: 'running' });
      getImportRun.mockResolvedValueOnce({ id: 200, status: 'running' });

      const rateLimitErr = Object.assign(new Error('Rate limited'), { status: 429 });
      mockOrchestratorExecute.mockRejectedValueOnce(rateLimitErr);

      await dispatchImportRun({ ssid: 'RateNet' });

      // Wait for background worker promise chain to settle
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(markRunControlStatus).toHaveBeenCalledWith(200, 'paused');
      expect(releaseRunWigleLock).toHaveBeenCalledWith(mockClient, 200);
      expect(releaseGlobalWigleLock).toHaveBeenCalledWith(mockClient);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('marks run as failed on unexpected error', async () => {
      acquireGlobalWigleLock.mockResolvedValueOnce(true);
      initializeImportRun.mockResolvedValueOnce({ id: 201, status: 'running' });
      acquireRunWigleLock.mockResolvedValueOnce(true);
      transitionRunToRunning.mockResolvedValueOnce({ id: 201, status: 'running' });
      getImportRun.mockResolvedValueOnce({ id: 201, status: 'running' });

      const genericErr = new Error('Network crash');
      mockOrchestratorExecute.mockRejectedValueOnce(genericErr);

      await dispatchImportRun({ ssid: 'FailNet' });

      // Wait for background worker promise chain to settle
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(markRunFailure).toHaveBeenCalledWith(201, 'Network crash');
      expect(releaseRunWigleLock).toHaveBeenCalledWith(mockClient, 201);
      expect(releaseGlobalWigleLock).toHaveBeenCalledWith(mockClient);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
