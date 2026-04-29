export {};

const { adminQuery } = require('../services/adminDbService');

export async function markStuckUploadsFailed(
  olderThanMinutes: number,
  recoveryNote: string
): Promise<any[]> {
  const result = await adminQuery(
    `UPDATE app.mobile_uploads
        SET status = 'failed',
            error_detail = CASE
              WHEN error_detail IS NULL OR BTRIM(error_detail) = '' THEN $2
              WHEN POSITION($2 IN error_detail) > 0 THEN error_detail
              ELSE error_detail || '; ' || $2
            END,
            updated_at = NOW()
      WHERE status IN ('processing', 'queued')
        AND updated_at < NOW() - ($1 * INTERVAL '1 minute')
    RETURNING id, history_id, source_tag, status`,
    [olderThanMinutes, recoveryNote]
  );
  return Array.isArray(result?.rows) ? result.rows : [];
}

export async function markHistoryRowsFailed(
  historyIds: number[],
  recoveryNote: string
): Promise<void> {
  await adminQuery(
    `UPDATE app.import_history
        SET finished_at = NOW(),
            status = 'failed',
            error_detail = CASE
              WHEN error_detail IS NULL OR BTRIM(error_detail) = '' THEN $2
              WHEN POSITION($2 IN error_detail) > 0 THEN error_detail
              ELSE error_detail || '; ' || $2
            END
      WHERE id = ANY($1::int[])
        AND status = 'running'`,
    [historyIds, recoveryNote]
  );
}

export async function markZombieHistoryRowsFailed(recoveryNote: string): Promise<any[]> {
  const result = await adminQuery(
    `UPDATE app.import_history ih
        SET finished_at = NOW(),
            status = 'failed',
            error_detail = CASE
              WHEN ih.error_detail IS NULL OR BTRIM(ih.error_detail) = '' THEN $1
              WHEN POSITION($1 IN ih.error_detail) > 0 THEN ih.error_detail
              ELSE ih.error_detail || '; ' || $1
            END
      FROM app.mobile_uploads mu
     WHERE mu.history_id = ih.id
       AND ih.status = 'running'
       AND mu.status <> 'processing'
    RETURNING ih.id, mu.id AS upload_id, mu.status AS upload_status`,
    [recoveryNote]
  );
  return Array.isArray(result?.rows) ? result.rows : [];
}

export async function insertUpload(params: {
  s3Key: string;
  sourceTag: string;
  deviceModel?: string;
  deviceId?: string;
  osVersion?: string;
  appVersion?: string;
  batteryLevel?: number;
  storageFreeGb?: number;
  extraMetadataJson: string | null;
  status: string;
}): Promise<number> {
  const { rows } = await adminQuery(
    `INSERT INTO app.mobile_uploads (
      s3_key, source_tag, device_model, device_id,
      os_version, app_version, battery_level,
      storage_free_gb, extra_metadata, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
    [
      params.s3Key,
      params.sourceTag,
      params.deviceModel,
      params.deviceId,
      params.osVersion,
      params.appVersion,
      params.batteryLevel,
      params.storageFreeGb,
      params.extraMetadataJson,
      params.status,
    ]
  );
  return rows[0].id;
}

export async function linkHistoryToUpload(historyId: number, uploadId: number): Promise<void> {
  await adminQuery('UPDATE app.mobile_uploads SET history_id = $1 WHERE id = $2', [
    historyId,
    uploadId,
  ]);
}

export async function startPendingUploadRow(
  uploadId: number
): Promise<{ id: number; history_id: number | null; source_tag: string; s3_key: string } | null> {
  const result = await adminQuery(
    `UPDATE app.mobile_uploads
        SET status = 'processing',
            updated_at = NOW()
      WHERE id = $1
        AND status = 'pending'
    RETURNING id, history_id, source_tag, s3_key`,
    [uploadId]
  );
  if (!Array.isArray(result?.rows) || result.rows.length === 0) return null;
  return result.rows[0];
}

export async function getUploadById(
  uploadId: number
): Promise<{ id: number; history_id: number | null; status: string } | null> {
  const result = await adminQuery(
    'SELECT id, history_id, status FROM app.mobile_uploads WHERE id = $1',
    [uploadId]
  );
  if (!Array.isArray(result?.rows) || result.rows.length === 0) return null;
  return result.rows[0];
}

export async function markHistoryRunning(historyId: number): Promise<void> {
  await adminQuery(
    `UPDATE app.import_history
        SET status = 'running',
            started_at = NOW()
      WHERE id = $1`,
    [historyId]
  );
}

export async function getUploadRow(uploadId: number): Promise<any | null> {
  const { rows } = await adminQuery('SELECT * FROM app.mobile_uploads WHERE id = $1', [uploadId]);
  return rows.length > 0 ? rows[0] : null;
}

export async function setUploadProcessing(uploadId: number): Promise<void> {
  await adminQuery(
    "UPDATE app.mobile_uploads SET status = 'processing', updated_at = NOW() WHERE id = $1",
    [uploadId]
  );
}

export async function updateHistoryMetricsBefore(
  historyId: number,
  metricsBeforeJson: string,
  setRunning: boolean
): Promise<void> {
  if (setRunning) {
    await adminQuery(
      "UPDATE app.import_history SET status = 'running', started_at = NOW(), metrics_before = $1 WHERE id = $2",
      [metricsBeforeJson, historyId]
    );
  } else {
    await adminQuery('UPDATE app.import_history SET metrics_before = $1 WHERE id = $2', [
      metricsBeforeJson,
      historyId,
    ]);
  }
}

export async function markUploadCompleted(historyId: number, uploadId: number): Promise<void> {
  await adminQuery(
    "UPDATE app.mobile_uploads SET status = 'completed', history_id = $1, updated_at = NOW() WHERE id = $2",
    [historyId, uploadId]
  );
}

export async function markUploadFailed(uploadId: number, errorMessage: string): Promise<void> {
  await adminQuery(
    "UPDATE app.mobile_uploads SET status = 'failed', error_detail = $1, updated_at = NOW() WHERE id = $2",
    [errorMessage, uploadId]
  );
}

module.exports = {
  markStuckUploadsFailed,
  markHistoryRowsFailed,
  markZombieHistoryRowsFailed,
  insertUpload,
  linkHistoryToUpload,
  startPendingUploadRow,
  getUploadById,
  markHistoryRunning,
  getUploadRow,
  setUploadProcessing,
  updateHistoryMetricsBefore,
  markUploadCompleted,
  markUploadFailed,
};
