/**
 * Database configuration and connection pool
 * Centralizes database connection management
 */

const { Pool } = require('pg');
require('dotenv').config();
const secretsManager = require('../services/secretsManager');
const logger = require('../logging/logger');

// Normalized connection settings with safe defaults for shared Docker postgres
const DB_USER = process.env.DB_USER || 'shadowcheck_user';
const DB_NAME = process.env.DB_NAME || 'shadowcheck_db';
const DB_HOST = process.env.DB_HOST || 'shadowcheck_postgres';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 5432;
const DB_APP_NAME = process.env.DB_APP_NAME || 'shadowcheck-static';
const DB_SEARCH_PATH = process.env.DB_SEARCH_PATH || 'public,app';

// Configuration constants
const CONFIG = {
  MIN_VALID_TIMESTAMP: 946684800000, // Jan 1, 2000 in milliseconds
  THREAT_THRESHOLD: parseInt(process.env.THREAT_THRESHOLD) || 40,
  MIN_OBSERVATIONS: parseInt(process.env.MIN_OBSERVATIONS) || 2,
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
});

// Pool error handler
pool.on('error', (err) => {
  logger.error(`Unexpected error on idle client: ${err.message}`, { error: err });
  process.exit(-1);
});

/**
 * Query wrapper without retries (fail fast for visibility)
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  const result = await query('SELECT current_user, current_database()');
  const row = result.rows[0] || {};
  logger.info(
    `Database connection successful as ${row.current_user || 'unknown'} on ${row.current_database || 'unknown'}`
  );
  return true;
}

/**
 * Close database connection pool
 * @returns {Promise<void>}
 */
async function closePool() {
  await pool.end();
  logger.info('Database pool closed');
}

module.exports = {
  pool,
  query,
  testConnection,
  closePool,
  CONFIG,
};
