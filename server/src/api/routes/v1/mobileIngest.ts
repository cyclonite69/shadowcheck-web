import { Router, Request, Response } from 'express';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import logger from '../../../logging/logger';
const mobileIngestService = require('../../../services/mobileIngestService');

const router = Router();

// Infrastructure Constants
const S3_BUCKET = process.env.S3_BACKUP_BUCKET || 'dbcoopers-briefcase-161020170158';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const UPLOAD_PREFIX = 'uploads';
const MAX_FILE_SIZE = 524288000; // 500MB
const PRESIGNED_EXPIRY = 900; // 15 minutes

const s3Client = new S3Client({ region: S3_REGION });

/**
 * Validates the SHADOWCHECK_API_KEY from the Authorization header.
 */
const validateApiKey = (req: Request, res: Response): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return false;
  }

  const providedKey = authHeader.substring(7); // "Bearer "
  const serverKey = process.env.SHADOWCHECK_API_KEY;

  if (!serverKey || providedKey !== serverKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
};

/**
 * POST /api/v1/ingest/request-upload
 * Generates a presigned S3 URL for mobile SQLite upload.
 */
router.post('/request-upload', async (req: Request, res: Response) => {
  if (!validateApiKey(req, res)) return;

  const { fileName, case_id, filesize } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required' });
  }

  if (filesize && filesize > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File size exceeds 500MB limit' });
  }

  const uploadId = randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const folder = case_id || 'default';
  const s3Key = `${UPLOAD_PREFIX}/${folder}/${dateStr}/${uploadId}-${fileName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      ContentType: 'application/x-sqlite3',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_EXPIRY });
    const expires_at = new Date(Date.now() + PRESIGNED_EXPIRY * 1000).toISOString();

    logger.info(`[Ingest] Generated presigned URL for upload: ${uploadId}`, { s3Key });

    res.json({
      uploadUrl,
      s3Key,
      uploadId,
      expires_at,
    });
  } catch (err: any) {
    logger.error('[Ingest] Failed to generate presigned URL', { error: err.message });
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

/**
 * POST /api/v1/ingest/complete
 * Verifies the upload was successful and queues for ETL.
 */
router.post('/complete', async (req: Request, res: Response) => {
  if (!validateApiKey(req, res)) return;

  const {
    uploadId,
    s3Key,
    sourceTag,
    deviceModel,
    deviceId,
    osVersion,
    appVersion,
    batteryLevel,
    storageFreeGb,
    extraMetadata,
  } = req.body;

  if (!s3Key) {
    return res.status(400).json({ error: 's3Key is required' });
  }

  const tag = sourceTag || deviceId || 'mobile_upload';

  try {
    // Verify object exists in S3
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
      })
    );

    logger.info(`[Ingest] Upload complete verification successful: ${uploadId}`, { s3Key });

    // Record the upload and metadata
    const dbId = await mobileIngestService.recordUpload({
      s3Key,
      sourceTag: tag,
      deviceModel,
      deviceId,
      osVersion,
      appVersion,
      batteryLevel,
      storageFreeGb,
      extraMetadata,
    });

    // Fire off the background processing
    void mobileIngestService.processUpload(dbId);

    res.json({
      status: 'queued',
      uploadId,
      dbId,
      s3Key,
      sourceTag: tag,
    });
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Upload not found in S3 storage' });
    }
    logger.error('[Ingest] Verification failed', { error: err.message, s3Key });
    res.status(500).json({ error: 'Failed to verify upload' });
  }
});

export default router;
