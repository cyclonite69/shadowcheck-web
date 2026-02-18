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

/**
 * Upsert network tag (admin operation)
 */
async function upsertNetworkTag(
  bssid: string,
  is_ignored: boolean | null,
  ignore_reason: string | null,
  threat_tag: string | null,
  threat_confidence: number | null,
  notes: string | null
): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_tags (
      bssid, is_ignored, ignore_reason, threat_tag, threat_confidence, notes
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (bssid) DO UPDATE SET
      is_ignored = COALESCE($2, app.network_tags.is_ignored),
      ignore_reason = CASE WHEN $2 IS NOT NULL THEN $3 ELSE app.network_tags.ignore_reason END,
      threat_tag = COALESCE($4, app.network_tags.threat_tag),
      threat_confidence = CASE WHEN $4 IS NOT NULL THEN $5 ELSE app.network_tags.threat_confidence END,
      notes = COALESCE($6, app.network_tags.notes),
      updated_at = NOW()
    RETURNING *`,
    [bssid, is_ignored, ignore_reason, threat_tag, threat_confidence, notes]
  );
  return result.rows[0];
}

/**
 * Update network tag ignore status
 */
async function updateNetworkTagIgnore(
  bssid: string,
  is_ignored: boolean,
  ignore_reason: string | null
): Promise<any> {
  const result = await adminQuery(
    `UPDATE app.network_tags SET is_ignored = $1, ignore_reason = $2, updated_at = NOW()
     WHERE bssid = $3 RETURNING *`,
    [is_ignored, ignore_reason, bssid]
  );
  return result.rows[0];
}

/**
 * Insert network tag ignore status
 */
async function insertNetworkTagIgnore(
  bssid: string,
  is_ignored: boolean,
  ignore_reason: string | null
): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_tags (bssid, is_ignored, ignore_reason)
     VALUES ($1, $2, $3) RETURNING *`,
    [bssid, is_ignored, ignore_reason]
  );
  return result.rows[0];
}

/**
 * Update network threat tag
 */
async function updateNetworkThreatTag(
  bssid: string,
  threat_tag: string,
  threat_confidence: number | null
): Promise<any> {
  const result = await adminQuery(
    `UPDATE app.network_tags SET threat_tag = $1, threat_confidence = $2, updated_at = NOW()
     WHERE bssid = $3 RETURNING *`,
    [threat_tag, threat_confidence, bssid]
  );
  return result.rows[0];
}

/**
 * Insert network threat tag
 */
async function insertNetworkThreatTag(
  bssid: string,
  threat_tag: string,
  threat_confidence: number | null
): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_tags (bssid, threat_tag, threat_confidence)
     VALUES ($1, $2, $3) RETURNING *`,
    [bssid, threat_tag, threat_confidence]
  );
  return result.rows[0];
}

/**
 * Update network tag notes
 */
async function updateNetworkTagNotes(bssid: string, notes: string): Promise<any> {
  const result = await adminQuery(
    `UPDATE app.network_tags SET notes = $1, updated_at = NOW()
     WHERE bssid = $2 RETURNING *`,
    [notes, bssid]
  );
  return result.rows[0];
}

/**
 * Insert network tag notes
 */
async function insertNetworkTagNotes(bssid: string, notes: string): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_tags (bssid, notes) VALUES ($1, $2) RETURNING *`,
    [bssid, notes]
  );
  return result.rows[0];
}

/**
 * Delete network tag
 */
async function deleteNetworkTag(bssid: string): Promise<number> {
  const result = await adminQuery(`DELETE FROM app.network_tags WHERE bssid = $1`, [bssid]);
  return result.rowCount || 0;
}

/**
 * Request WiGLE lookup for network
 */
async function requestWigleLookup(bssid: string): Promise<any> {
  const result = await adminQuery(
    `UPDATE app.network_tags SET wigle_lookup_requested = true, updated_at = NOW()
     WHERE bssid = $1 RETURNING *`,
    [bssid]
  );
  return result.rows[0];
}

