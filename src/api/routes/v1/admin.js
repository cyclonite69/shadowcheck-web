/**
 * Admin Routes
 * Handles administrative operations (duplicates, colocation, etc.)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { query, CONFIG } = require('../../../config/database');
const logger = require('../../../logging/logger');

// Configure multer for SQLite file uploads
const upload = multer({
  dest: '/tmp/',
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.sqlite', '.db', '.sqlite3'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only SQLite files (.sqlite, .db, .sqlite3) are allowed'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
});

// POST /api/admin/import-sqlite - Import SQLite database
router.post('/admin/import-sqlite', upload.single('sqlite'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No SQLite file uploaded' });
    }

    const sqliteFile = req.file.path;
    const originalName = req.file.originalname;

    logger.info(`Starting turbo SQLite import: ${originalName}`);

    // Use the fastest turbo import script
    const scriptPath = path.join(__dirname, '../../../../scripts/import/turbo-import.js');

    const importProcess = spawn('node', [scriptPath, sqliteFile], {
      cwd: path.dirname(scriptPath),
    });

    let output = '';
    let errorOutput = '';

    importProcess.stdout.on('data', (data) => {
      output += data.toString();
      logger.debug(data.toString().trim());
    });

    importProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      logger.warn(data.toString().trim());
    });

    importProcess.on('close', async (code) => {
      try {
        // Clean up uploaded file
        await fs.unlink(sqliteFile);
      } catch (e) {
        logger.warn(`Failed to clean up temp file: ${e.message}`);
      }

      if (code === 0) {
        // Get final counts
        try {
          const counts = await query(`
            SELECT 
              (SELECT COUNT(*) FROM app.observations) as observations,
              (SELECT COUNT(*) FROM app.networks) as networks
          `);

          const result = counts.rows[0] || { observations: 0, networks: 0 };

          logger.info(
            `Turbo SQLite import completed: ${result.observations} observations, ${result.networks} networks`
          );

          res.json({
            ok: true,
            message: 'SQLite database imported successfully (turbo processing)',
            observations: parseInt(result.observations),
            networks: parseInt(result.networks),
            output: output,
          });
        } catch (e) {
          logger.error(`Error getting final counts: ${e.message}`, { error: e });
          res.json({
            ok: true,
            message: 'SQLite database imported successfully (counts unavailable)',
            output: output,
          });
        }
      } else {
        logger.error(`Import script failed with code ${code}`);
        res.status(500).json({
          error: 'Import script failed',
          code: code,
          output: output,
          errorOutput: errorOutput,
        });
      }
    });

    importProcess.on('error', async (error) => {
      logger.error(`Failed to start import script: ${error.message}`, { error });
      try {
        await fs.unlink(sqliteFile);
      } catch (e) {
        logger.warn(`Failed to clean up temp file: ${e.message}`);
      }
      res.status(500).json({
        error: 'Failed to start import process',
        details: error.message,
      });
    });
  } catch (err) {
    // Clean up file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        logger.warn(`Failed to clean up temp file: ${e.message}`);
      }
    }
    next(err);
  }
});

// GET /api/observations/check-duplicates/:bssid - Check for duplicate observations
router.get('/observations/check-duplicates/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const { time } = req.query;

    if (!bssid || typeof bssid !== 'string' || bssid.trim() === '') {
      return res.status(400).json({ error: 'Valid BSSID or tower identifier is required' });
    }

    if (!time) {
      return res.status(400).json({ error: 'time parameter required (milliseconds)' });
    }

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

    res.json({
      ok: true,
      data: rows[0] || null,
      isSuspicious: rows[0] && rows[0].total_observations >= 10,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/cleanup-duplicates - Remove duplicate observations
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

    const result = await query(`
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

// POST /api/admin/refresh-colocation - Create/refresh co-location materialized view
router.post('/admin/refresh-colocation', async (req, res, next) => {
  try {
    logger.info('Creating/refreshing co-location materialized view...');

    await query('DROP MATERIALIZED VIEW IF EXISTS app.network_colocation_scores CASCADE');

    await query(`
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

    await query(
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
