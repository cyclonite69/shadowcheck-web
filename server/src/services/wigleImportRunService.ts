/**
 * WiGLE import run facade.
 * Preserves the existing public API while delegating run orchestration and
 * report shaping to smaller modules under `services/wigleImport/`.
 */

import { deleteImportRun, getImportRun, listImportRuns } from './wigleImport/runRepository';
import { validateImportQuery } from './wigleImport/params';

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
} from './wigleImport/use-cases/manageImportRuns';
export { getImportCompletenessReport } from './wigleImport/use-cases/getImportCompletenessReport';
export { bulkDeleteGlobalCancelledCluster } from './wigleImport/use-cases/bulkDeleteGlobalCancelledCluster';
export { deleteImportRun, getImportRun, listImportRuns, validateImportQuery };