/**
 * Get networks pending WiGLE lookup
 */
async function getNetworksPendingWigleLookup(limit: number): Promise<any[]> {
  const result = await query(
    `SELECT bssid FROM app.network_tags
     WHERE wigle_lookup_requested = true AND wigle_result IS NULL
     ORDER BY updated_at ASC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Export tagged networks for ML training
 */
async function exportMLTrainingData(): Promise<any[]> {
  const result = await query(
    `SELECT
      nt.bssid, nt.threat_tag, nt.threat_confidence, nt.is_ignored, nt.tag_history,
      n.ssid, n.type as network_type, n.frequency, n.capabilities, n.bestlevel as signal_dbm,
      COUNT(o.id) as observation_count,
      COUNT(DISTINCT DATE(o.observed_at)) as unique_days,
      ST_Distance(
        ST_MakePoint(MIN(o.lon), MIN(o.lat))::geography,
        ST_MakePoint(MAX(o.lon), MAX(o.lat))::geography
      ) / 1000.0 as distance_range_km
    FROM app.network_tags nt
    LEFT JOIN app.networks n ON nt.bssid = n.bssid
    LEFT JOIN app.observations o ON nt.bssid = o.bssid
    WHERE nt.threat_tag IS NOT NULL
    GROUP BY nt.bssid, nt.threat_tag, nt.threat_confidence, nt.is_ignored,
             nt.tag_history, n.ssid, n.type, n.frequency, n.capabilities, n.bestlevel, nt.updated_at
    ORDER BY nt.updated_at DESC`
  );
  return result.rows;
}

/**
 * Get import counts after SQLite import
 */
async function getImportCounts(): Promise<{ observations: number; networks: number }> {
  const result = await query(`
    SELECT 
      (SELECT COUNT(*) FROM app.observations) as observations,
      (SELECT COUNT(*) FROM app.networks) as networks
  `);
  return result.rows[0] || { observations: 0, networks: 0 };
}

/**
 * Get all settings
 */
async function getAllSettings(): Promise<any[]> {
  const result = await query(
    'SELECT key, value, description, updated_at FROM app.settings ORDER BY key'
  );
  return result.rows;
}

/**
 * Get setting by key
 */
async function getSettingByKey(key: string): Promise<any | null> {
  const result = await query(
    'SELECT value, description, updated_at FROM app.settings WHERE key = $1',
    [key]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Update setting
 */
async function updateSetting(key: string, value: any): Promise<any> {
  const result = await adminQuery(
    'UPDATE app.settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
    [JSON.stringify(value), key]
  );
  return result.rows[0];
}

/**
 * Toggle ML blending setting
 */
async function toggleMLBlending(): Promise<boolean> {
  const result = await adminQuery(`
    UPDATE app.settings
    SET value = CASE WHEN value::text = 'true' THEN 'false' ELSE 'true' END,
        updated_at = NOW()
    WHERE key = 'ml_blending_enabled'
    RETURNING value
  `);
  return result.rows[0]?.value;
}

module.exports.checkDuplicateObservations = checkDuplicateObservations;
module.exports.addNetworkNote = addNetworkNote;
module.exports.getNetworkSummary = getNetworkSummary;
module.exports.getBackupData = getBackupData;
module.exports.upsertNetworkTag = upsertNetworkTag;
module.exports.updateNetworkTagIgnore = updateNetworkTagIgnore;
module.exports.insertNetworkTagIgnore = insertNetworkTagIgnore;
module.exports.updateNetworkThreatTag = updateNetworkThreatTag;
module.exports.insertNetworkThreatTag = insertNetworkThreatTag;
module.exports.updateNetworkTagNotes = updateNetworkTagNotes;
module.exports.insertNetworkTagNotes = insertNetworkTagNotes;
module.exports.deleteNetworkTag = deleteNetworkTag;
module.exports.requestWigleLookup = requestWigleLookup;
module.exports.getNetworksPendingWigleLookup = getNetworksPendingWigleLookup;
module.exports.exportMLTrainingData = exportMLTrainingData;
