const fs = require('fs').promises;
const { constants } = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../logging/logger');
const secretsManager = require('./secretsManager');

export {};

const repoRoot = '/app';

const getBackupDir = () => {
  const configured = process.env.BACKUP_DIR;
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
  }
  return path.join(repoRoot, 'backups', 'db');
};

const stamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const pruneOldBackups = async (dir, days) => {
  if (!days || days <= 0) {
    return;
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.dump'))
      .map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const stat = await fs.stat(fullPath);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(fullPath);
        }
      })
  );
};

const buildPgEnv = () => {
  const env = { ...process.env };
  if (!env.PGHOST && process.env.DB_HOST) {
    env.PGHOST = process.env.DB_HOST;
  }
  if (!env.PGPORT && process.env.DB_PORT) {
    env.PGPORT = String(process.env.DB_PORT);
  }
  if (!env.PGUSER && process.env.DB_USER) {
    env.PGUSER = process.env.DB_USER;
  }
  if (!env.PGDATABASE && process.env.DB_NAME) {
    env.PGDATABASE = process.env.DB_NAME;
  }
  if (!env.PGPASSWORD) {
    const secret = secretsManager.get('db_password');
    if (secret) {
      env.PGPASSWORD = secret;
    }
  }
  return env;
};

const resolvePgDumpPath = async () => {
  const candidates = [
    process.env.PG_DUMP_PATH,
    '/usr/bin/pg_dump',
    '/usr/local/bin/pg_dump',
    'pg_dump',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'pg_dump') {
      return candidate;
    }
    try {
      await fs.access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try next candidate
    }
  }
  return 'pg_dump';
};

const uploadToS3 = async (filePath, fileName) => {
  const bucketName = process.env.S3_BACKUP_BUCKET || 'dbcoopers-briefcase-161020170158';
  const s3Key = `backups/${fileName}`;

  logger.info(`[Backup] Uploading to S3: s3://${bucketName}/${s3Key}`);

  return new Promise((resolve, reject) => {
    const child = spawn('aws', [
      's3',
      'cp',
      filePath,
      `s3://${bucketName}/${s3Key}`,
      '--storage-class',
      'STANDARD_IA',
    ]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        logger.info(`[Backup] S3 upload completed: ${stdout.trim()}`);
        resolve({
          bucket: bucketName,
          key: s3Key,
          url: `s3://${bucketName}/${s3Key}`,
        });
      } else {
        reject(new Error(stderr || `AWS S3 upload failed with code ${code}`));
      }
    });
  });
};

const runPostgresBackup = async (options: { uploadToS3?: boolean } = {}) => {
  const { uploadToS3: shouldUploadToS3 = false } = options;
  const backupDir = getBackupDir();
  const database = process.env.PGDATABASE || process.env.DB_NAME || 'postgres';
  const fileName = `${database}_${stamp()}.dump`;
  const filePath = path.join(backupDir, fileName);
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 14;

  await fs.mkdir(backupDir, { recursive: true });

  logger.info(`[Backup] Starting pg_dump to ${filePath}`);

  const pgDumpPath = await resolvePgDumpPath();

  await new Promise((resolve, reject) => {
    const child = spawn(
      pgDumpPath,
      ['--format=custom', '--no-owner', '--no-privileges', '--file', filePath],
      { env: buildPgEnv() }
    );

    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(stderr || `pg_dump exited with code ${code}`));
      }
    });
  });

  await pruneOldBackups(backupDir, retentionDays);

  const stat = await fs.stat(filePath);
  logger.info(`[Backup] Completed pg_dump (${stat.size} bytes)`);

  const result: any = {
    backupDir,
    fileName,
    filePath,
    bytes: stat.size,
  };

  // Upload to S3 if requested
  if (shouldUploadToS3) {
    try {
      const s3Result = await uploadToS3(filePath, fileName);
      result.s3 = s3Result;
    } catch (error: any) {
      logger.error(`[Backup] S3 upload failed: ${error.message}`);
      result.s3Error = error.message;
    }
  }

  return result;
};

const listS3Backups = async () => {
  const bucketName = process.env.S3_BACKUP_BUCKET || 'dbcoopers-briefcase-161020170158';

  logger.info(`[Backup] Listing S3 backups from s3://${bucketName}/backups/`);

  return new Promise((resolve, reject) => {
    const child = spawn('aws', [
      's3api',
      'list-objects-v2',
      '--bucket',
      bucketName,
      '--prefix',
      'backups/',
      '--query',
      'Contents[?Size>`0`].{Key:Key,Size:Size,LastModified:LastModified}',
      '--output',
      'json',
    ]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const backups = JSON.parse(stdout || '[]');
          resolve(
            backups.map((backup: any) => ({
              key: backup.Key,
              fileName: backup.Key.replace('backups/', ''),
              size: backup.Size,
              lastModified: backup.LastModified,
              url: `s3://${bucketName}/${backup.Key}`,
            }))
          );
        } catch (parseError) {
          reject(new Error(`Failed to parse S3 response: ${parseError}`));
        }
      } else {
        reject(new Error(stderr || `AWS S3 list failed with code ${code}`));
      }
    });
  });
};

const deleteS3Backup = async (key: string) => {
  const bucketName = process.env.S3_BACKUP_BUCKET || 'dbcoopers-briefcase-161020170158';

  logger.info(`[Backup] Deleting S3 backup: s3://${bucketName}/${key}`);

  return new Promise((resolve, reject) => {
    const child = spawn('aws', ['s3api', 'delete-object', '--bucket', bucketName, '--key', key]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        logger.info(`[Backup] S3 backup deleted: ${key}`);
        resolve({ deleted: true, key });
      } else {
        reject(new Error(stderr || `AWS S3 delete failed with code ${code}`));
      }
    });
  });
};

module.exports = { runPostgresBackup, listS3Backups, deleteS3Backup };
