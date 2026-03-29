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

  // Self-heal: ensure materialized view is populated
  try {
    const client = await pool.connect();
    try {
      // Check if populated by doing a fast LIMIT 1 query
      // If it throws code 55000, it's not populated
      await client.query('SELECT 1 FROM app.api_network_explorer_mv LIMIT 1');
    } catch (err: any) {
      if (err.code === '55000' || (err.message && err.message.includes('has not been populated'))) {
        logger.info('Materialized view app.api_network_explorer_mv is empty. Auto-refreshing...');
        // First time population must be non-concurrent
        await client.query('REFRESH MATERIALIZED VIEW app.api_network_explorer_mv');
        logger.info('Materialized view populated successfully.');
      } else if (err.code === '42P01') {
        logger.warn('Materialized view app.api_network_explorer_mv does not exist yet.');
      } else {
        throw err;
      }
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('Error during auto-refresh of materialized view:', { error: err });
  }
}

export { initializeDatabase, DatabaseInitOptions };
