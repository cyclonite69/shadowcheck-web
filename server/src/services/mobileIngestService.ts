/**
 * Mobile Ingest Service
 * Manages S3-to-ETL pipeline for mobile device SQLite uploads.
 * All database access is delegated to mobileIngestRepository.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pipeline } from 'stream/promises';
import logger from '../logging/logger';
import secretsManager from './secretsManager';
const adminImportHistoryService = require('./adminImportHistoryService');
import { IncrementalImporter } from '../../../etl/load/sqlite-import';
const repo = require('../repositories/mobileIngestRepository');

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

    const rows = await repo.markStuckUploadsFailed(olderThanMinutes, recoveryNote);

    const historyIds = rows
      .map((row: any) => Number(row.history_id))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    if (historyIds.length > 0) {
      await repo.markHistoryRowsFailed(historyIds, recoveryNote);
    }

    if (rows.length > 0) {
      logger.warn('[MobileIngest] Recovered stuck uploads at startup', {
        count: rows.length,
        olderThanMinutes,
        uploadIds: rows.map((row: any) => row.id),
      });
    }

    const zombieNote = 'stuck_recovery: linked upload no longer processing';
    const zombieRows = await repo.markZombieHistoryRowsFailed(zombieNote);

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
    const dbId = await repo.insertUpload({
      s3Key: data.s3Key,
      sourceTag: data.sourceTag,
      deviceModel: data.deviceModel,
      deviceId: data.deviceId,
      osVersion: data.osVersion,
      appVersion: data.appVersion,
      batteryLevel: data.batteryLevel,
      storageFreeGb: data.storageFreeGb,
      extraMetadataJson: data.extraMetadata ? JSON.stringify(data.extraMetadata) : null,
      status: data.status || 'pending',
    });

    try {
      const metricsBefore = await adminImportHistoryService.captureImportMetrics();
      const historyId = await adminImportHistoryService.createImportHistoryEntry(
        data.sourceTag,
        path.basename(data.s3Key),
        metricsBefore,
        data.historyStatus || 'running'
      );
      await repo.linkHistoryToUpload(historyId, dbId);
    } catch (e: any) {
      logger.warn(`[MobileIngest] Could not create initial import_history entry: ${e.message}`);
    }

    return dbId;
  }

  async startPendingUpload(
    uploadId: number
  ): Promise<{ uploadId: number; historyId: number | null }> {
    const upload = await repo.startPendingUploadRow(uploadId);

    if (!upload) {
      const existing = await repo.getUploadById(uploadId);
      if (!existing) throw new Error(`Upload ${uploadId} not found`);
      throw new Error(`Upload ${uploadId} is not pending`);
    }

    let historyId: number | null = upload.history_id ? Number(upload.history_id) : null;

    if (historyId) {
      await repo.markHistoryRunning(historyId);
    } else {
      const metricsBefore = await adminImportHistoryService.captureImportMetrics();
      historyId = await adminImportHistoryService.createImportHistoryEntry(
        upload.source_tag,
        path.basename(upload.s3_key),
        metricsBefore,
        'running'
      );
      if (historyId) {
        await repo.linkHistoryToUpload(historyId, uploadId);
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

    const upload = await repo.getUploadRow(uploadId);
    if (!upload) throw new Error(`Upload ${uploadId} not found`);

    const tempFilePath = path.join(
      os.tmpdir(),
      `mobile-ingest-${upload.id}-${path.basename(upload.s3_key)}`
    );
    let historyId: number = 0;

    try {
      if (!options.skipStateTransition) {
        await repo.setUploadProcessing(uploadId);
      }

      logger.info(
        `[MobileIngest] Downloading s3://${this.bucketName}/${upload.s3_key} to ${tempFilePath}`
      );
      if (!this.bucketName) throw new Error('S3_BACKUP_BUCKET not configured');

      const response = await this.s3Client!.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: upload.s3_key })
      );
      if (!response.Body) throw new Error('S3 response body is empty');
      await pipeline(response.Body as Readable, fs.createWriteStream(tempFilePath));

      const metricsBefore = await adminImportHistoryService.captureImportMetrics();

      if (upload.history_id) {
        historyId = upload.history_id;
        await repo.updateHistoryMetricsBefore(
          historyId,
          JSON.stringify(metricsBefore),
          !options.skipStateTransition
        );
      } else {
        historyId = await adminImportHistoryService.createImportHistoryEntry(
          upload.source_tag,
          path.basename(upload.s3_key),
          metricsBefore
        );
      }

      logger.info(`[MobileIngest] Starting IncrementalImporter for ${upload.source_tag}`);
      const importer = new IncrementalImporter(tempFilePath, upload.source_tag);
      const summary = await importer.start();

      const metricsAfter = await adminImportHistoryService.captureImportMetrics();
      await adminImportHistoryService.completeImportSuccess(
        historyId,
        summary.imported,
        summary.failed,
        summary.durationS.toFixed(2),
        metricsAfter
      );

      await repo.markUploadCompleted(historyId, uploadId);

      logger.info(
        `[MobileIngest] Upload ${uploadId} processed successfully. History ID: ${historyId}`
      );
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[MobileIngest] Failed to process upload ${uploadId}: ${errorMessage}`, {
        error,
      });

      await repo.markUploadFailed(uploadId, errorMessage);

      if (historyId) {
        await adminImportHistoryService.failImportHistory(historyId, errorMessage);
      }
    } finally {
      if (fs.existsSync(tempFilePath)) {
        await fs.promises
          .unlink(tempFilePath)
          .catch((e: any) => logger.warn(`[MobileIngest] Cleanup failed: ${e.message}`));
      }
    }
  }
}

const mobileIngestService = new MobileIngestService();
export default mobileIngestService;
module.exports = mobileIngestService;
module.exports.default = mobileIngestService;
