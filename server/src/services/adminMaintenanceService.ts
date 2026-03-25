export {};

const { adminQuery } = require('./adminDbService');
const { query } = require('../config/database');

async function getDuplicateObservationStats(): Promise<{ total: number; unique_obs: number }> {
  const result = await query(`
    SELECT COUNT(*) as total,
           COUNT(DISTINCT (bssid, observed_at, latitude, longitude, accuracy_meters)) as unique_obs
    FROM app.observations
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  `);
  return result.rows[0] || { total: 0, unique_obs: 0 };
}

async function deleteDuplicateObservations(): Promise<number> {
  const result = await adminQuery(`
    DELETE FROM app.observations
    WHERE unified_id IN (
      SELECT unified_id
      FROM (
        SELECT unified_id,
          ROW_NUMBER() OVER (
            PARTITION BY bssid, observed_at, latitude, longitude, accuracy_meters 
            ORDER BY unified_id
          ) as rn
        FROM app.observations
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ) t
      WHERE rn > 1
    )
  `);
  return result.rowCount || 0;
}

async function getObservationCount(): Promise<number> {
  const result = await query(`
    SELECT COUNT(*) as total
    FROM app.observations
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  `);
  return parseInt(result.rows[0]?.total || '0', 10);
}

async function refreshColocationView(minValidTimestamp: number): Promise<void> {
  // Guard: prevent SQL injection via numeric literal interpolation
  if (!Number.isFinite(minValidTimestamp) || minValidTimestamp < 0) {
    throw new Error('Invalid minValidTimestamp');
  }

  // Recreate the materialized view from scratch, then populate it without blocking reads.
  await adminQuery('DROP MATERIALIZED VIEW IF EXISTS app.network_colocation_scores CASCADE');
  await adminQuery(`
    CREATE MATERIALIZED VIEW app.network_colocation_scores AS
    WITH network_locations AS (
      SELECT bssid, observed_at,
        ST_SnapToGrid(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geometry, 0.001) as location_grid,
        observed_at / 60000 as time_bucket
      FROM app.observations
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND (accuracy_meters IS NULL OR accuracy_meters <= 100)
        AND observed_at >= ${minValidTimestamp}
    ),
    colocation_pairs AS (
      SELECT n1.bssid, COUNT(DISTINCT n2.bssid) as companion_count,
             COUNT(DISTINCT n1.location_grid) as shared_location_count
      FROM network_locations n1
      JOIN network_locations n2 ON n1.location_grid = n2.location_grid
        AND n1.time_bucket = n2.time_bucket AND n1.bssid < n2.bssid
      GROUP BY n1.bssid
      HAVING COUNT(DISTINCT n2.bssid) >= 1 AND COUNT(DISTINCT n1.location_grid) >= 3
    )
    SELECT DISTINCT ON (bssid) bssid, companion_count, shared_location_count,
      LEAST(30, CASE WHEN companion_count >= 3 THEN 30 WHEN companion_count >= 2 THEN 20
                     WHEN companion_count >= 1 THEN 10 ELSE 0 END) as colocation_score,
      NOW() as computed_at
    FROM colocation_pairs
    UNION ALL
    SELECT n2.bssid, COUNT(DISTINCT n1.bssid) as companion_count,
           COUNT(DISTINCT n1.location_grid) as shared_location_count,
      LEAST(30, CASE WHEN COUNT(DISTINCT n1.bssid) >= 3 THEN 30 WHEN COUNT(DISTINCT n1.bssid) >= 2 THEN 20
                     WHEN COUNT(DISTINCT n1.bssid) >= 1 THEN 10 ELSE 0 END) as colocation_score,
      NOW() as computed_at
    FROM network_locations n1
    JOIN network_locations n2 ON n1.location_grid = n2.location_grid
      AND n1.time_bucket = n2.time_bucket AND n1.bssid < n2.bssid
    GROUP BY n2.bssid
    HAVING COUNT(DISTINCT n1.bssid) >= 1 AND COUNT(DISTINCT n1.location_grid) >= 3
    ORDER BY bssid, companion_count DESC
    WITH NO DATA
  `);
  await adminQuery(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_colocation_bssid ON app.network_colocation_scores(bssid)'
  );
  // CONCURRENTLY requires the unique index to exist first; avoids blocking reads
  await adminQuery('REFRESH MATERIALIZED VIEW CONCURRENTLY app.network_colocation_scores');
}

/**
 * Truncate all data (dangerous admin operation)
 */
async function truncateAllData(): Promise<void> {
  await adminQuery('TRUNCATE TABLE app.observations CASCADE');
  await adminQuery('TRUNCATE TABLE app.networks CASCADE');
}

module.exports = {
  getDuplicateObservationStats,
  deleteDuplicateObservations,
  getObservationCount,
  refreshColocationView,
  truncateAllData,
};
