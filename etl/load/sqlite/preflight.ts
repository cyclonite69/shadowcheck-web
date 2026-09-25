import { existsSync as fsExistsSync } from 'fs';
import type { Pool } from 'pg';

export interface SqliteImportReaderLike {
  assertLocationTableExists(): Promise<void>;
}

export interface ImportPreflightOptions {
  sqliteFile: string;
  sourceTag: string;
  pool: Pool;
  sqliteReader: SqliteImportReaderLike;
  existsSync?: (path: fsExistsSyncLike) => boolean;
}

type fsExistsSyncLike = string | URL;

export interface ImportPreflightResult {
  postgresUser: string;
}

export async function runImportPreflight(
  options: ImportPreflightOptions
): Promise<ImportPreflightResult> {
  const existsSync = options.existsSync || fsExistsSync;

  if (!existsSync(options.sqliteFile)) {
    throw new Error(`SQLite file not found: ${options.sqliteFile}`);
  }

  if (!options.sourceTag || !/^[a-zA-Z0-9_-]+$/.test(options.sourceTag)) {
    throw new Error('Source tag must be alphanumeric with underscores/hyphens only');
  }

  let postgresUser: string;
  try {
    const result = await options.pool.query('SELECT NOW() as now, current_user as user');
    postgresUser = result.rows[0].user;
  } catch (error) {
    const err = error as Error;
    throw new (Error as any)(`PostgreSQL connection failed: ${err.message}`, { cause: error });
  }

  await options.sqliteReader.assertLocationTableExists();

  return { postgresUser };
}
