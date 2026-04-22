import { Router, Request, Response } from 'express';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import logger from '../../../logging/logger';
import secretsManager from '../../../services/secretsManager';
const mobileIngestService = require('../../../services/mobileIngestService');

const router = Router();

// Configuration Getters
const getS3Config = () => ({
  bucket:
    secretsManager.get('s3_backup_bucket') ||
    process.env.S3_BACKUP_BUCKET ||
    'dbcoopers-briefcase-161020170158',
  region: secretsManager.get('aws_region') || process.env.AWS_REGION || 'us-east-1',
});

const getS3Client = () => new S3Client({ region: getS3Config().region });

const UPLOAD_PREFIX = 'uploads';
const MAX_FILE_SIZE = 524288000; // 500MB
const PRESIGNED_EXPIRY = 900; // 15 minutes

/**
 * Validates the SHADOWCHECK_API_KEY from the Authorization header.
 */
const validateApiKey = (req: Request, res: Response): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.warn(`[Ingest] Missing Authorization header from ${req.ip}`);
    res.status(401).json({ error: 'Missing Authorization header' });
    return false;
  }
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn(`[Ingest] Invalid Authorization header format from ${req.ip}`);
    res.status(401).json({ error: 'Invalid Authorization header format' });
    return false;
  }

  const providedKey = authHeader.substring(7); // \"Bearer \"
  const serverKey = secretsManager.get('shadowcheck_api_key') || process.env.SHADOWCHECK_API_KEY;

  if (!serverKey) {
    logger.error('[Ingest] SHADOWCHECK_API_KEY not found in secrets or env');
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  if (providedKey !== serverKey) {
    const maskedProvided =
      providedKey.substring(0, 4) + '...' + providedKey.substring(providedKey.length - 4);
    const maskedServer =
      serverKey.substring(0, 4) + '...' + serverKey.substring(serverKey.length - 4);
    logger.warn(
      `[Ingest] API key mismatch from ${req.ip}. Provided: ${maskedProvided} (${providedKey.length}), Expected: ${maskedServer} (${serverKey.length})`
    );
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
  const { bucket } = getS3Config();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const folder = case_id || 'default';
  const s3Key = `${UPLOAD_PREFIX}/${folder}/${dateStr}/${uploadId}-${fileName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: 'application/x-sqlite3',
    });

    const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: PRESIGNED_EXPIRY });
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
 * Verifies the upload was successful and records it for manual ETL.
 */
router.post('/complete', async (req: Request, res: Response) => {
  if (!validateApiKey(req, res)) return;

  const {
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

  const { bucket } = getS3Config();
  const tag = sourceTag || deviceId || 'mobile_upload';
  const metadata = extraMetadata && typeof extraMetadata === 'object' ? extraMetadata : {};

  try {
    // Verify object exists in S3
    await getS3Client().send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      })
    );

    logger.info('[Ingest] Upload complete verification successful', { s3Key });

    // Record the upload and metadata
    const dbId = await mobileIngestService.recordUpload({
      s3Key,
      sourceTag: tag,
      status: 'pending',
      historyStatus: 'pending',
      deviceModel,
      deviceId,
      osVersion,
      appVersion,
      batteryLevel,
      storageFreeGb,
      extraMetadata: metadata,
    });

    res.json({
      ok: true,
      status: 'pending',
      uploadId: dbId,
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
