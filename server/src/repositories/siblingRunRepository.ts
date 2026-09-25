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
   * Fetch the cutoff timestamp of the most recent sibling run.
   */
  async getPreviousRunCutoff(): Promise<string | null> {
    const cutoffResult = await adminQuery(
      'SELECT MAX(computed_at) AS cutoff FROM app.network_sibling_pairs'
    );
    return cutoffResult.rows[0]?.cutoff ?? null;
  }
}
