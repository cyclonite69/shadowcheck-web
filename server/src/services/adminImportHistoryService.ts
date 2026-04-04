export {};

const { adminQuery } = require('./adminDbService');
const { query } = require('../config/database');
const logger = require('../logging/logger');

/**
 * Counts key tables for before/after import metrics snapshots.
 */
type ImportMetricName =
  | 'networks'
  | 'observations'
  | 'in_explorer_mv'
  | 'kismet_devices'
  | 'kismet_packets'
  | 'kismet_alerts'
  | 'kml_files'
  | 'kml_points';

type ImportMetrics = Partial<Record<ImportMetricName, number | null>>;

const IMPORT_METRIC_QUERIES: Record<ImportMetricName, string> = {
  networks: 'SELECT COUNT(*)::bigint AS value FROM app.networks',
  observations: 'SELECT COUNT(*)::bigint AS value FROM app.observations',
  in_explorer_mv: 'SELECT COUNT(*)::bigint AS value FROM app.api_network_explorer_mv',
  kismet_devices: 'SELECT COUNT(*)::bigint AS value FROM app.kismet_devices',
  kismet_packets: 'SELECT COUNT(*)::bigint AS value FROM app.kismet_packets',
  kismet_alerts: 'SELECT COUNT(*)::bigint AS value FROM app.kismet_alerts',
  kml_files: 'SELECT COUNT(*)::bigint AS value FROM app.kml_files',
  kml_points: 'SELECT COUNT(*)::bigint AS value FROM app.kml_points',
};

async function captureImportMetrics(): Promise<ImportMetrics> {
  const metrics: ImportMetrics = {};

  for (const [name, sql] of Object.entries(IMPORT_METRIC_QUERIES) as [ImportMetricName, string][]) {
    try {
      const { rows } = await adminQuery(sql);
      const rawValue = rows[0]?.value;
      metrics[name] = rawValue == null ? null : parseInt(String(rawValue), 10);
    } catch (e: any) {
      logger.warn(`Failed to capture import metric ${name}: ${e.message}`);
      metrics[name] = null;
    }
  }

  return metrics;
}

/**
 * Opens a new import_history row with status='running'.
 * Returns the generated id, or 0 on failure.
 */
async function createImportHistoryEntry(
  sourceTag: string,
  filename: string,
  metricsBefore: ImportMetrics
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
  metricsAfter: ImportMetrics
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
