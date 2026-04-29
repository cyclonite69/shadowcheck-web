import fs from 'fs/promises';
import { constants, createWriteStream } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import logger from '../../logging/logger';
import secretsManager from '../secretsManager';
import { verifyBackupFile } from './backupUtils';
import type { BackupScope } from './backupUtils';

/**
 * PostgreSQL environment configuration
 */
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

/**
 * PostgreSQL environment with admin credentials for backup operations
 */
export const buildBackupPgEnv = (): NodeJS.ProcessEnv => {
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

/**
 * Resolve PostgreSQL tool (pg_dump, pg_dumpall, pg_restore) path.
 * Checks env variable, then /usr/bin, /usr/local/bin, then assumes system PATH.
 */
export const resolvePgToolPath = async (toolName: string): Promise<string> => {
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
      logger.debug(`[Backup] Resolved ${toolName} to ${candidate}`);
      return candidate;
    } catch {
      // Try next candidate
    }
  }
  return toolName;
};

/**
 * Spawn a process and pipe stdout to file, collecting stderr.
 */
const spawnToFile = async (
  command: string,
  args: string[],
  outputPath: string,
  env: NodeJS.ProcessEnv,
  label: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const child = spawn(command, args, { env });
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
        resolve();
      } else {
        reject(new Error(`${label} failed (code ${code}): ${stderr}`));
      }
    });
  });

/**
 * Check if backup target is local Docker Compose PostgreSQL
 */
export const isLocalComposePostgres = (): boolean =>
  (process.env.DB_HOST || '').trim() === 'postgres' && process.env.DB_SSL !== 'true';

/**
 * Get local Docker Postgres container name
 */
const getLocalPostgresContainerName = (): string =>
  process.env.POSTGRES_CONTAINER || 'shadowcheck_postgres_local';

/**
 * Run pg_dump and pg_dumpall via Docker container for local Compose setup
 */
export const runDockerizedPgDump = async (options: {
  dbFilePath: string;
  globalsFilePath: string;
  database: string;
  backupScope: BackupScope;
  adminUser: string;
}): Promise<{ globalsSuccess: boolean }> => {
  const { dbFilePath, globalsFilePath, database, backupScope, adminUser } = options;
  const containerName = getLocalPostgresContainerName();

  logger.info(`[Backup] Using local Postgres container tools from ${containerName}`);

  let globalsSuccess = false;
  logger.info(`[Backup] Starting globals dump to ${globalsFilePath}`);
  try {
    await spawnToFile(
      'docker',
      ['exec', containerName, 'pg_dumpall', '--globals-only', '-U', adminUser],
      globalsFilePath,
      process.env,
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
    backupScope.schemas.forEach((schema: string) => {
      args.push('--schema', schema);
    });
    logger.info(`[Backup] Running schema-scoped backup: ${backupScope.schemas.join(', ')}`);
  } else {
    logger.info('[Backup] Running full-database backup');
  }

  await spawnToFile('docker', ['exec', containerName, ...args], dbFilePath, process.env, 'pg_dump');
  return { globalsSuccess };
};

/**
 * Run pg_dump and pg_dumpall natively for remote PostgreSQL
 */
export const runNativePgDump = async (options: {
  pgDumpPath: string;
  pgDumpAllPath: string;
  dbFilePath: string;
  globalsFilePath: string;
  database: string;
  backupScope: BackupScope;
  pgEnv: NodeJS.ProcessEnv;
}): Promise<{ globalsSuccess: boolean }> => {
  const { pgDumpPath, pgDumpAllPath, dbFilePath, globalsFilePath, database, backupScope, pgEnv } =
    options;

  let globalsSuccess = false;
  logger.info(`[Backup] Starting globals dump to ${globalsFilePath}`);
  try {
    await spawnToFile(
      pgDumpAllPath,
      ['--globals-only', '--file', globalsFilePath],
      globalsFilePath,
      pgEnv,
      'pg_dumpall globals'
    );
    globalsSuccess = true;
  } catch (err: any) {
    logger.warn(`[Backup] Globals dump failed, continuing with data-only backup: ${err.message}`);
  }

  logger.info(`[Backup] Starting main database dump to ${dbFilePath}`);
  const args = [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--blobs',
    '--file',
    dbFilePath,
  ];

  if (backupScope.mode === 'schema_subset' && backupScope.schemas.length > 0) {
    backupScope.schemas.forEach((schema: string) => {
      args.push('--schema', schema);
    });
    logger.info(`[Backup] Running schema-scoped backup: ${backupScope.schemas.join(', ')}`);
  } else {
    logger.info('[Backup] Running full-database backup');
  }

  await spawnToFile(pgDumpPath, args, dbFilePath, pgEnv, 'pg_dump');
  return { globalsSuccess };
};

/**
 * Perform complete PostgreSQL dump and validation
 */
export const dumpPostgresDatabase = async (options: {
  dbFilePath: string;
  globalsFilePath: string;
  database: string;
  backupScope: BackupScope;
  pgDumpPath: string;
  pgDumpAllPath: string;
  pgRestorePath: string;
  pgEnv: NodeJS.ProcessEnv;
}): Promise<{ globalsSuccess: boolean; dbBytes: number }> => {
  const {
    dbFilePath,
    globalsFilePath,
    database,
    backupScope,
    pgDumpPath,
    pgDumpAllPath,
    pgRestorePath,
    pgEnv,
  } = options;

  let globalsSuccess = false;

  if (isLocalComposePostgres()) {
    const adminUser = pgEnv.PGUSER || process.env.DB_ADMIN_USER || 'shadowcheck_admin';
    ({ globalsSuccess } = await runDockerizedPgDump({
      dbFilePath,
      globalsFilePath,
      database,
      backupScope,
      adminUser,
    }));
  } else {
    ({ globalsSuccess } = await runNativePgDump({
      pgDumpPath,
      pgDumpAllPath,
      dbFilePath,
      globalsFilePath,
      database,
      backupScope,
      pgEnv,
    }));
  }

  const dbBytes = await verifyBackupFile(dbFilePath, pgRestorePath);

  logger.info(
    `[Backup] Multi-stage backup complete. Data: ${dbBytes} bytes. Globals: ${globalsSuccess ? 'Success' : 'Skipped'}`
  );

  return { globalsSuccess, dbBytes };
};
