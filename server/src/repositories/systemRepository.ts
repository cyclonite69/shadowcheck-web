/**
 * System Repository
 * Data access layer for database system metadata and connectivity checks.
 */

const { query } = require('../config/database');

export interface DatabaseNameRow {
  db_name: string;
}

/**
 * Queries the PostgreSQL runtime catalog for the currently connected database name.
 * Uses the canonical database query() wrapper.
 */
async function getCurrentDatabase(): Promise<string> {
  const result = await query('SELECT current_database() AS db_name');
  return result.rows[0]?.db_name || 'unknown';
}

module.exports = {
  getCurrentDatabase,
};

export { getCurrentDatabase };
