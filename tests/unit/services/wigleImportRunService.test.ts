import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { dispatchResumeUnifiedImportRun } from '../../../server/src/services/wigleImportRunService';

// Mock runRepository
const runRepository = require('../../../server/src/services/wigleImport/runRepository');
// Mock manageImportRuns
const manageImportRuns = require('../../../server/src/services/wigleImport/use-cases/manageImportRuns');
// Mock wigleBluetoothImportService
const wigleBluetoothImportService = require('../../../server/src/services/wigleImport/wigleBluetoothImportService');

jest.mock('../../../server/src/services/wigleImport/runRepository', () => ({
  getRunOrThrow: jest.fn(),
  deleteImportRun: jest.fn(),
  getImportRun: jest.fn(),
  listImportRuns: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleImport/use-cases/manageImportRuns', () => ({
  cancelImportRun: jest.fn(),
  dispatchImportRun: jest.fn(),
  dispatchResumeImportRun: jest.fn(),
  dispatchResumeLatestImportRun: jest.fn(),
  getLatestResumableImportRun: jest.fn(),
  pauseImportRun: jest.fn(),
  reconcileOrphanRuns: jest.fn(),
  resumeImportRun: jest.fn(),
  resumeLatestImportRun: jest.fn(),
  startImportRun: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleImport/wigleBluetoothImportService', () => ({
  dispatchResumeBluetoothImportRun: jest.fn(),
}));

describe('wigleImportRunService - dispatchResumeUnifiedImportRun', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes to dispatchResumeBluetoothImportRun when run.source is wigle_bt', async () => {
    (runRepository.getRunOrThrow as any).mockResolvedValueOnce({
      id: 420,
      source: 'wigle_bt',
      status: 'paused',
    });
    (wigleBluetoothImportService.dispatchResumeBluetoothImportRun as any).mockResolvedValueOnce({
      status: 'dispatched',
      run: { id: 420, source: 'wigle_bt', status: 'running' },
    });

    const result = await dispatchResumeUnifiedImportRun(420);

    expect(runRepository.getRunOrThrow).toHaveBeenCalledWith(420);
    expect(wigleBluetoothImportService.dispatchResumeBluetoothImportRun).toHaveBeenCalledWith(420);
    expect(manageImportRuns.dispatchResumeImportRun).not.toHaveBeenCalled();
    expect(result.status).toBe('dispatched');
    if (result.status === 'dispatched') {
      expect(result.run.id).toBe(420);
    }
  });

  it('routes to dispatchResumeImportRun when run.source is not wigle_bt', async () => {
    (runRepository.getRunOrThrow as any).mockResolvedValueOnce({
      id: 400,
      source: 'wigle_v2',
      status: 'paused',
    });
    (manageImportRuns.dispatchResumeImportRun as any).mockResolvedValueOnce({
      status: 'dispatched',
      run: { id: 400, source: 'wigle_v2', status: 'running' },
    });

    const result = await dispatchResumeUnifiedImportRun(400);

    expect(runRepository.getRunOrThrow).toHaveBeenCalledWith(400);
    expect(manageImportRuns.dispatchResumeImportRun).toHaveBeenCalledWith(400);
    expect(wigleBluetoothImportService.dispatchResumeBluetoothImportRun).not.toHaveBeenCalled();
    expect(result.status).toBe('dispatched');
    if (result.status === 'dispatched') {
      expect(result.run.id).toBe(400);
    }
  });

  it('propagates errors from getRunOrThrow or delegated dispatchers', async () => {
    (runRepository.getRunOrThrow as any).mockRejectedValueOnce(
      new Error('WiGLE import run 999 not found')
    );

    await expect(dispatchResumeUnifiedImportRun(999)).rejects.toThrow('not found');
    expect(wigleBluetoothImportService.dispatchResumeBluetoothImportRun).not.toHaveBeenCalled();
    expect(manageImportRuns.dispatchResumeImportRun).not.toHaveBeenCalled();
  });
});
