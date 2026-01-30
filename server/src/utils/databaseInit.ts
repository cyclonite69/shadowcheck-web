/**
 * Database initialization helper.
 */
import type { Pool, PoolClient } from 'pg';

interface Logger {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
  debug: (message: string, meta?: unknown) => void;
}

interface DatabaseInitOptions {
  pool: Pool;
  testConnection: () => Promise<void>;
  logger: Logger;
}

/**
 * Initialize database connection pool and verify connectivity.
 */
async function initializeDatabase(options: DatabaseInitOptions): Promise<void> {
  const { pool, testConnection, logger } = options;

  pool.on('connect', (client: PoolClient) => {
    logger.debug(
      `Pool connected: ${(client as unknown as { host: string; port: number }).host}:${(client as unknown as { host: string; port: number }).port}`
    );
  });

  // Fail fast if the database is unreachable or misconfigured
  await testConnection();
}

export { initializeDatabase, DatabaseInitOptions };
