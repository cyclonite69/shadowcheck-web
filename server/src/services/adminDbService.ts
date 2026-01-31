/**
 * Admin Database Service
 * Uses shadowcheck_admin credentials for sensitive administrative operations
 */

const { Pool } = require('pg');
const secretsManager = require('./secretsManager');
const logger = require('../logging/logger');

// Admin connection settings
const DB_ADMIN_USER = process.env.DB_ADMIN_USER || 'shadowcheck_admin';
const DB_NAME = process.env.DB_NAME || 'shadowcheck_db';
const DB_HOST = process.env.DB_HOST || 'shadowcheck_postgres';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 5432;
const DB_APP_NAME = `${process.env.DB_APP_NAME || 'shadowcheck-static'}-admin`;
const DB_SEARCH_PATH = process.env.DB_SEARCH_PATH || 'app,public';

let adminPool = null;

/**
 * Initialize the admin connection pool
 */
function getAdminPool() {
  if (adminPool) {
    return adminPool;
  }

  const adminPassword = secretsManager.get('db_admin_password');

  if (!adminPassword) {
    logger.error('db_admin_password not available. Admin operations will fail.');
    return null;
  }

  adminPool = new Pool({
    user: DB_ADMIN_USER,
    password: adminPassword,
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    max: 2, // Keep admin connections low
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    statement_timeout: 300000, // 5 minutes for heavy admin tasks
    application_name: DB_APP_NAME,
    options: `-c search_path=${DB_SEARCH_PATH}`,
  });

  adminPool.on('error', (err) => {
    logger.error(`Unexpected error on admin pool idle client: ${err.message}`, { error: err });
  });

  return adminPool;
}

/**
 * Administrative query wrapper
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function adminQuery(text, params = []) {
  const pool = getAdminPool();
  if (!pool) {
    throw new Error('Admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }
  return pool.query(text, params);
}

/**
 * Close admin database connection pool
 * @returns {Promise<void>}
 */
async function closeAdminPool() {
  if (adminPool) {
    await adminPool.end();
    adminPool = null;
    logger.info('Admin database pool closed');
  }
}

module.exports = {
  adminQuery,
  closeAdminPool,
};
