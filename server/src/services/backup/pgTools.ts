import fs from 'fs/promises';
import { constants, createWriteStream } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import logger from '../../logging/logger';
import { resolveBackupScope } from './backupUtils';

export const pruneOldBackups = async (dir: string, days: number): Promise<void> => {
  if (!days || days <= 0) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.dump'))
      .map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const stat = await fs.stat(fullPath);
        if (stat.mtimeMs < cutoff) await fs.unlink(fullPath);
      })
  );
};

export const resolvePgToolPath = async (toolName: string): Promise<string> => {
  const candidates = [
    process.env[`${toolName.toUpperCase()}_PATH` as keyof NodeJS.ProcessEnv] as string | undefined,
    `/usr/bin/${toolName}`,
    `/usr/local/bin/${toolName}`,
    toolName,
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    if (candidate === toolName) return candidate;
    try {
      await fs.access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try next candidate
    }
  }
  return toolName;
};

export const isLocalComposePostgres = (): boolean =>
  (process.env.DB_HOST || '').trim() === 'postgres' && process.env.DB_SSL !== 'true';

export const getLocalPostgresContainerName = (): string =>
  process.env.POSTGRES_CONTAINER || 'shadowcheck_postgres_local';

export const runDockerizedLocalPgDump = async (options: {
  dbFilePath: string;
  globalsFilePath: string;
  database: string;
  backupScope: ReturnType<typeof resolveBackupScope>;
  adminUser: string;
}): Promise<{ globalsSuccess: boolean }> => {
  const { dbFilePath, globalsFilePath, database, backupScope, adminUser } = options;
  const containerName = getLocalPostgresContainerName();

  const streamDockerCommandToFile = (
    args: string[],
    outputPath: string,
    label: string
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const child = spawn('docker', ['exec', containerName, ...args], { env: process.env });
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
        if (code === 0) resolve(undefined);
        else reject(new Error(`${label} failed (code ${code}): ${stderr}`));
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
    backupScope.schemas.forEach((schema) => args.push('--schema', schema));
    logger.info(`[Backup] Running schema-scoped backup: ${backupScope.schemas.join(', ')}`);
  } else {
    logger.info('[Backup] Running full-database backup');
  }

  await streamDockerCommandToFile(args, dbFilePath, 'pg_dump');
  return { globalsSuccess };
};

export const runNativePgDump = async (options: {
  dbFilePath: string;
  globalsFilePath: string;
  pgDumpPath: string;
  pgDumpAllPath: string;
  pgEnv: NodeJS.ProcessEnv;
  backupScope: ReturnType<typeof resolveBackupScope>;
}): Promise<{ globalsSuccess: boolean }> => {
  const { dbFilePath, globalsFilePath, pgDumpPath, pgDumpAllPath, pgEnv, backupScope } = options;

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
      backupScope.schemas.forEach((schema) => args.push('--schema', schema));
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

  return { globalsSuccess };
};
