/**
 * Database setup helpers.
 */

/**
 * Initialize database connections and verify connectivity.
 * @param {object} logger - Logger instance
 * @returns {Promise<{ pool: import('pg').Pool, query: Function }>}
 */
async function initializeDatabaseConnection(logger) {
  const { pool, query, testConnection } = require('../config/database');
  const { initializeDatabase } = require('./databaseInit');

  await initializeDatabase({ pool, testConnection, logger });

  return { pool, query };
}

module.exports = {
  initializeDatabaseConnection,
};
