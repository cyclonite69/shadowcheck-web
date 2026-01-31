const fs = require('fs').promises;
const { constants } = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../logging/logger');
const secretsManager = require('./secretsManager');

const repoRoot = path.resolve(__dirname, '../../..');

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

const runPostgresBackup = async () => {
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
        resolve();
      } else {
        reject(new Error(stderr || `pg_dump exited with code ${code}`));
      }
    });
  });

  await pruneOldBackups(backupDir, retentionDays);

  const stat = await fs.stat(filePath);
  logger.info(`[Backup] Completed pg_dump (${stat.size} bytes)`);

  return {
    backupDir,
    fileName,
    filePath,
    bytes: stat.size,
  };
};

module.exports = { runPostgresBackup };
