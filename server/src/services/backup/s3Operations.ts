import logger from '../../logging/logger';
import { deleteS3BackupObject, listS3BackupObjects, uploadBackupToS3 } from './awsCli';
import type { BackupSource } from './sourceDetector';

/**
 * Resolve configured S3 backup bucket name
 */
export const getConfiguredS3BackupBucket = (): string => {
  const bucketName = process.env.S3_BACKUP_BUCKET?.trim();
  if (!bucketName) {
    throw new Error(
      'S3_BACKUP_BUCKET is not configured. Set it via environment or AWS SSM Parameter Store before using S3 backup operations.'
    );
  }
  return bucketName;
};

/**
 * Upload backup files to S3
 */
export const uploadBackupsToS3 = async (options: {
  bucket: string;
  files: Array<{ name: string; path: string; type: string }>;
  source: BackupSource;
}): Promise<any[]> => {
  const { bucket, files, source } = options;
  const results = [];

  for (const file of files) {
    try {
      const upload = await uploadBackupToS3(bucket, file.path, file.name, source);
      results.push({ ...upload, type: file.type });
      logger.info(`[Backup] Uploaded to S3: ${file.name}`);
    } catch (error: any) {
      logger.error(`[Backup] S3 upload failed for ${file.name}: ${error.message}`);
      throw error;
    }
  }

  return results;
};

/**
 * List S3 backups with metadata
 */
export const listBackupsFromS3 = async (): Promise<any[]> => {
  const bucketName = getConfiguredS3BackupBucket();
  const backups = await listS3BackupObjects(bucketName);

  return backups.map((backup: any) => {
    const parts = backup.Key.replace('backups/', '').split('/');
    const hasEnvPrefix = parts.length > 1;
    return {
      key: backup.Key,
      fileName: hasEnvPrefix ? parts.slice(1).join('/') : parts[0],
      sourceEnv: hasEnvPrefix ? parts[0] : 'unknown',
      size: backup.Size,
      lastModified: backup.LastModified,
      url: `s3://${bucketName}/${backup.Key}`,
    };
  });
};

/**
 * Delete a backup from S3
 */
export const deleteBackupFromS3 = async (key: string): Promise<any> => {
  const bucketName = getConfiguredS3BackupBucket();
  await deleteS3BackupObject(bucketName, key);
  logger.info(`[Backup] S3 backup deleted: ${key}`);
  return { deleted: true, key };
};
