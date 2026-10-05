import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  startBluetoothImportRun,
  resumeBluetoothImportRun,
  dispatchBluetoothImportRun,
  dispatchResumeBluetoothImportRun,
} from '../../../../server/src/services/wigleImport/wigleBluetoothImportService';

// Mock dependencies
const runRepository = require('../../../../server/src/services/wigleImport/runRepository');
const btParams = require('../../../../server/src/services/wigleImport/btParams');
const btPageProcessor = require('../../../../server/src/services/wigleImport/btPageProcessor');
const authProvider = require('../../../../server/src/services/wigleImport/authProvider');
const rateLimitingStrategy = require('../../../../server/src/services/wigleImport/rateLimitingStrategy');
const btApiClient = require('../../../../server/src/services/wigleImport/btApiClient');
const adminDbService = require('../../../../server/src/services/adminDbService');
const wigleLocks = require('../../../../server/src/services/wigleImport/wigleLocks');

jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../../server/src/services/adminDbService', () => ({
  getLongRunningAdminPool: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/wigleLocks', () => ({
  acquireGlobalWigleLock: jest.fn(),
  acquireRunWigleLock: jest.fn(),
  releaseRunWigleLock: jest.fn(),
  releaseGlobalWigleLock: jest.fn(),
  findActiveWigleRunId: jest.fn(),
  transitionRunToRunning: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/runRepository', () => ({
  completeRun: jest.fn(),
  createImportRun: jest.fn(),
  findRunByRawFingerprint: jest.fn(),
  getImportRun: jest.fn(),
  getRunOrThrow: jest.fn(),
  markRunControlStatus: jest.fn(),
  markRunFailure: jest.fn(),
  persistPageFailure: jest.fn(),
  reconcileRunProgress: jest.fn(),
  resumeRunState: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/btParams', () => ({
  normalizeBtImportParams: jest.fn(),
  validateBtImportQuery: jest.fn(),
  getBtSearchTerm: jest.fn(),
  getBtRequestFingerprint: jest.fn(),
  DEFAULT_BT_RESULTS_PER_PAGE: 100,
}));

jest.mock('../../../../server/src/services/wigleImport/btPageProcessor', () => ({
  processSuccessfulBtPage: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/authProvider', () => ({
  getEncodedWigleAuth: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/rateLimitingStrategy', () => ({
  getAdaptiveDelay: jest.fn(),
  sleep: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/btApiClient', () => ({
  fetchBtPage: jest.fn(),
}));

