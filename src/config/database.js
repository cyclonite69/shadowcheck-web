/**
 * Database configuration and connection pool
 * Centralizes database connection management
 */

const { Pool } = require('pg');
require('dotenv').config();
const secretsManager = require('../services/secretsManager');

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
  user: process.env.DB_USER,
  password: secretsManager.getOrThrow('db_password'),
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 2000, // 2 seconds
});

// Pool error handler
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Query wrapper with automatic retry for transient errors
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @param {number} tries - Number of retry attempts
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = [], tries = 2) {
  const transientErrors = ['57P01', '53300', '08006', '08003', '08000'];

  try {
    return await pool.query(text, params);
  } catch (err) {
    // Retry on transient errors
    if (tries > 1 && (transientErrors.includes(err.code) ||
        ['ETIMEDOUT', 'ECONNRESET'].includes(err.errno))) {
      console.warn(`Transient error ${err.code || err.errno}, retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return query(text, params, tries - 1);
    }
    throw err;
  }
}

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    await query('SELECT NOW()');
    console.log('✓ Database connection successful');
    return true;
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    return false;
  }
}

/**
 * Close database connection pool
 * @returns {Promise<void>}
 */
async function closePool() {
  await pool.end();
  console.log('Database pool closed');
}

module.exports = {
  pool,
  query,
  testConnection,
  closePool,
  CONFIG,
};
