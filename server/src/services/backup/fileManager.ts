import fs from 'fs/promises';
import { Dirent } from 'fs';
import path from 'path';
import logger from '../../logging/logger';

const repoRoot = '/app';

/**
 * Generate backup timestamp in YYYYMMDD-HHMMSS format
 */
export const generateBackupTimestamp = (): string => {
  const d = new Date();
  const pad = (n: number | string) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
};

/**
 * Resolve configured backup directory, creating if needed.
 * Defaults to {repoRoot}/backups/db
 */
export const resolveBackupDirectory = async (): Promise<string> => {
  const configured = process.env.BACKUP_DIR;
  const backupDir = configured
    ? path.isAbsolute(configured)
      ? configured
      : path.resolve(repoRoot, configured)
    : path.join(repoRoot, 'backups', 'db');

  await fs.mkdir(backupDir, { recursive: true });
  logger.debug(`[Backup] Using backup directory: ${backupDir}`);

  return backupDir;
};

/**
 * Prune backup files older than specified number of days.
 * Only removes .dump files.
 */
export const pruneOldBackups = async (dir: string, days: number): Promise<void> => {
  if (!days || days <= 0) {
    logger.debug('[Backup] Backup pruning disabled (days <= 0)');
    return;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const filesToDelete = entries.filter(
    (entry: Dirent) => entry.isFile() && entry.name.endsWith('.dump')
  );

  let pruned = 0;
  await Promise.all(
    filesToDelete.map(async (entry: Dirent) => {
      const fullPath = path.join(dir, entry.name);
      const stat = await fs.stat(fullPath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(fullPath);
        logger.debug(`[Backup] Pruned old backup: ${entry.name}`);
        pruned++;
      }
    })
  );

  if (pruned > 0) {
    logger.info(`[Backup] Pruned ${pruned} backup files older than ${days} days`);
  }
};
