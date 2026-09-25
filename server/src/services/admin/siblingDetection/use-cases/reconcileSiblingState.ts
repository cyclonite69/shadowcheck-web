import logger from '../../../../logging/logger';
import { state } from '../../siblingDetectionState';
import { adminQuery } from '../adminQueryAdapter';

/**
 * Reconcile in-memory sibling job state with persisted running rows.
 */
async function reconcileSiblingState(): Promise<void> {
  if (!state.running) {
    const bgResult = await adminQuery(
      'SELECT id FROM app.background_job_runs WHERE job_name = $1 AND status = $2 ORDER BY id DESC LIMIT 1',
      ['siblingDetection', 'running']
    );
    if (bgResult.rows.length > 0) {
      logger.warn('[Siblings] Found stale running row in background_job_runs; marking failed', {
        id: bgResult.rows[0].id,
      });
      await adminQuery(
        'UPDATE app.background_job_runs SET status = $1, finished_at = now(), error = $2 WHERE job_name = $3 AND status = $4',
        ['failed', 'Interrupted by container restart', 'siblingDetection', 'running']
      );
    }

    const siblingResult = await adminQuery(
      'SELECT id FROM app.sibling_runs WHERE status = $1 ORDER BY id DESC LIMIT 1',
      ['running']
    );
    if (siblingResult.rows.length > 0) {
      logger.warn('[Siblings] Found stale running row in sibling_runs; marking failed', {
        id: siblingResult.rows[0].id,
      });
      await adminQuery(
        'UPDATE app.sibling_runs SET status = $1, completed_at = now() WHERE status = $2',
        ['failed', 'running']
      );
    }
  }
}

export { reconcileSiblingState };
