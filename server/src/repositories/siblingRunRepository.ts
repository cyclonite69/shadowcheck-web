import { adminQuery } from '../services/admin/siblingDetection/adminQueryAdapter';

export interface SiblingRunOptions {
  maxOctetDelta: number;
  minCandidateConf: number;
  batchSize: number;
  maxBatches: number | null;
}

export interface SiblingRunMetrics {
  seedsProcessed: number;
  rowsUpserted: number;
  rowsUpdated: number;
}

export class SiblingRunRepository {
  /**
   * Insert a new sibling detection run start record.
   */
  async createRun(runMode: string, options: SiblingRunOptions): Promise<number> {
    const runInsert = await adminQuery(
      `INSERT INTO app.sibling_runs
         (run_mode, max_octet_delta, min_confidence, batch_size, max_batches)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        runMode,
        options.maxOctetDelta,
        options.minCandidateConf,
        options.batchSize,
        options.maxBatches,
      ]
    );
    return runInsert.rows[0].id;
  }

  /**
   * Update an active sibling detection run to completed or truncated status.
   */
  async completeRun(runId: number, status: string, metrics: SiblingRunMetrics): Promise<void> {
    await adminQuery(
      `UPDATE app.sibling_runs
       SET completed_at = now(), status = $1, networks_scanned = $2, pairs_inserted = $3, pairs_updated = $4
       WHERE id = $5`,
      [status, metrics.seedsProcessed, metrics.rowsUpserted, metrics.rowsUpdated, runId]
    );
  }

  /**
   * Fetch the start timestamp of the most recent successfully completed full or incremental scan.
   * Test-mode runs (targeted BSSIDs or maxBatches-capped) are excluded so that a narrow targeted
   * run cannot advance the global incremental watermark past unprocessed networks.
   */
  async getPreviousRunCutoff(): Promise<string | null> {
    const cutoffResult = await adminQuery(
      `SELECT MAX(started_at) AS cutoff
       FROM app.sibling_runs
       WHERE status = 'completed'
         AND run_mode IN ('full', 'incremental')`
    );
    return cutoffResult.rows[0]?.cutoff ?? null;
  }
}
