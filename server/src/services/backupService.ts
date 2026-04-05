import fs from 'fs/promises';
import { constants, Dirent, createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execSync } from 'child_process';
import logger from '../logging/logger';
import secretsManager from './secretsManager';
import { deleteS3BackupObject, listS3BackupObjects, uploadBackupToS3 } from './backup/awsCli';
import { resolveBackupScope, verifyBackupFile } from './backup/backupUtils';

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
  const configuredEnvironment = String(process.env.BACKUP_SOURCE_ENV || '').trim();
  const configuredInstanceId = String(process.env.EC2_INSTANCE_ID || '').trim();

  if (configuredEnvironment) {
    return {
      hostname,
      environment: configuredEnvironment,
      instanceId: configuredInstanceId || undefined,
    };
  }

  // Prefer IMDSv2, then fall back to hostname heuristics when container IMDS access is blocked.
  try {
    const instanceId = execSync(
      `TOKEN=$(curl -fsS -m 1 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null) && curl -fsS -m 1 -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null`,
      { timeout: 2000, encoding: 'utf8' }
    ).trim();
    if (instanceId && instanceId.startsWith('i-')) {
      return { hostname, environment: 'aws-ec2', instanceId };
    }
  } catch {
    // Fall through to hostname heuristics.
  }

  if (hostname.endsWith('.ec2.internal')) {
    return { hostname, environment: 'aws-ec2' };
  }

  return { hostname, environment: 'local' };
};

const getBackupDir = (): string => {
  const configured = process.env.BACKUP_DIR;
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
  }
  return path.join(repoRoot, 'backups', 'db');
};

const stamp = (): string => {
  const d = new Date();
  const pad = (n: number | string) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const pruneOldBackups = async (dir: string, days: number): Promise<void> => {
  if (!days || days <= 0) {
    return;
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  await Promise.all(
    entries
      .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith('.dump'))
      .map(async (entry: Dirent) => {
        const fullPath = path.join(dir, entry.name);
        const stat = await fs.stat(fullPath);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(fullPath);
        }
      })
  );
};

const buildPgEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
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

const buildBackupPgEnv = (): NodeJS.ProcessEnv => {
  const env = buildPgEnv();
  const preferredAdminUser = process.env.DB_ADMIN_USER || 'shadowcheck_admin';
  const adminPassword = secretsManager.get('db_admin_password') || process.env.DB_ADMIN_PASSWORD;
  const allowPasswordlessLocalAdmin =
    !adminPassword &&
    (process.env.DB_HOST || '').trim() === 'postgres' &&
    process.env.DB_SSL !== 'true';

  if (adminPassword) {
    env.PGUSER = preferredAdminUser;
    env.PGPASSWORD = adminPassword;
    logger.info(`[Backup] Using admin DB role for backup operations: ${preferredAdminUser}`);
  } else if (allowPasswordlessLocalAdmin) {
    env.PGUSER = preferredAdminUser;
    env.PGPASSWORD = '';
    logger.warn(
      `[Backup] db_admin_password not found; using passwordless local admin role for backup operations: ${preferredAdminUser}`
    );
  } else {
    logger.warn(
      '[Backup] db_admin_password not found; falling back to application DB credentials for backup'
    );
  }

  return env;
};

const resolvePgToolPath = async (toolName: string): Promise<string> => {
  const candidates = [
    process.env[`${toolName.toUpperCase()}_PATH` as keyof NodeJS.ProcessEnv] as string | undefined,
    `/usr/bin/${toolName}`,
    `/usr/local/bin/${toolName}`,
    toolName,
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    if (candidate === toolName) {
      return candidate;
    }
    try {
      await fs.access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try next candidate
    }
  }
  return toolName;
};

const isLocalComposePostgres = (): boolean =>
  (process.env.DB_HOST || '').trim() === 'postgres' && process.env.DB_SSL !== 'true';

const getLocalPostgresContainerName = (): string =>
  process.env.POSTGRES_CONTAINER || 'shadowcheck_postgres_local';

