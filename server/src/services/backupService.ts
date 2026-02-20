const fs = require('fs').promises;
const { constants } = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const logger = require('../logging/logger');
const secretsManager = require('./secretsManager').default;
const { getAwsConfig } = require('./awsService');

export {};

const repoRoot = '/app';

/**
 * Detect backup source environment.
 * Returns metadata identifying where the backup was created.
 */
const getBackupSource = (): {
  hostname: string;
  environment: string;
  instanceId?: string;
} => {
  const hostname = os.hostname();

  // Check if running on EC2 by querying IMDS (non-blocking, cached)
  try {
    const instanceId = execSync(
      'curl -s --connect-timeout 1 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null',
      { timeout: 2000, encoding: 'utf8' }
    ).trim();
    if (instanceId && instanceId.startsWith('i-')) {
      return { hostname, environment: 'aws-ec2', instanceId };
    }
  } catch {
    // Not on EC2
  }

  return { hostname, environment: 'local' };
};

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

const uploadToS3 = async (
  filePath,
  fileName,
  source?: { hostname: string; environment: string; instanceId?: string }
) => {
  const bucketName = process.env.S3_BACKUP_BUCKET || 'dbcoopers-briefcase-161020170158';
  const env_label = source?.environment || 'unknown';
  const s3Key = `backups/${env_label}/${fileName}`;

  logger.info(`[Backup] Uploading to S3: s3://${bucketName}/${s3Key}`);

  const awsConfig = await getAwsConfig();
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: `/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}`,
  };

  if (awsConfig.hasExplicitCredentials) {
    env.AWS_ACCESS_KEY_ID = awsConfig.credentials.accessKeyId;
    env.AWS_SECRET_ACCESS_KEY = awsConfig.credentials.secretAccessKey;
    if (awsConfig.credentials.sessionToken) {
      env.AWS_SESSION_TOKEN = awsConfig.credentials.sessionToken;
    }
  }
  if (awsConfig.region) {
    env.AWS_DEFAULT_REGION = awsConfig.region;
  }

  return new Promise((resolve, reject) => {
    const metadataStr = [
      `source-env=${env_label}`,
      `source-host=${source?.hostname || os.hostname()}`,
      source?.instanceId ? `instance-id=${source.instanceId}` : null,
      `created-at=${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join(',');

    const child = spawn(
      'aws',
      [
        's3',
        'cp',
        filePath,
        `s3://${bucketName}/${s3Key}`,
        '--storage-class',
        'STANDARD_IA',
        '--metadata',
        metadataStr,
      ],
      { env }
    );

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
  const database = process.env.PGDATABASE || process.env.DB_NAME || 'shadowcheck_db';
  const timestamp = stamp();

  const dbFileName = `${database}_${timestamp}.dump`;
  const dbFilePath = path.join(backupDir, dbFileName);

  const globalsFileName = `globals_${timestamp}.sql`;
  const globalsFilePath = path.join(backupDir, globalsFileName);

  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 14;

  await fs.mkdir(backupDir, { recursive: true });

  const pgDumpPath = await resolvePgDumpPath();
  const pgDumpAllPath = pgDumpPath.replace('pg_dump', 'pg_dumpall');
  const pgEnv = buildPgEnv();

  // 1. Dump Globals (Roles, Users, etc)
  logger.info(`[Backup] Starting globals dump to ${globalsFilePath}`);
  await new Promise((resolve, reject) => {
    const child = spawn(pgDumpAllPath, ['--globals-only', '--file', globalsFilePath], {
      env: pgEnv,
    });
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      logger.debug(`[Backup] pg_dumpall stderr: ${data.toString().trim()}`);
    });
    child.on('error', (err) => {
      logger.error(`[Backup] pg_dumpall process error: ${err.message}`);
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else {
        logger.error(`[Backup] pg_dumpall failed with code ${code}. Stderr: ${stderr}`);
        reject(new Error(`pg_dumpall globals failed (code ${code}): ${stderr}`));
      }
    });
  });

  // 2. Dump Main Database
  logger.info(`[Backup] Starting main database dump to ${dbFilePath}`);
  await new Promise((resolve, reject) => {
    const child = spawn(
      pgDumpPath,
      ['--format=custom', '--no-owner', '--no-privileges', '--blobs', '--file', dbFilePath],
      { env: pgEnv }
    );
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      logger.debug(`[Backup] pg_dump stderr: ${data.toString().trim()}`);
    });
    child.on('error', (err) => {
      logger.error(`[Backup] pg_dump process error: ${err.message}`);
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(undefined);
      else {
        logger.error(`[Backup] pg_dump failed with code ${code}. Stderr: ${stderr}`);
        reject(new Error(`pg_dump failed (code ${code}): ${stderr}`));
      }
    });
  });

  await pruneOldBackups(backupDir, retentionDays);

  const dbStat = await fs.stat(dbFilePath);
  const globalsStat = await fs.stat(globalsFilePath);
  const source = getBackupSource();

  logger.info(
    `[Backup] Multi-stage backup complete. DB: ${dbStat.size} bytes, Globals: ${globalsStat.size} bytes.`
  );

  const result: any = {
    backupDir,
    files: [
      { name: dbFileName, path: dbFilePath, bytes: dbStat.size, type: 'database' },
      { name: globalsFileName, path: globalsFilePath, bytes: globalsStat.size, type: 'globals' },
    ],
    source,
    createdAt: new Date().toISOString(),
  };

  // 3. Upload to S3 if requested
  if (shouldUploadToS3) {
    try {
      result.s3 = [];
      const dbUpload = await uploadToS3(dbFilePath, dbFileName, source);
      result.s3.push({ ...dbUpload, type: 'database' });

      const globalsUpload = await uploadToS3(globalsFilePath, globalsFileName, source);
      result.s3.push({ ...globalsUpload, type: 'globals' });
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

  const awsConfig = await getAwsConfig();
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: `/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}`,
  };

  if (awsConfig.hasExplicitCredentials) {
    env.AWS_ACCESS_KEY_ID = awsConfig.credentials.accessKeyId;
    env.AWS_SECRET_ACCESS_KEY = awsConfig.credentials.secretAccessKey;
    if (awsConfig.credentials.sessionToken) {
      env.AWS_SESSION_TOKEN = awsConfig.credentials.sessionToken;
    }
  }
  if (awsConfig.region) {
    env.AWS_DEFAULT_REGION = awsConfig.region;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      'aws',
      [
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
      ],
      { env }
    );

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
            backups.map((backup: any) => {
              // Parse source from key: backups/<env>/<filename> or legacy backups/<filename>
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
            })
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

  const awsConfig = await getAwsConfig();
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: `/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}`,
  };

  if (awsConfig.hasExplicitCredentials) {
    env.AWS_ACCESS_KEY_ID = awsConfig.credentials.accessKeyId;
    env.AWS_SECRET_ACCESS_KEY = awsConfig.credentials.secretAccessKey;
    if (awsConfig.credentials.sessionToken) {
      env.AWS_SESSION_TOKEN = awsConfig.credentials.sessionToken;
    }
  }
  if (awsConfig.region) {
    env.AWS_DEFAULT_REGION = awsConfig.region;
  }

  return new Promise((resolve, reject) => {
    const child = spawn('aws', ['s3api', 'delete-object', '--bucket', bucketName, '--key', key], {
      env,
    });

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
