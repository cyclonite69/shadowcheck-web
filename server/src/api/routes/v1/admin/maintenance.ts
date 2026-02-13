/**
 * Admin Data Maintenance Routes
 * Handles duplicate cleanup and colocation refresh
 */

const express = require('express');
const router = express.Router();
const { query, CONFIG } = require('../../../../config/database');
const { adminQuery } = require('../../../../services/adminDbService');
const logger = require('../../../../logging/logger');

export {};

router.post('/admin/cleanup-duplicates', async (req, res, next) => {
  try {
    logger.info('Removing duplicate observations...');

    const before = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT (bssid, observed_at, latitude, longitude, accuracy_meters)) as unique_obs
      FROM app.observations
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);

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

    const after = await query(`
      SELECT COUNT(*) as total
      FROM app.observations
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);

    logger.info(`Removed ${result.rowCount} duplicate observations`);

    res.json({
      ok: true,
      message: 'Duplicate observations removed',
      before: before.rows.length > 0 ? parseInt(before.rows[0].total) : 0,
      after: after.rows.length > 0 ? parseInt(after.rows[0].total) : 0,
      removed: result.rowCount,
    });
  } catch (err) {
    logger.error(`Error removing duplicates: ${err.message}`, { error: err });
    next(err);
  }
});

router.post('/admin/refresh-colocation', async (req, res, next) => {
  try {
    logger.info('Creating/refreshing co-location materialized view...');

    await adminQuery('DROP MATERIALIZED VIEW IF EXISTS app.network_colocation_scores CASCADE');

    await adminQuery(`
      CREATE MATERIALIZED VIEW app.network_colocation_scores AS
      WITH network_locations AS (
        SELECT
          bssid,
          observed_at,
          ST_SnapToGrid(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geometry, 0.001) as location_grid,
          observed_at / 60000 as time_bucket
        FROM app.observations
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND (accuracy_meters IS NULL OR accuracy_meters <= 100)
          AND observed_at >= ${CONFIG.MIN_VALID_TIMESTAMP}
      ),
      colocation_pairs AS (
        SELECT 
          n1.bssid,
          COUNT(DISTINCT n2.bssid) as companion_count,
          COUNT(DISTINCT n1.location_grid) as shared_location_count
        FROM network_locations n1
        JOIN network_locations n2 ON 
          n1.location_grid = n2.location_grid
          AND n1.time_bucket = n2.time_bucket
          AND n1.bssid < n2.bssid
        GROUP BY n1.bssid
        HAVING COUNT(DISTINCT n2.bssid) >= 1 
          AND COUNT(DISTINCT n1.location_grid) >= 3
      )
      SELECT DISTINCT ON (bssid)
        bssid,
        companion_count,
        shared_location_count,
        LEAST(30, 
          CASE WHEN companion_count >= 3 THEN 30
               WHEN companion_count >= 2 THEN 20
               WHEN companion_count >= 1 THEN 10
               ELSE 0 END
        ) as colocation_score,
        NOW() as computed_at
      FROM colocation_pairs
      UNION ALL
      SELECT 
        n2.bssid,
        COUNT(DISTINCT n1.bssid) as companion_count,
        COUNT(DISTINCT n1.location_grid) as shared_location_count,
        LEAST(30, 
          CASE WHEN COUNT(DISTINCT n1.bssid) >= 3 THEN 30
               WHEN COUNT(DISTINCT n1.bssid) >= 2 THEN 20
               WHEN COUNT(DISTINCT n1.bssid) >= 1 THEN 10
               ELSE 0 END
        ) as colocation_score,
        NOW() as computed_at
      FROM network_locations n1
      JOIN network_locations n2 ON 
        n1.location_grid = n2.location_grid
        AND n1.time_bucket = n2.time_bucket
        AND n1.bssid < n2.bssid
      GROUP BY n2.bssid
      HAVING COUNT(DISTINCT n1.bssid) >= 1 
        AND COUNT(DISTINCT n1.location_grid) >= 3
      ORDER BY bssid, companion_count DESC
    `);

    await adminQuery(
      'CREATE INDEX IF NOT EXISTS idx_colocation_bssid ON app.network_colocation_scores(bssid)'
    );

    logger.info('Co-location view created successfully');

    res.json({
      ok: true,
      message: 'Co-location materialized view created/refreshed successfully',
    });
  } catch (err) {
    logger.error(`Error creating co-location view: ${err.message}`, { error: err });
    next(err);
  }
});

module.exports = router;
