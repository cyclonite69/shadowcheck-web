/**
 * Database connection utilities for ETL scripts
 */

const { Pool } = require('pg');
require('dotenv').config();

const defaultConfig = {
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
};

/**
 * Create a new database pool
 * @param {object} options - Pool options to override defaults
 * @returns {Pool}
 */
function createPool(options = {}) {
  return new Pool({
    ...defaultConfig,
    ...options,
  });
}

/**
 * Execute a query with a temporary connection
 * @param {string} sql - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise<object>}
 */
async function query(sql, params = []) {
  const pool = createPool({ max: 1 });
  try {
    return await pool.query(sql, params);
  } finally {
    await pool.end();
  }
}

module.exports = {
  createPool,
  query,
  defaultConfig,
};