describe('wigleBluetoothImportService', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: (jest.fn() as any).mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    mockPool = {
      connect: (jest.fn() as any).mockResolvedValue(mockClient),
    };
    (adminDbService.getLongRunningAdminPool as any).mockReturnValue(mockPool);
    (wigleLocks.acquireGlobalWigleLock as any).mockResolvedValue(true);
    (wigleLocks.acquireRunWigleLock as any).mockResolvedValue(true);
    (wigleLocks.transitionRunToRunning as any).mockImplementation((_client: any, runId: number) =>
      Promise.resolve({ id: runId, status: 'running' })
    );
    (wigleLocks.releaseGlobalWigleLock as any).mockResolvedValue(true);
    (wigleLocks.releaseRunWigleLock as any).mockResolvedValue(true);
  });

  describe('startBluetoothImportRun', () => {
    it('throws an error if validateBtImportQuery returns an error message', async () => {
      (btParams.validateBtImportQuery as any).mockReturnValueOnce('Invalid query parameter');
      await expect(startBluetoothImportRun({})).rejects.toThrow('Invalid query parameter');
    });

    it('resumes an existing matching run if found', async () => {
      (btParams.validateBtImportQuery as any).mockReturnValueOnce(null);
      (btParams.normalizeBtImportParams as any).mockReturnValue({ term: 'test' });
      (btParams.getBtRequestFingerprint as any).mockReturnValueOnce('fingerprint-123');
      (runRepository.findRunByRawFingerprint as any).mockResolvedValueOnce({
        id: 42,
        status: 'paused',
      });
      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 42,
        status: 'completed',
      });
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 42, status: 'completed' });

      const result = await startBluetoothImportRun({});
      expect(result).toEqual({ id: 42, status: 'completed' });
      expect(wigleLocks.transitionRunToRunning).toHaveBeenCalledWith(mockClient, 42);
    });

    it('creates and executes a new run if no resumable run exists', async () => {
      (btParams.validateBtImportQuery as any).mockReturnValueOnce(null);
      (btParams.normalizeBtImportParams as any).mockReturnValue({ term: 'test' });
      (btParams.getBtRequestFingerprint as any).mockReturnValueOnce('fingerprint-123');
      (runRepository.findRunByRawFingerprint as any).mockResolvedValueOnce(null);
      (runRepository.createImportRun as any).mockResolvedValueOnce({ id: 99, search_term: 'test' });
      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 99,
        status: 'completed',
      });
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 99, status: 'completed' });

      const result = await startBluetoothImportRun({});
      expect(result).toEqual({ id: 99, status: 'completed' });
      expect(runRepository.createImportRun).toHaveBeenCalled();
    });

    it('throws error if long running admin pool is unavailable', async () => {
      (btParams.validateBtImportQuery as any).mockReturnValueOnce(null);
      (adminDbService.getLongRunningAdminPool as any).mockReturnValueOnce(null);
      await expect(startBluetoothImportRun({})).rejects.toThrow(
        /Long-running admin database pool not initialized/
      );
    });
  });

  describe('resumeBluetoothImportRun', () => {
    it('throws error if long running admin pool is unavailable', async () => {
      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({
        id: 110,
        status: 'paused',
        source: 'wigle_bt',
      });
      (adminDbService.getLongRunningAdminPool as any).mockReturnValueOnce(null);
      await expect(resumeBluetoothImportRun(110)).rejects.toThrow(
        /Long-running admin database pool not initialized/
      );
    });

    it('returns the import run directly if already completed', async () => {
      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({ id: 10, status: 'completed' });
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 10, status: 'completed' });

      const result = await resumeBluetoothImportRun(10);
      expect(result).toEqual({ id: 10, status: 'completed' });
      expect(runRepository.resumeRunState).not.toHaveBeenCalled();
    });

    it('throws error if run is cancelled', async () => {
      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({ id: 11, status: 'cancelled' });
      await expect(resumeBluetoothImportRun(11)).rejects.toThrow(
        'Cannot resume a cancelled import run'
      );
    });

    it('resumes and runs loop for other resumable statuses', async () => {
      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({ id: 12, status: 'paused' });
      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 12,
        status: 'completed',
      });
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 12, status: 'completed' });

      const result = await resumeBluetoothImportRun(12);
      expect(result).toEqual({ id: 12, status: 'completed' });
      expect(wigleLocks.transitionRunToRunning).toHaveBeenCalledWith(mockClient, 12);
    });
  });

  describe('executeBluetoothImportLoop coordination', () => {
    it('terminates immediately if status is completed or cancelled', async () => {
      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({ id: 13, status: 'paused' });
      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 13,
        status: 'completed',
      });
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 13, status: 'completed' });

      await resumeBluetoothImportRun(13);
      expect(runRepository.getRunOrThrow).toHaveBeenCalledTimes(1);
    });

    it('exits iteration loop if status changes to paused or cancelled', async () => {
      (runRepository.getRunOrThrow as any)
        .mockResolvedValueOnce({ id: 14, status: 'paused' })
        .mockResolvedValueOnce({ id: 14, status: 'running', next_page: 1, api_cursor: null })
        .mockResolvedValueOnce({ id: 14, status: 'paused' });

      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 14,
        status: 'running',
        next_page: 1,
        api_cursor: null,
      });
      (btParams.normalizeBtImportParams as any).mockReturnValue({});
      (authProvider.getEncodedWigleAuth as any).mockReturnValue('basic-auth');

      (btApiClient.fetchBtPage as any).mockResolvedValueOnce({
        results: [{ bssid: 'AA' }],
        totalResults: 100,
        search_after: 'cursor2',
      });
      (btPageProcessor.processSuccessfulBtPage as any).mockResolvedValueOnce({
        id: 14,
        status: 'running',
        next_page: 2,
        api_cursor: 'cursor2',
      });
      (rateLimitingStrategy.getAdaptiveDelay as any).mockReturnValue(100);

      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 14, status: 'paused' });

      const result = await resumeBluetoothImportRun(14);
      expect(result.status).toBe('paused');
      expect(btApiClient.fetchBtPage).toHaveBeenCalledTimes(1);
    });

    it('halts pipeline and marks failure on 401/403 auth error', async () => {
      (runRepository.getRunOrThrow as any)
        .mockResolvedValueOnce({ id: 15, status: 'paused' })
        .mockResolvedValueOnce({ id: 15, status: 'running', next_page: 1, api_cursor: null });

      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 15,
        status: 'running',
        next_page: 1,
        api_cursor: null,
      });
      (btParams.normalizeBtImportParams as any).mockReturnValue({});
      (authProvider.getEncodedWigleAuth as any).mockReturnValue('basic-auth');

      const authError = new Error('Auth Error') as any;
      authError.status = 401;
      (btApiClient.fetchBtPage as any).mockRejectedValueOnce(authError);
      (runRepository.markRunFailure as any).mockResolvedValueOnce({ id: 15 });

      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 15, status: 'failed' });

      await resumeBluetoothImportRun(15);
      expect(runRepository.persistPageFailure).toHaveBeenCalledWith(15, 1, null, 'Auth Error');
      expect(runRepository.markRunFailure).toHaveBeenCalledWith(15, 'Auth Error');
    });

    it('handles 429 rate limit with successful retry', async () => {
      (runRepository.getRunOrThrow as any)
        .mockResolvedValueOnce({ id: 16, status: 'paused' })
        .mockResolvedValueOnce({ id: 16, status: 'running', next_page: 1, api_cursor: null })
        .mockResolvedValueOnce({ id: 16, status: 'paused' });

      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 16,
        status: 'running',
        next_page: 1,
        api_cursor: null,
      });
      (btParams.normalizeBtImportParams as any).mockReturnValue({});
      (authProvider.getEncodedWigleAuth as any).mockReturnValue('basic-auth');

      const limitError = new Error('Rate Limit') as any;
      limitError.status = 429;
      limitError.retryAfter = '30';

      (btApiClient.fetchBtPage as any).mockRejectedValueOnce(limitError).mockResolvedValueOnce({
        results: [{ bssid: 'BB' }],
        totalResults: 100,
        search_after: 'cursor2',
      });

      (btPageProcessor.processSuccessfulBtPage as any).mockResolvedValueOnce({
        id: 16,
        status: 'running',
        next_page: 2,
        api_cursor: 'cursor2',
      });

      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 16, status: 'running' });

      await resumeBluetoothImportRun(16);
      expect(rateLimitingStrategy.sleep).toHaveBeenCalled();
      expect(btApiClient.fetchBtPage).toHaveBeenCalledTimes(2);
    });

    it('halts and pauses run if 429 occurs again after retry', async () => {
      (runRepository.getRunOrThrow as any)
        .mockResolvedValueOnce({ id: 17, status: 'paused' })
        .mockResolvedValueOnce({ id: 17, status: 'running', next_page: 1, api_cursor: null });

      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 17,
        status: 'running',
        next_page: 1,
        api_cursor: null,
      });
      (btParams.normalizeBtImportParams as any).mockReturnValue({});
      (authProvider.getEncodedWigleAuth as any).mockReturnValue('basic-auth');

      const limitError = new Error('Rate Limit') as any;
      limitError.status = 429;
      limitError.retryAfter = '10';

      (btApiClient.fetchBtPage as any)
        .mockRejectedValueOnce(limitError)
        .mockRejectedValueOnce(limitError);
      (runRepository.markRunControlStatus as any).mockResolvedValueOnce({ id: 17 });

      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 17, status: 'paused' });

      await resumeBluetoothImportRun(17);
      expect(runRepository.persistPageFailure).toHaveBeenCalledWith(17, 1, null, 'Rate Limit');
      expect(runRepository.markRunControlStatus).toHaveBeenCalledWith(17, 'paused');
    });

    it('completes the run immediately if no records are returned on the first page', async () => {
      (runRepository.getRunOrThrow as any)
        .mockResolvedValueOnce({ id: 18, status: 'paused' })
        .mockResolvedValueOnce({ id: 18, status: 'running', next_page: 1, api_cursor: null });

      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 18,
        status: 'running',
        next_page: 1,
        api_cursor: null,
      });
      (btParams.normalizeBtImportParams as any).mockReturnValue({});
      (authProvider.getEncodedWigleAuth as any).mockReturnValue('basic-auth');

      (btApiClient.fetchBtPage as any).mockResolvedValueOnce({
        results: [],
        search_after: null,
      });

      (runRepository.completeRun as any).mockResolvedValueOnce({ id: 18, status: 'completed' });
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 18, status: 'completed' });

      const result = await resumeBluetoothImportRun(18);
      expect(result.status).toBe('completed');
      expect(runRepository.completeRun).toHaveBeenCalledWith(18, expect.any(String));
    });

    it('returns immediately if page results mark run complete', async () => {
      (runRepository.getRunOrThrow as any)
        .mockResolvedValueOnce({ id: 19, status: 'paused' })
        .mockResolvedValueOnce({ id: 19, status: 'running', next_page: 1, api_cursor: null });

      (runRepository.reconcileRunProgress as any).mockResolvedValueOnce({
        id: 19,
        status: 'running',
        next_page: 1,
        api_cursor: null,
      });
      (btParams.normalizeBtImportParams as any).mockReturnValue({ resultsPerPage: 100 });
      (authProvider.getEncodedWigleAuth as any).mockReturnValue('basic-auth');

      (btApiClient.fetchBtPage as any).mockResolvedValueOnce({
        results: [{ bssid: 'CC' }],
        totalResults: 1,
        search_after: null,
      });

      (btPageProcessor.processSuccessfulBtPage as any).mockResolvedValueOnce({
        id: 19,
        status: 'completed',
      });

      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 19, status: 'completed' });

      const result = await resumeBluetoothImportRun(19);
      expect(result.status).toBe('completed');
      expect(btPageProcessor.processSuccessfulBtPage).toHaveBeenCalledWith(
        19,
        1,
        null,
        null,
        [{ bssid: 'CC' }],
        1,
        100,
        true
      );
    });
  });

  describe('dispatchBluetoothImportRun', () => {
    let mockClient: any;
    let mockPool: any;

    beforeEach(() => {
      mockClient = {
        query: (jest.fn() as any).mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      mockPool = {
        connect: (jest.fn() as any).mockResolvedValue(mockClient),
      };
      (adminDbService.getLongRunningAdminPool as any).mockReturnValue(mockPool);
      (wigleLocks.releaseGlobalWigleLock as any).mockResolvedValue(true);
      (wigleLocks.releaseRunWigleLock as any).mockResolvedValue(true);
    });

    it('rejects if query validation fails', async () => {
      (btParams.validateBtImportQuery as any).mockReturnValueOnce('Invalid BT query');
      await expect(dispatchBluetoothImportRun({})).rejects.toThrow('Invalid BT query');
    });

    it('throws if long running pool unavailable', async () => {
      (btParams.validateBtImportQuery as any).mockReturnValueOnce(null);
      (adminDbService.getLongRunningAdminPool as any).mockReturnValueOnce(null);
      await expect(dispatchBluetoothImportRun({})).rejects.toThrow(
        /Long-running admin database pool not initialized/
      );
    });

    it('returns already_running if global lock is unavailable', async () => {
      (btParams.validateBtImportQuery as any).mockReturnValueOnce(null);
      (btParams.normalizeBtImportParams as any).mockReturnValueOnce({ term: 'bt' });
      (btParams.getBtRequestFingerprint as any).mockReturnValueOnce('fp-99');
      (wigleLocks.acquireGlobalWigleLock as any).mockResolvedValueOnce(false);
      (wigleLocks.findActiveWigleRunId as any).mockResolvedValueOnce(88);
      (runRepository.findRunByRawFingerprint as any).mockResolvedValueOnce({
        id: 88,
        status: 'running',
      });
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 88, status: 'running' });

      const result = await dispatchBluetoothImportRun({});
      expect(result.status).toBe('already_running');
      if (result.status === 'already_running') {
        expect(result.isSameRun).toBe(true);
        expect(result.activeRunId).toBe(88);
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('acquires locks and dispatches new BT import run', async () => {
      (btParams.validateBtImportQuery as any).mockReturnValueOnce(null);
      (btParams.normalizeBtImportParams as any).mockReturnValueOnce({ term: 'bt' });
      (btParams.getBtRequestFingerprint as any).mockReturnValueOnce('fp-99');
      (wigleLocks.acquireGlobalWigleLock as any).mockResolvedValueOnce(true);
      (runRepository.findRunByRawFingerprint as any).mockResolvedValueOnce(null);
      (runRepository.createImportRun as any).mockResolvedValueOnce({ id: 60, status: 'running' });
      (wigleLocks.acquireRunWigleLock as any).mockResolvedValueOnce(true);
      (wigleLocks.transitionRunToRunning as any).mockResolvedValueOnce({
        id: 60,
        status: 'running',
      });
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 60, status: 'running' });

      const result = await dispatchBluetoothImportRun({});
      expect(result.status).toBe('dispatched');
      if (result.status === 'dispatched') {
        expect(result.run.id).toBe(60);
      }
      expect(wigleLocks.acquireGlobalWigleLock).toHaveBeenCalledWith(mockClient);
      expect(wigleLocks.acquireRunWigleLock).toHaveBeenCalledWith(mockClient, 60);
    });

    it('does not revoke locks or double release client if getImportRun throws after worker spawned', async () => {
      let resolveWorker!: (val?: any) => void;
      const workerPromise = new Promise((resolve) => {
        resolveWorker = resolve;
      });

      (btParams.validateBtImportQuery as any).mockReturnValueOnce(null);
      (btParams.normalizeBtImportParams as any).mockReturnValueOnce({ term: 'bt' });
      (btParams.getBtRequestFingerprint as any).mockReturnValueOnce('fp-100');
      (wigleLocks.acquireGlobalWigleLock as any).mockResolvedValueOnce(true);
      (runRepository.findRunByRawFingerprint as any).mockResolvedValueOnce(null);
      (runRepository.createImportRun as any).mockResolvedValueOnce({ id: 65, status: 'running' });
      (wigleLocks.acquireRunWigleLock as any).mockResolvedValueOnce(true);
      (wigleLocks.transitionRunToRunning as any).mockResolvedValueOnce({
        id: 65,
        status: 'running',
      });
      (runRepository.getImportRun as any).mockRejectedValueOnce(new Error('Serialization timeout'));
      (runRepository.reconcileRunProgress as any).mockImplementationOnce(() => workerPromise);

      await expect(dispatchBluetoothImportRun({})).rejects.toThrow('Serialization timeout');

      // The outer dispatcher must NOT have released the locks or client while worker is running
      expect(wigleLocks.releaseRunWigleLock).not.toHaveBeenCalled();
      expect(wigleLocks.releaseGlobalWigleLock).not.toHaveBeenCalled();
      expect(mockClient.release).not.toHaveBeenCalled();

      // Background worker completes and cleans up
      resolveWorker({ id: 65, status: 'completed' });
      await workerPromise;
      await new Promise(process.nextTick);

      expect(wigleLocks.releaseRunWigleLock).toHaveBeenCalledWith(mockClient, 65);
      expect(wigleLocks.releaseGlobalWigleLock).toHaveBeenCalledWith(mockClient);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispatchResumeBluetoothImportRun', () => {
    let mockClient: any;
    let mockPool: any;

    beforeEach(() => {
      mockClient = {
        query: (jest.fn() as any).mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      mockPool = {
        connect: (jest.fn() as any).mockResolvedValue(mockClient),
      };
      (adminDbService.getLongRunningAdminPool as any).mockReturnValue(mockPool);
      (wigleLocks.releaseGlobalWigleLock as any).mockResolvedValue(true);
      (wigleLocks.releaseRunWigleLock as any).mockResolvedValue(true);
    });

    it('rejects invalid runId or completed/cancelled run', async () => {
      await expect(dispatchResumeBluetoothImportRun(Number.NaN)).rejects.toThrow('Invalid run id');

      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({ id: 50, status: 'completed' });
      await expect(dispatchResumeBluetoothImportRun(50)).rejects.toThrow(/already completed/);

      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({ id: 51, status: 'cancelled' });
      await expect(dispatchResumeBluetoothImportRun(51)).rejects.toThrow(/cancelled/);
    });

    it('throws if attempting to resume a WiFi run via Bluetooth dispatch', async () => {
      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({
        id: 54,
        status: 'paused',
        source: 'wigle',
      });
      await expect(dispatchResumeBluetoothImportRun(54)).rejects.toThrow(
        /Cannot resume non-Bluetooth import run via Bluetooth service/
      );
    });

    it('returns already_running when global lock held', async () => {
      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({ id: 52, status: 'running' });
      (wigleLocks.acquireGlobalWigleLock as any).mockResolvedValueOnce(false);
      (wigleLocks.findActiveWigleRunId as any).mockResolvedValueOnce(52);
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 52, status: 'running' });

      const result = await dispatchResumeBluetoothImportRun(52);
      expect(result.status).toBe('already_running');
      if (result.status === 'already_running') {
        expect(result.isSameRun).toBe(true);
        expect(result.activeRunId).toBe(52);
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('dispatches resumption when locks acquired', async () => {
      (runRepository.getRunOrThrow as any).mockResolvedValueOnce({ id: 53, status: 'paused' });
      (wigleLocks.acquireGlobalWigleLock as any).mockResolvedValueOnce(true);
      (wigleLocks.acquireRunWigleLock as any).mockResolvedValueOnce(true);
      (wigleLocks.transitionRunToRunning as any).mockResolvedValueOnce({
        id: 53,
        status: 'running',
      });
      (runRepository.getImportRun as any).mockResolvedValueOnce({ id: 53, status: 'running' });

      const result = await dispatchResumeBluetoothImportRun(53);
      expect(result.status).toBe('dispatched');
      if (result.status === 'dispatched') {
        expect(result.run.id).toBe(53);
      }
    });
  });
});