const runDockerizedLocalPgDump = async (options: {
  dbFilePath: string;
  globalsFilePath: string;
  database: string;
  backupScope: ReturnType<typeof resolveBackupScope>;
  adminUser: string;
}): Promise<{ globalsSuccess: boolean }> => {
  const { dbFilePath, globalsFilePath, database, backupScope, adminUser } = options;
  const containerName = getLocalPostgresContainerName();

  const streamDockerCommandToFile = async (
    args: string[],
    outputPath: string,
    label: string
  ): Promise<void> =>
    await new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const child = spawn('docker', ['exec', containerName, ...args], {
        env: process.env,
      });
      let stderr = '';

      child.stdout.pipe(output);
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        logger.debug(`[Backup] ${label} stderr: ${data.toString().trim()}`);
      });
      child.on('error', (err: Error) => {
        output.destroy();
        reject(err);
      });
      child.on('close', (code: number | null) => {
        output.end();
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(new Error(`${label} failed (code ${code}): ${stderr}`));
        }
      });
    });

  logger.info(`[Backup] Using local Postgres container tools from ${containerName}`);

  let globalsSuccess = false;
  logger.info(`[Backup] Starting globals dump to ${globalsFilePath}`);
  try {
    await streamDockerCommandToFile(
      ['pg_dumpall', '--globals-only', '-U', adminUser],
      globalsFilePath,
      'pg_dumpall globals'
    );
    globalsSuccess = true;
  } catch (err: any) {
    logger.warn(`[Backup] Globals dump failed, continuing with data-only backup: ${err.message}`);
  }

  logger.info(`[Backup] Starting main database dump to ${dbFilePath}`);
  const args = [
    'pg_dump',
    '-U',
    adminUser,
    '-d',
    database,
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--blobs',
  ];
  if (backupScope.mode === 'schema_subset' && backupScope.schemas.length > 0) {
    backupScope.schemas.forEach((schema) => {
      args.push('--schema', schema);
    });
    logger.info(`[Backup] Running schema-scoped backup: ${backupScope.schemas.join(', ')}`);
  } else {
    logger.info('[Backup] Running full-database backup');
  }

  await streamDockerCommandToFile(args, dbFilePath, 'pg_dump');
  return { globalsSuccess };
};

const getConfiguredS3BackupBucket = (): string => {
  const bucketName = process.env.S3_BACKUP_BUCKET?.trim();
  if (!bucketName) {
    throw new Error(
      'S3_BACKUP_BUCKET is not configured. Set it via environment or AWS SSM Parameter Store before using S3 backup operations.'
    );
  }
  return bucketName;
};

