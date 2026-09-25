import { adminQuery, getAdminPool } from './adminDbService';
import { query } from '../config/database';
import logger from '../logging/logger';

export async function getDuplicateObservationStats(): Promise<{
  total: number;
  unique_obs: number;
}> {
  const result = await query(`
    SELECT COUNT(*) as total,
           COUNT(DISTINCT (bssid, observed_at, lat, lon, accuracy)) as unique_obs
    FROM app.observations
    WHERE lat IS NOT NULL AND lon IS NOT NULL
  `);
  return result.rows[0] || { total: 0, unique_obs: 0 };
}

export async function deleteDuplicateObservations(): Promise<number> {
  const result = await adminQuery(`
    DELETE FROM app.observations
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY bssid, observed_at, lat, lon, accuracy 
            ORDER BY id
          ) as rn
        FROM app.observations
        WHERE lat IS NOT NULL AND lon IS NOT NULL
      ) t
      WHERE rn > 1
    )
  `);
  return result.rowCount || 0;
}

export async function getObservationCount(): Promise<number> {
  const result = await query(`
    SELECT COUNT(*) as total
    FROM app.observations
    WHERE lat IS NOT NULL AND lon IS NOT NULL
  `);
  return parseInt(result.rows[0]?.total || '0', 10);
}

// DEPRECATED: Generic network cooccurrence is superseded by sibling
// detection. This will be removed or redesigned. Do not restore the
// SQL body without an explicit architectural decision.
export async function refreshColocationView(_minValidTimestamp?: number): Promise<void> {
  logger.warn(
    'refreshColocationView: deprecated — pending redesign as part ' +
      'of sibling detection system evolution. Skipping.'
  );
  return;
}

/**
 * Delete non-sentinel network data (dangerous admin operation).
 * Keep sentinel networks and their dependent rows alive so fallback associations remain valid.
 */
export async function truncateAllData(): Promise<void> {
  const databaseName = process.env.PGDATABASE || process.env.DB_NAME || 'shadowcheck_db';
  const unsafeOverride = process.env.ALLOW_UNSAFE_DATA_RESET === 'true';
  if (!databaseName.toLowerCase().includes('test') && !unsafeOverride) {
    throw new Error(
      `Refusing destructive network reset against database '${databaseName}'. ` +
        'Use a database name containing "test" or set ALLOW_UNSAFE_DATA_RESET=true explicitly.'
    );
  }

  const pool = getAdminPool();
  if (!pool) {
    throw new Error('Admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      DELETE FROM app.observations
      WHERE bssid IN (
        SELECT bssid
        FROM app.networks
        WHERE COALESCE(is_sentinel, false) IS NOT TRUE
      )
    `);
    await client.query(`
      DELETE FROM app.ssid_history
      WHERE bssid IN (
        SELECT bssid
        FROM app.networks
        WHERE COALESCE(is_sentinel, false) IS NOT TRUE
      )
    `);
    await client.query(`
      DELETE FROM app.networks
      WHERE COALESCE(is_sentinel, false) IS NOT TRUE
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
