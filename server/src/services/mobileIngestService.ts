/**
 * Mobile Ingest Service
 * Manages S3-to-ETL pipeline for mobile device SQLite uploads.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pipeline } from 'stream/promises';
const { adminQuery } = require('./adminDbService');
import logger from '../logging/logger';
import secretsManager from './secretsManager';
const adminImportHistoryService = require('./adminImportHistoryService');
import { IncrementalImporter } from '../../../etl/load/sqlite-import';

export interface MobileUploadData {
  s3Key: string;
  sourceTag: string;
  status?: string;
  historyStatus?: string;
  deviceModel?: string;
  deviceId?: string;
  osVersion?: string;
  appVersion?: string;
  batteryLevel?: number;
  storageFreeGb?: number;
  extraMetadata?: any;
}

const DEFAULT_STUCK_THRESHOLD_MINUTES = 30;

class MobileIngestService {
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;

  private initS3() {
    if (this.s3Client) return;
    const region = secretsManager.get('aws_region') || process.env.AWS_REGION || 'us-east-1';
    this.s3Client = new S3Client({ region });
    this.bucketName =
      secretsManager.get('s3_backup_bucket') ||
      process.env.S3_BACKUP_BUCKET ||
      'dbcoopers-briefcase-161020170158';
  }

  constructor() {}

  private getStuckThresholdMinutes(): number {
    const raw =
      process.env.MOBILE_INGEST_STUCK_THRESHOLD_MINUTES ||
      process.env.MOBILE_INGEST_STUCK_THRESHOLD_MINUTES_DEFAULT;
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STUCK_THRESHOLD_MINUTES;
  }

  async recoverStuckUploads(olderThanMinutes = this.getStuckThresholdMinutes()): Promise<number> {
    const recoveryNote = `stuck_recovery: marked failed after ${olderThanMinutes} minute timeout`;
    const recovered = await adminQuery(
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

    const rows = Array.isArray(recovered?.rows) ? recovered.rows : [];
    const historyIds = rows
      .map((row: any) => Number(row.history_id))
      .filter((historyId: number) => Number.isFinite(historyId) && historyId > 0);

    if (historyIds.length > 0) {
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

    if (rows.length > 0) {
      logger.warn('[MobileIngest] Recovered stuck uploads at startup', {
        count: rows.length,
        olderThanMinutes,
        uploadIds: rows.map((row: any) => row.id),
      });
    }

    const zombieHistoryNote = 'stuck_recovery: linked upload no longer processing';
    const zombieHistory = await adminQuery(
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
      [zombieHistoryNote]
    );

    const zombieRows = Array.isArray(zombieHistory?.rows) ? zombieHistory.rows : [];
    if (zombieRows.length > 0) {
      logger.warn('[MobileIngest] Closed zombie import history rows at startup', {
        count: zombieRows.length,
        historyIds: zombieRows.map((row: any) => row.id),
        uploadIds: zombieRows.map((row: any) => row.upload_id),
      });
    }

    return rows.length + zombieRows.length;
  }

  /**
   * Record a new upload in the tracking table
   */
  async recordUpload(data: MobileUploadData): Promise<number> {
    const { rows } = await adminQuery(
      `INSERT INTO app.mobile_uploads (
        s3_key, source_tag, device_model, device_id, 
        os_version, app_version, battery_level,
        storage_free_gb, extra_metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        data.s3Key,
        data.sourceTag,
        data.deviceModel,
        data.deviceId,
        data.osVersion,
        data.appVersion,
        data.batteryLevel,
        data.storageFreeGb,
        data.extraMetadata ? JSON.stringify(data.extraMetadata) : null,
        data.status || 'pending',
      ]
    );
    const dbId = rows[0].id;

    // Create a corresponding entry in import_history so it shows up in the UI
    try {
      const metricsBefore = await adminImportHistoryService.captureImportMetrics();
      const historyId = await adminImportHistoryService.createImportHistoryEntry(
        data.sourceTag,
        path.basename(data.s3Key),
        metricsBefore,
        data.historyStatus || 'running'
      );

      // Link it back
      await adminQuery('UPDATE app.mobile_uploads SET history_id = $1 WHERE id = $2', [
        historyId,
        dbId,
      ]);
    } catch (e: any) {
      logger.warn(`[MobileIngest] Could not create initial import_history entry: ${e.message}`);
    }

    return dbId;
  }

  async startPendingUpload(
    uploadId: number
  ): Promise<{ uploadId: number; historyId: number | null }> {
    const result = await adminQuery(
      `UPDATE app.mobile_uploads
          SET status = 'processing',
              updated_at = NOW()
        WHERE id = $1
          AND status = 'pending'
      RETURNING id, history_id, source_tag, s3_key`,
      [uploadId]
    );

    if (!Array.isArray(result?.rows) || result.rows.length === 0) {
      const existing = await adminQuery(
        'SELECT id, history_id, status FROM app.mobile_uploads WHERE id = $1',
        [uploadId]
      );

      if (!Array.isArray(existing?.rows) || existing.rows.length === 0) {
        throw new Error(`Upload ${uploadId} not found`);
      }

      throw new Error(`Upload ${uploadId} is not pending`);
    }

    const upload = result.rows[0];
    let historyId = upload.history_id ? Number(upload.history_id) : null;

    if (historyId) {
      await adminQuery(
        `UPDATE app.import_history
            SET status = 'running',
                started_at = NOW()
          WHERE id = $1`,
        [historyId]
      );
    } else {
      const metricsBefore = await adminImportHistoryService.captureImportMetrics();
      historyId = await adminImportHistoryService.createImportHistoryEntry(
        upload.source_tag,
        path.basename(upload.s3_key),
        metricsBefore,
        'running'
      );

      if (historyId) {
        await adminQuery('UPDATE app.mobile_uploads SET history_id = $1 WHERE id = $2', [
          historyId,
          uploadId,
        ]);
      }
    }

    return { uploadId, historyId };
  }

  /**
   * Process an upload: Download from S3 and run ETL
   */
  async processUpload(
    uploadId: number,
    options: { skipStateTransition?: boolean } = {}
  ): Promise<void> {
    this.initS3();
    if (!this.bucketName) throw new Error('S3_BACKUP_BUCKET not configured');

    const { rows } = await adminQuery('SELECT * FROM app.mobile_uploads WHERE id = $1', [uploadId]);

    if (rows.length === 0) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    const upload = rows[0];
    const tempFilePath = path.join(
      os.tmpdir(),
      `mobile-ingest-${upload.id}-${path.basename(upload.s3_key)}`
    );
    let historyId: number = 0;

    try {
      if (!options.skipStateTransition) {
        await adminQuery(
          "UPDATE app.mobile_uploads SET status = 'processing', updated_at = NOW() WHERE id = $1",
          [uploadId]
        );
      }

      // 2. Download from S3
      logger.info(
        `[MobileIngest] Downloading s3://${this.bucketName}/${upload.s3_key} to ${tempFilePath}`
      );
      if (!this.bucketName) throw new Error('S3_BACKUP_BUCKET not configured');

      const response = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: upload.s3_key,
        })
      );

      if (!response.Body) throw new Error('S3 response body is empty');
      await pipeline(response.Body as Readable, fs.createWriteStream(tempFilePath));

      // 3. Capture baseline metrics
      const metricsBefore = await adminImportHistoryService.captureImportMetrics();

      if (upload.history_id) {
        historyId = upload.history_id;
        if (!options.skipStateTransition) {
          await adminQuery(
            "UPDATE app.import_history SET status = 'running', started_at = NOW(), metrics_before = $1 WHERE id = $2",
            [JSON.stringify(metricsBefore), historyId]
          );
        } else {
          await adminQuery('UPDATE app.import_history SET metrics_before = $1 WHERE id = $2', [
            JSON.stringify(metricsBefore),
            historyId,
          ]);
        }
      } else {
        historyId = await adminImportHistoryService.createImportHistoryEntry(
          upload.source_tag,
          path.basename(upload.s3_key),
          metricsBefore
        );
      }

      // 4. Run Importer
      logger.info(`[MobileIngest] Starting IncrementalImporter for ${upload.source_tag}`);
      const importer = new IncrementalImporter(tempFilePath, upload.source_tag);
      const summary = await importer.start();

      // 5. Capture final metrics and complete
      const metricsAfter = await adminImportHistoryService.captureImportMetrics();

      await adminImportHistoryService.completeImportSuccess(
        historyId,
        summary.imported,
        summary.failed,
        summary.durationS.toFixed(2),
        metricsAfter
      );

      await adminQuery(
        "UPDATE app.mobile_uploads SET status = 'completed', history_id = $1, updated_at = NOW() WHERE id = $2",
        [historyId, uploadId]
      );

      logger.info(
        `[MobileIngest] Upload ${uploadId} processed successfully. History ID: ${historyId}`
      );
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[MobileIngest] Failed to process upload ${uploadId}: ${errorMessage}`, {
        error,
      });

      await adminQuery(
        "UPDATE app.mobile_uploads SET status = 'failed', error_detail = $1, updated_at = NOW() WHERE id = $2",
        [errorMessage, uploadId]
      );

      if (historyId) {
        await adminImportHistoryService.failImportHistory(historyId, errorMessage);
      }
    } finally {
      // 6. Cleanup
      if (fs.existsSync(tempFilePath)) {
        await fs.promises
          .unlink(tempFilePath)
          .catch((e) => logger.warn(`[MobileIngest] Cleanup failed: ${e.message}`));
      }
    }
  }
}

const mobileIngestService = new MobileIngestService();
export default mobileIngestService;
module.exports = mobileIngestService;
module.exports.default = mobileIngestService;
