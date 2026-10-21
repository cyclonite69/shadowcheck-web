/**
 * WiGLE import run facade.
 * Preserves the existing public API while delegating run orchestration and
 * report shaping to smaller modules under `services/wigleImport/`.
 */

import {
  deleteImportRun,
  getImportRun,
  getRunOrThrow,
  listImportRuns,
} from './wigleImport/runRepository';
import { validateImportQuery } from './wigleImport/params';
import {
  cancelImportRun,
  dispatchImportRun,
  dispatchResumeImportRun,
  dispatchResumeLatestImportRun,
  getLatestResumableImportRun,
  pauseImportRun,
  reconcileOrphanRuns,
  resumeImportRun,
  resumeLatestImportRun,
  startImportRun,
  type WigleDispatchAlreadyRunning,
  type WigleDispatchResult,
  type WigleDispatchSuccess,
} from './wigleImport/use-cases/manageImportRuns';
import { dispatchResumeBluetoothImportRun } from './wigleImport/wigleBluetoothImportService';

/**
 * Service-level dispatcher for resuming import runs across sources.
 * Inspects run source: delegates to dispatchResumeBluetoothImportRun for 'wigle_bt',
 * and dispatchResumeImportRun for WiFi.
 */
export async function dispatchResumeUnifiedImportRun(runId: number): Promise<WigleDispatchResult> {
  const run = await getRunOrThrow(runId);
  if (run.source === 'wigle_bt') {
    return dispatchResumeBluetoothImportRun(runId);
  }
  return dispatchResumeImportRun(runId);
}

export {
  cancelImportRun,
  dispatchImportRun,
  dispatchResumeImportRun,
  dispatchResumeLatestImportRun,
  getLatestResumableImportRun,
  pauseImportRun,
  reconcileOrphanRuns,
  resumeImportRun,
  resumeLatestImportRun,
  startImportRun,
  type WigleDispatchAlreadyRunning,
  type WigleDispatchResult,
  type WigleDispatchSuccess,
};
export { getImportCompletenessReport } from './wigleImport/use-cases/getImportCompletenessReport';
export { bulkDeleteGlobalCancelledCluster } from './wigleImport/use-cases/bulkDeleteGlobalCancelledCluster';
export { deleteImportRun, getImportRun, listImportRuns, validateImportQuery };
