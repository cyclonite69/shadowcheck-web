import logger from '../../../../logging/logger';
import {
  getSiblingRefreshStatus,
  state,
  type SiblingRefreshStatus,
} from '../../siblingDetectionState';
import { adminQuery } from '../adminQueryAdapter';
import { reconcileSiblingState } from './reconcileSiblingState';

/**
 * Return sibling refresh status after reconciling stale persisted running rows.
 */
async function getSiblingRefreshStatusReconciled(): Promise<SiblingRefreshStatus> {
  await reconcileSiblingState();

  if (state.running) {
    return getSiblingRefreshStatus();
  }

  const bgRunning = await adminQuery(
    'SELECT id FROM app.background_job_runs WHERE job_name = $1 AND status = $2 LIMIT 1',
    ['siblingDetection', 'running']
  );

  const siblingRunning = await adminQuery(
    'SELECT id FROM app.sibling_runs WHERE status = $1 LIMIT 1',
    ['running']
  );

  if (bgRunning.rows.length > 0 || siblingRunning.rows.length > 0) {
    logger.info('[Siblings] Stale running rows were auto-fixed during reconciliation');
  }

  return getSiblingRefreshStatus();
}

export { getSiblingRefreshStatusReconciled };
