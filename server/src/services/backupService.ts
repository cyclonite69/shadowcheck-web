import path from 'path';
import fs from 'fs/promises';
import logger from '../logging/logger';
import { resolveBackupScope } from './backup/backupUtils';
import { detectBackupSource } from './backup/sourceDetector';
import {
  generateBackupTimestamp,
  resolveBackupDirectory,
  pruneOldBackups,
} from './backup/fileManager';
import {
  buildBackupPgEnv,
  resolvePgToolPath,
  dumpPostgresDatabase,
} from './backup/postgresToolchain';
import {
  getConfiguredS3BackupBucket,
  uploadBackupsToS3,
  listBackupsFromS3,
  deleteBackupFromS3,
} from './backup/s3Operations';

/**
 * Orchestrate complete PostgreSQL backup workflow:
 * 1. Setup: resolve configuration, prepare directories
 * 2. Dump: execute pg_dump and pg_dumpall
 * 3. Verify: validate backup integrity
 * 4. Prune: remove old local backups
 * 5. Upload (optional): push to S3 if requested
 */
export const runPostgresBackup = async (options: { uploadToS3?: boolean } = {}): Promise<any> => {
  const { uploadToS3: shouldUploadToS3 = false } = options;

  // Setup phase
  logger.info('[Backup] Starting PostgreSQL backup orchestration');
  const backupDir = await resolveBackupDirectory();
  const database = process.env.PGDATABASE || process.env.DB_NAME || 'shadowcheck_db';
  const timestamp = generateBackupTimestamp();
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);

  const dbFileName = `${database}_${timestamp}.dump`;
  const dbFilePath = path.join(backupDir, dbFileName);
  const globalsFileName = `globals_${timestamp}.sql`;
  const globalsFilePath = path.join(backupDir, globalsFileName);

  // Prepare PostgreSQL environment and tools
  const pgDumpPath = await resolvePgToolPath('pg_dump');
  const pgDumpAllPath = await resolvePgToolPath('pg_dumpall');
  const pgRestorePath = await resolvePgToolPath('pg_restore');
  const pgEnv = buildBackupPgEnv();
  const backupScope = resolveBackupScope(process.env);

  // Execute dump phase
  logger.info('[Backup] Executing PostgreSQL dump');
  const { globalsSuccess, dbBytes } = await dumpPostgresDatabase({
    dbFilePath,
    globalsFilePath,
    database,
    backupScope,
    pgDumpPath,
    pgDumpAllPath,
    pgRestorePath,
    pgEnv,
  });

  // Prune old backups
  logger.info(`[Backup] Pruning backups older than ${retentionDays} days`);
  await pruneOldBackups(backupDir, retentionDays);

  // Prepare file metadata
  const files = [{ name: dbFileName, path: dbFilePath, bytes: dbBytes, type: 'database' }];

  if (globalsSuccess) {
    const globalsStat = await fs.stat(globalsFilePath);
    if (globalsStat.size <= 0) {
      throw new Error(`Globals backup file is empty: ${globalsFilePath}`);
    }
    files.push({
      name: globalsFileName,
      path: globalsFilePath,
      bytes: globalsStat.size,
      type: 'globals',
    });
  }

  const source = detectBackupSource();

  const result: any = {
    backupDir,
    files,
    source,
    createdAt: new Date().toISOString(),
    scope: backupScope.mode,
    schemas: backupScope.schemas,
    fileName: dbFileName,
    bytes: dbBytes,
  };

  // Upload phase (optional)
  if (shouldUploadToS3) {
    try {
      logger.info('[Backup] Uploading to S3');
      const s3Uploads = await uploadBackupsToS3({
        bucket: getConfiguredS3BackupBucket(),
        files: files.map((f) => ({ name: f.name, path: f.path, type: f.type })),
        source,
      });
      result.s3 = s3Uploads;
    } catch (error: any) {
      logger.error(`[Backup] S3 upload failed: ${error.message}`);
      result.s3Error = error.message;
    }
  }

  logger.info('[Backup] PostgreSQL backup orchestration complete');
  return result;
};

/**
 * List all S3 backups
 */
export const listS3Backups = async (): Promise<any> => {
  logger.info('[Backup] Listing S3 backups');
  return await listBackupsFromS3();
};

/**
 * Delete a backup from S3
 */
export const deleteS3Backup = async (key: string): Promise<any> => {
  logger.info(`[Backup] Deleting S3 backup: ${key}`);
  return await deleteBackupFromS3(key);
};
