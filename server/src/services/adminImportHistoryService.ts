export {};

const { adminQuery } = require('./adminDbService');
const { query } = require('../config/database');
const logger = require('../logging/logger');

/**
 * Counts key tables for before/after import metrics snapshots.
 */
async function captureImportMetrics(): Promise<Record<string, number>> {
  try {
    const { rows } = await adminQuery(`
      SELECT
        (SELECT COUNT(*) FROM app.networks)               AS networks,
        (SELECT COUNT(*) FROM app.observations)           AS observations,
        (SELECT COUNT(*) FROM app.api_network_explorer_mv) AS in_explorer_mv,
        (SELECT COUNT(*) FROM app.kismet_devices)         AS kismet_devices,
        (SELECT COUNT(*) FROM app.kismet_packets)         AS kismet_packets,
        (SELECT COUNT(*) FROM app.kismet_alerts)          AS kismet_alerts
    `);
    return {
      networks: parseInt(rows[0].networks),
      observations: parseInt(rows[0].observations),
      in_explorer_mv: parseInt(rows[0].in_explorer_mv),
      kismet_devices: parseInt(rows[0].kismet_devices),
      kismet_packets: parseInt(rows[0].kismet_packets),
      kismet_alerts: parseInt(rows[0].kismet_alerts),
    };
  } catch (e: any) {
    logger.warn(`Failed to capture metrics: ${e.message}`);
    return {};
  }
}

/**
 * Opens a new import_history row with status='running'.
 * Returns the generated id, or 0 on failure.
 */
async function createImportHistoryEntry(
  sourceTag: string,
  filename: string,
  metricsBefore: Record<string, number>
): Promise<number> {
  try {
    const { rows } = await adminQuery(
      `INSERT INTO app.import_history (source_tag, filename, status, metrics_before)
       VALUES ($1, $2, 'running', $3) RETURNING id`,
      [sourceTag, filename, JSON.stringify(metricsBefore)]
    );
    return rows[0].id;
  } catch (e: any) {
    logger.warn(`Could not create import_history row: ${e.message}`);
    return 0;
  }
}

/**
 * Marks the import history row as having taken a backup.
 */
async function markImportBackupTaken(historyId: number): Promise<void> {
  await adminQuery(`UPDATE app.import_history SET backup_taken = TRUE WHERE id = $1`, [historyId]);
}

/**
 * Closes an import history row with status='success'.
 */
async function completeImportSuccess(
  historyId: number,
  imported: number,
  failed: number,
  durationS: string,
  metricsAfter: Record<string, number>
): Promise<void> {
  await adminQuery(
    `UPDATE app.import_history
       SET finished_at   = NOW(),
           status        = 'success',
           imported      = $2,
           failed        = $3,
           duration_s    = $4,
           metrics_after = $5
     WHERE id = $1`,
    [historyId, imported, failed, durationS, JSON.stringify(metricsAfter)]
  );
}

/**
 * Closes an import history row with status='failed'.
 * durationS is optional (unknown if the process errored before spawning).
 */
async function failImportHistory(
  historyId: number,
  errorDetail: string,
  durationS?: string
): Promise<void> {
  if (durationS !== undefined) {
    await adminQuery(
      `UPDATE app.import_history
         SET finished_at  = NOW(),
             status       = 'failed',
             duration_s   = $2,
             error_detail = $3
       WHERE id = $1`,
      [historyId, durationS, errorDetail]
    );
  } else {
    await adminQuery(
      `UPDATE app.import_history
         SET finished_at  = NOW(),
             status       = 'failed',
             error_detail = $2
       WHERE id = $1`,
      [historyId, errorDetail]
    );
  }
}

/**
 * Returns the most recent import history rows.
 */
async function getImportHistory(limit: number): Promise<any[]> {
  const { rows } = await adminQuery(
    `SELECT id, started_at, finished_at, source_tag, filename,
            imported, failed, duration_s, status, error_detail,
            metrics_before, metrics_after, backup_taken
       FROM app.import_history
      ORDER BY started_at DESC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

/**
 * Returns all known device source tags with their last import date and total imported count.
 */
async function getDeviceSources(): Promise<any[]> {
  const { rows } = await adminQuery(`
    SELECT
      ds.code AS source_tag,
      MAX(ih.started_at) AS last_import,
      SUM(COALESCE(ih.imported, 0)) AS total_imported
    FROM app.device_sources ds
    LEFT JOIN app.import_history ih
           ON ih.source_tag = ds.code AND ih.status = 'success'
    GROUP BY ds.code
    ORDER BY last_import DESC NULLS LAST
  `);
  return rows;
}

/**
 * Get import counts after SQLite import
 */
async function getImportCounts(): Promise<{ observations: number; networks: number }> {
  const result = await query(`
    SELECT 
      (SELECT COUNT(*) FROM app.observations) as observations,
      (SELECT COUNT(*) FROM app.networks) as networks
  `);
  return result.rows[0] || { observations: 0, networks: 0 };
}

module.exports = {
  captureImportMetrics,
  createImportHistoryEntry,
  markImportBackupTaken,
  completeImportSuccess,
  failImportHistory,
  getImportHistory,
  getDeviceSources,
  getImportCounts,
};
