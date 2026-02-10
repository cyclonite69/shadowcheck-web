/**
 * Database configuration and connection pool
 * Centralizes database connection management
 */

import { Pool, QueryResult } from 'pg';
import 'dotenv/config';
import secretsManager from '../services/secretsManager';
import logger from '../logging/logger';

// Normalized connection settings with safe defaults for shared Docker postgres
const DB_USER = process.env.DB_USER || 'shadowcheck_user';
const DB_NAME = process.env.DB_NAME || 'shadowcheck_db';
const DB_HOST = process.env.DB_HOST || 'shadowcheck_postgres';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_APP_NAME = process.env.DB_APP_NAME || 'shadowcheck-static';
const DB_SEARCH_PATH = process.env.DB_SEARCH_PATH || 'app,public';

// Configuration constants
interface DatabaseConfig {
  MIN_VALID_TIMESTAMP: number;
  THREAT_THRESHOLD: number;
  MIN_OBSERVATIONS: number;
  MAX_PAGE_SIZE: number;
  DEFAULT_PAGE_SIZE: number;
}

const CONFIG: DatabaseConfig = {
  MIN_VALID_TIMESTAMP: 946684800000, // Jan 1, 2000 in milliseconds
  THREAT_THRESHOLD: parseInt(process.env.THREAT_THRESHOLD || '40'),
  MIN_OBSERVATIONS: parseInt(process.env.MIN_OBSERVATIONS || '2'),
  MAX_PAGE_SIZE: 5000,
  DEFAULT_PAGE_SIZE: 100,
};

// Create connection pool
const pool = new Pool({
  user: DB_USER,
  password: secretsManager.getOrThrow('db_password'),
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  max: 5, // Reduced from 20 to avoid overwhelming the connection
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 30000, // Increased to 30 seconds
  statement_timeout: 60000, // 60 seconds
  application_name: DB_APP_NAME,
  options: `-c search_path=${DB_SEARCH_PATH}`,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Pool error handler
pool.on('error', (err: Error) => {
  logger.error(`Unexpected error on idle client: ${err.message}`, { error: err });
  process.exit(-1);
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
