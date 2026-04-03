import fs from 'fs/promises';
import { spawn } from 'child_process';

export {};

type BackupScope = {
  mode: 'full_database' | 'schema_subset';
  schemas: string[];
  explicit: boolean;
};

const truthy = new Set(['1', 'true', 'yes', 'on']);
const falsy = new Set(['0', 'false', 'no', 'off']);

const normalizeFlag = (value?: string): boolean | null => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }
  if (truthy.has(normalized)) {
    return true;
  }
  if (falsy.has(normalized)) {
    return false;
  }
  return null;
};

const parseBackupSchemas = (value?: string): string[] =>
  String(value || '')
    .split(',')
    .map((schema) => schema.trim())
    .filter(Boolean);

const resolveBackupScope = (env: NodeJS.ProcessEnv): BackupScope => {
  const includeAllSchemas = normalizeFlag(env.BACKUP_INCLUDE_ALL_SCHEMAS);
  const backupSchemas = parseBackupSchemas(env.BACKUP_SCHEMAS);

  if (includeAllSchemas === true) {
    return {
      mode: 'full_database',
      schemas: [],
      explicit: true,
    };
  }

  if (includeAllSchemas === false) {
    return {
      mode: backupSchemas.length > 0 ? 'schema_subset' : 'full_database',
      schemas: backupSchemas,
      explicit: true,
    };
  }

  if (backupSchemas.length > 0) {
    return {
      mode: 'schema_subset',
      schemas: backupSchemas,
      explicit: true,
    };
  }

  return {
    mode: 'full_database',
    schemas: [],
    explicit: false,
  };
};

const verifyBackupFile = async (filePath: string, verifierPath: string): Promise<number> => {
  const stat = await fs.stat(filePath);
  if (stat.size <= 0) {
    throw new Error(`Backup file is empty: ${filePath}`);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(verifierPath, ['-l', filePath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', reject);
    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `pg_restore failed verifying ${filePath} (code ${code})`));
    });
  });

  return stat.size;
};

export { parseBackupSchemas, resolveBackupScope, verifyBackupFile };
