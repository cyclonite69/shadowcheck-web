/**
 * Database configuration and connection pool
 * Centralizes database connection management
 */

import { Pool, QueryResult } from 'pg';
import './loadEnv';
import secretsManager from '../services/secretsManager';
import logger from '../logging/logger';

// Normalized connection settings with Docker-first defaults.
// Local compose uses the postgres service automatically; host-based local
// development should override DB_HOST=localhost explicitly.
const DB_USER = process.env.DB_USER || 'shadowcheck_user';
const DB_NAME = process.env.DB_NAME || 'shadowcheck_db';
const DB_HOST = process.env.DB_HOST || 'postgres';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_APP_NAME = process.env.DB_APP_NAME || 'shadowcheck-web';
const DB_SEARCH_PATH = process.env.DB_SEARCH_PATH || 'app,public';

// Configuration constants
interface DatabaseConfig {
  MIN_VALID_TIMESTAMP: number;
  THREAT_THRESHOLD: number;
  MIN_OBSERVATIONS: number;
  MAX_PAGE_SIZE: number;
  DEFAULT_PAGE_SIZE: number;
  /** When true, skip confidence blending and use rule_based_score only for threat scoring. */
  SIMPLE_RULE_SCORING_ENABLED: boolean;
}

const CONFIG: DatabaseConfig = {
  MIN_VALID_TIMESTAMP: 946684800000, // Jan 1, 2000 in milliseconds
  THREAT_THRESHOLD: parseInt(process.env.THREAT_THRESHOLD || '40'),
  MIN_OBSERVATIONS: parseInt(process.env.MIN_OBSERVATIONS || '2'),
  MAX_PAGE_SIZE: 5000,
  DEFAULT_PAGE_SIZE: 100,
  SIMPLE_RULE_SCORING_ENABLED: process.env.SIMPLE_RULE_SCORING_ENABLED === 'true',
};

// Create connection pool
const pool = new Pool({
  user: DB_USER,
  password: process.env.DB_PASSWORD || secretsManager.getOrThrow('db_password'),
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  max: 5, // Reduced from 20 to avoid overwhelming the connection
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 30000, // Increased to 30 seconds
  statement_timeout: 60000, // 60 seconds
  application_name: DB_APP_NAME,
  options: `-c search_path=${DB_SEARCH_PATH}`,
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          ca: process.env.DB_SSL_CA || undefined,
        }
      : false,
});

// Pool error handler — log and let pg recover; do not kill the process
pool.on('error', (err: Error) => {
  logger.error(`Unexpected error on idle client: ${err.message}`, { error: err });
});

/**
 * Query wrapper without retries (fail fast for visibility)
 */
async function query(text: string, params: unknown[] = []): Promise<QueryResult> {
  return pool.query(text, params);
}

/**
 * Test database connection
 */
async function testConnection(): Promise<boolean> {
  const result = await query('SELECT current_user, current_database()');
  const row = result.rows[0] || {};
  logger.info(
    `Database connection successful as ${row.current_user || 'unknown'} on ${row.current_database || 'unknown'}`
  );
  return true;
}

/**
 * Close database connection pool
 */
async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

export { pool, query, testConnection, closePool, CONFIG };
export {};