export const runPostgresBackup = async (options: { uploadToS3?: boolean } = {}): Promise<any> => {
  const { uploadToS3: shouldUploadToS3 = false } = options;
  const backupDir = getBackupDir();
  const database = process.env.PGDATABASE || process.env.DB_NAME || 'shadowcheck_db';
  const timestamp = stamp();

  const dbFileName = `${database}_${timestamp}.dump`;
  const dbFilePath = path.join(backupDir, dbFileName);

  const globalsFileName = `globals_${timestamp}.sql`;
  const globalsFilePath = path.join(backupDir, globalsFileName);

  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);

  await fs.mkdir(backupDir, { recursive: true });

  const pgDumpPath = await resolvePgToolPath('pg_dump');
  const pgDumpAllPath = await resolvePgToolPath('pg_dumpall');
  const pgRestorePath = await resolvePgToolPath('pg_restore');
  const pgEnv = buildBackupPgEnv();
  const backupScope = resolveBackupScope(process.env);

  if (isLocalComposePostgres()) {
    const adminUser = pgEnv.PGUSER || process.env.DB_ADMIN_USER || 'shadowcheck_admin';
    const { globalsSuccess } = await runDockerizedLocalPgDump({
      dbFilePath,
      globalsFilePath,
      database,
      backupScope,
      adminUser,
    });

    await pruneOldBackups(backupDir, retentionDays);

    const dbBytes = await verifyBackupFile(dbFilePath, pgRestorePath);
    const source = getBackupSource();
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

    logger.info(
      `[Backup] Multi-stage backup complete. Data: ${dbBytes} bytes. Globals: ${globalsSuccess ? 'Success' : 'Skipped'}`
    );

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

    if (shouldUploadToS3) {
      try {
        result.s3 = [];
        const dbUpload = (await uploadBackupToS3(
          getConfiguredS3BackupBucket(),
          dbFilePath,
          dbFileName,
          source
        )) as any;
        result.s3.push({ ...dbUpload, type: 'database' });

        if (globalsSuccess) {
          const globalsUpload = (await uploadBackupToS3(
            getConfiguredS3BackupBucket(),
            globalsFilePath,
            globalsFileName,
            source
          )) as any;
          result.s3.push({ ...globalsUpload, type: 'globals' });
        }
      } catch (error: any) {
        logger.error(`[Backup] S3 upload failed: ${error.message}`);
        result.s3Error = error.message;
      }
    }

    return result;
  }

  // 1. Dump Globals (Roles, Users, etc) - OPTIONAL
  let globalsSuccess = false;
  logger.info(`[Backup] Starting globals dump to ${globalsFilePath}`);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(pgDumpAllPath, ['--globals-only', '--file', globalsFilePath], {
        env: pgEnv,
      });
      let stderr = '';
      child.stderr.on('data', (data: Buffer) => (stderr += data.toString()));
      child.on('error', reject);
      child.on('close', (code: number | null) => {
        if (code === 0) resolve(undefined);
        else reject(new Error(`pg_dumpall globals failed: ${stderr}`));
      });
    });
    globalsSuccess = true;
  } catch (err: any) {
    logger.warn(`[Backup] Globals dump failed, continuing with data-only backup: ${err.message}`);
  }

  // 2. Dump Main Database - MANDATORY
  logger.info(`[Backup] Starting main database dump to ${dbFilePath}`);
  await new Promise((resolve, reject) => {
    const args = [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--blobs',
      '--file',
      dbFilePath,
    ];
    if (backupScope.mode === 'schema_subset' && backupScope.schemas.length > 0) {
      backupScope.schemas.forEach((schema) => {
        args.push('--schema', schema);
      });
      logger.info(`[Backup] Running schema-scoped backup: ${backupScope.schemas.join(', ')}`);
    } else {
      logger.info('[Backup] Running full-database backup');
    }
    const child = spawn(pgDumpPath, args, { env: pgEnv });
    let stderr = '';
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
      logger.debug(`[Backup] pg_dump stderr: ${data.toString().trim()}`);
    });
    child.on('error', (err: Error) => {
      logger.error(`[Backup] pg_dump process error: ${err.message}`);
      reject(err);
    });
    child.on('close', (code: number | null) => {
      if (code === 0) resolve(undefined);
      else {
        logger.error(`[Backup] pg_dump failed with code ${code}. Stderr: ${stderr}`);
        reject(new Error(`pg_dump failed (code ${code}): ${stderr}`));
      }
    });
  });

  await pruneOldBackups(backupDir, retentionDays);

  const dbBytes = await verifyBackupFile(dbFilePath, pgRestorePath);
  const source = getBackupSource();

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

  logger.info(
    `[Backup] Multi-stage backup complete. Data: ${dbBytes} bytes. Globals: ${globalsSuccess ? 'Success' : 'Skipped'}`
  );

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

  // 3. Upload to S3 if requested
  if (shouldUploadToS3) {
    try {
      result.s3 = [];
      const dbUpload = (await uploadBackupToS3(
        getConfiguredS3BackupBucket(),
        dbFilePath,
        dbFileName,
        source
      )) as any;
      result.s3.push({ ...dbUpload, type: 'database' });

      if (globalsSuccess) {
        const globalsUpload = (await uploadBackupToS3(
          getConfiguredS3BackupBucket(),
          globalsFilePath,
          globalsFileName,
          source
        )) as any;
        result.s3.push({ ...globalsUpload, type: 'globals' });
      }
    } catch (error: any) {
      logger.error(`[Backup] S3 upload failed: ${error.message}`);
      result.s3Error = error.message;
    }
  }

  return result;
};

export const listS3Backups = async (): Promise<any> => {
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

export const deleteS3Backup = async (key: string): Promise<any> => {
  const bucketName = getConfiguredS3BackupBucket();
  await deleteS3BackupObject(bucketName, key);
  logger.info(`[Backup] S3 backup deleted: ${key}`);
  return { deleted: true, key };
};
