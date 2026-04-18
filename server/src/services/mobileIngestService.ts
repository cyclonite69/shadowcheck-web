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
  deviceModel?: string;
  deviceId?: string;
  osVersion?: string;
  appVersion?: string;
  batteryLevel?: number;
  storageFreeGb?: number;
  extraMetadata?: any;
}

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
        metricsBefore
      );

      // Link it back
      await adminQuery('UPDATE app.mobile_uploads SET history_id = $1 WHERE id = $2', [
        historyId,
        dbId,
      ]);

      // If quarantined, mark history as quarantined immediately
      if (data.status === 'quarantined') {
        await adminImportHistoryService.completeImportSuccess(
          historyId,
          0,
          0,
          '0.00',
          metricsBefore,
          'quarantined'
        );
      }
    } catch (e: any) {
      logger.warn(`[MobileIngest] Could not create initial import_history entry: ${e.message}`);
    }

    return dbId;
  }

  /**
   * Process an upload: Download from S3 and run ETL
   */
  async processUpload(uploadId: number): Promise<void> {
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
      // 1. Update status to processing
      await adminQuery(
        "UPDATE app.mobile_uploads SET status = 'processing', updated_at = NOW() WHERE id = $1",
        [uploadId]
      );

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
        // Update existing entry to 'running'
        await adminQuery(
          "UPDATE app.import_history SET status = 'running', started_at = NOW(), metrics_before = $1 WHERE id = $2",
          [JSON.stringify(metricsBefore), historyId]
        );
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
