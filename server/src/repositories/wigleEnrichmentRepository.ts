/**
 * WiGLE Enrichment Repository
 * Write/adminQuery mutations for the v3 batch enrichment pipeline.
 * Read queries live in services/wigleEnrichment/repositories/enrichmentReadRepository.ts.
 */

export {
  countFieldObservationsMissingV3Detail,
  getActiveEnrichmentRunId,
  getEnrichmentCatalog,
  getNextEnrichmentBatch,
  getPendingEnrichmentCount,
  getRunStatus,
} from '../services/wigleEnrichment/repositories/enrichmentReadRepository';

function adminQuery(text: string, params: any[] = []) {
  return require('../config/container').adminDbService.adminQuery(text, params);
}

/** Set api_total_results on a run (used for progress bar). */
export async function setRunTotalItems(runId: number, total: number): Promise<void> {
  await adminQuery('UPDATE app.wigle_import_runs SET api_total_results = $1 WHERE id = $2', [
    total,
    runId,
  ]);
}

/** Increment rows_inserted and pages_fetched by 1 for a run. */
export async function incrementRunProgress(runId: number): Promise<void> {
  await adminQuery(
    `UPDATE app.wigle_import_runs
     SET rows_inserted = rows_inserted + 1, pages_fetched = pages_fetched + 1, updated_at = NOW()
     WHERE id = $1`,
    [runId]
  );
}

/** Force a stuck 'running' run to 'failed' so a new run can start. */
export async function forceClearRun(runId: number): Promise<boolean> {
  const { rowCount } = await adminQuery(
    `UPDATE app.wigle_import_runs SET status = 'failed', last_error = 'Force-cleared by admin'
     WHERE id = $1 AND status = 'running'`,
    [runId]
  );
  return (rowCount ?? 0) > 0;
}

export async function resetRunForResume(runId: number): Promise<any | null> {
  const { rows } = await adminQuery(
    "UPDATE app.wigle_import_runs SET status = 'running', last_error = NULL WHERE id = $1 RETURNING *",
    [runId]
  );
  return rows[0] ?? null;
}

/** Trigger the WiGLE networks materialized view refresh. */
export async function refreshWigleNetworksMv(): Promise<void> {
  await adminQuery('SELECT app.refresh_wigle_networks_mv()');
}
