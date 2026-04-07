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
const adminImportHistoryService = require('./adminImportHistoryService');
import { IncrementalImporter } from '../../../etl/load/sqlite-import';

export interface MobileUploadData {
  s3Key: string;
  sourceTag: string;
  deviceModel?: string;
  deviceId?: string;
  osVersion?: string;
  appVersion?: string;
  batteryLevel?: number;
  storageFreeGb?: number;
  extraMetadata?: any;
}

class MobileIngestService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.bucketName = process.env.S3_BACKUP_BUCKET || '';
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
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
      ]
    );
    return rows[0].id;
  }

  /**
   * Process an upload: Download from S3 and run ETL
   */
  async processUpload(uploadId: number): Promise<void> {
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

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: upload.s3_key,
        })
      );

      if (!response.Body) throw new Error('S3 response body is empty');
      await pipeline(response.Body as Readable, fs.createWriteStream(tempFilePath));

      // 3. Capture baseline metrics
      const metricsBefore = await adminImportHistoryService.captureImportMetrics();
      historyId = await adminImportHistoryService.createImportHistoryEntry(
        upload.source_tag,
        path.basename(upload.s3_key),
        metricsBefore
      );

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
