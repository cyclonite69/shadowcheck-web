/**
 * Database setup helpers.
 */
import type { Pool, QueryResult } from 'pg';

interface Logger {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
  debug: (message: string, meta?: unknown) => void;
}

type QueryFunction = (text: string, params?: unknown[]) => Promise<QueryResult>;

interface DatabaseConnectionResult {
  pool: Pool;
  query: QueryFunction;
}

/**
 * Initialize database connections and verify connectivity.
 */
async function initializeDatabaseConnection(logger: Logger): Promise<DatabaseConnectionResult> {
  const { pool, query, testConnection } = require('../config/database');
  const { initializeDatabase } = require('./databaseInit');

  await initializeDatabase({ pool, testConnection, logger });

  return { pool, query };
}

export { initializeDatabaseConnection, DatabaseConnectionResult };
