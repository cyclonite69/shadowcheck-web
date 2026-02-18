/**
 * Admin Database Service
 * Uses shadowcheck_admin credentials for sensitive administrative operations
 */

const { Pool } = require('pg');
const secretsManager = require('./secretsManager').default;
const logger = require('../logging/logger');

export {};

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
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
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
  getAdminPool,
  closeAdminPool,
};

// Additional admin service methods

const { query } = require('../config/database');

/**
 * Check for duplicate observations at same time/location
 */
async function checkDuplicateObservations(bssid: string, time: number): Promise<any> {
  const { rows } = await query(
    `
    WITH target_obs AS (
      SELECT time, lat, lon, accuracy
      FROM app.observations
      WHERE bssid = $1 AND time = $2
      LIMIT 1
    )
    SELECT 
      COUNT(*) as total_observations,
      COUNT(DISTINCT l.bssid) as unique_networks,
      ARRAY_AGG(DISTINCT l.bssid ORDER BY l.bssid) as bssids,
      t.lat,
      t.lon,
      t.accuracy,
      to_timestamp(t.time / 1000.0) as timestamp
    FROM app.observations l
    JOIN target_obs t ON 
      l.time = t.time 
      AND l.lat = t.lat 
      AND l.lon = t.lon
      AND l.accuracy = t.accuracy
    GROUP BY t.lat, t.lon, t.accuracy, t.time
  `,
    [bssid, time]
  );
  return rows[0] || null;
}

/**
 * Add a note to a network
 */
async function addNetworkNote(bssid: string, content: string): Promise<number> {
  const result = await query("SELECT app.network_add_note($1, $2, 'general', 'user') as note_id", [
    bssid,
    content,
  ]);
  return result.rows[0].note_id;
}

/**
 * Get complete network summary
 */
async function getNetworkSummary(bssid: string): Promise<any | null> {
  const result = await query(
    `
    SELECT bssid, tags, tag_array, is_threat, is_investigate, is_false_positive, is_suspect,
           notes, detailed_notes, notation_count, image_count, video_count, total_media_count,
           created_at, updated_at
    FROM app.network_tags_full 
    WHERE bssid = $1
  `,
    [bssid]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get backup data for export
 */
async function getBackupData(): Promise<{
  observations: any[];
  networks: any[];
  tags: any[];
}> {
  const [observations, networks, tags] = await Promise.all([
    query('SELECT * FROM app.observations ORDER BY observed_at DESC'),
    query('SELECT * FROM app.networks'),
    query('SELECT * FROM app.network_tags'),
  ]);

  return {
    observations: observations.rows,
    networks: networks.rows,
    tags: tags.rows,
  };
}

module.exports.checkDuplicateObservations = checkDuplicateObservations;
module.exports.addNetworkNote = addNetworkNote;
module.exports.getNetworkSummary = getNetworkSummary;
module.exports.getBackupData = getBackupData;
