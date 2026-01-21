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

// Configure multer for media uploads (notes attachments)
const mediaStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../..', 'data/notes-media');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const bssid = req.body.bssid || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${bssid}-${timestamp}${ext}`);
  },
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|pdf|mp4|mov|avi)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
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

// TEST endpoint to verify admin routes work
router.get('/admin/test', async (req, res) => {
  res.json({ message: 'Admin routes are working!' });
});

// Simple test route to verify new routes work
router.get('/admin/simple-test', (req, res) => {
  res.json({ ok: true, message: 'Simple test route working' });
});

// Test notes route
router.get('/admin/notes-test', (req, res) => {
  res.json({ ok: true, message: 'Notes route working' });
});

// Add note endpoint
router.post('/admin/add-note', async (req, res) => {
  try {
    const { bssid, content } = req.body;
    const result = await query(
      'SELECT app.network_add_note($1, $2, \'general\', \'user\') as note_id',
      [bssid, content]
    );
    res.json({ ok: true, note_id: result.rows[0].note_id });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/admin/home-location - Get current home location
router.get('/admin/home-location', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        latitude,
        longitude,
        radius,
        created_at
      FROM app.location_markers
      WHERE marker_type = 'home'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      // Return default home location if none set
      return res.json({
        latitude: 43.02345147,
        longitude: -83.69682688,
        radius: 100,
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/home-location - Set home location and radius
router.post('/admin/home-location', async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 100 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
    }

    if (radius < 10 || radius > 5000) {
      return res.status(400).json({ error: 'Radius must be between 10 and 5000 meters' });
    }

    // Delete existing home location
    await query("DELETE FROM app.location_markers WHERE marker_type = 'home'");

    // Insert new home location with radius
    await query(
      `
      INSERT INTO app.location_markers (marker_type, latitude, longitude, radius, location, created_at)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($3, $2), 4326), NOW())
    `,
      ['home', latitude, longitude, radius]
    );

    logger.info(`Home location updated: ${latitude}, ${longitude} with ${radius}m radius`);

    res.json({
      ok: true,
      message: 'Home location and radius saved successfully',
      latitude,
      longitude,
      radius,
    });
  } catch (err) {
    next(err);
  }
});

// Simple test route to verify new routes work
router.get('/admin/simple-test', (req, res) => {
  res.json({ ok: true, message: 'Simple test route working' });
});

// ML Scoring Implementation (temporary in admin routes)
router.post('/admin/ml-score-all', async (req, res, next) => {
  try {
    logger.info('Starting ML scoring of all networks...');

    // Get the trained model
    const modelResult = await query(
      `SELECT coefficients, intercept, feature_names, version 
       FROM app.ml_model_config 
       WHERE model_type = 'logistic_regression'`
    );

    if (!modelResult.rows.length) {
      return res.status(400).json({
        ok: false,
        message: 'No trained model found. Train a model first.',
      });
    }

    const model = modelResult.rows[0];
    const modelVersion = model.version || '1.0.0';
    const coefficients = model.coefficients;
    const intercept = model.intercept || 0;

    // Get networks to score (limit to 100 for testing)
    const networksResult = await query(`
      SELECT 
        ap.bssid,
        mv.observation_count,
        mv.unique_days,
        mv.unique_locations,
        mv.max_signal,
        mv.max_distance_km,
        mv.distance_from_home_km,
        mv.seen_at_home,
        mv.seen_away_from_home,
        COALESCE(mv.raw_score, 0) AS rule_based_score
      FROM public.access_points ap
      LEFT JOIN public.api_network_explorer_mv mv ON ap.bssid = mv.bssid
      WHERE ap.bssid IS NOT NULL
        AND mv.observation_count > 0
      LIMIT 100
    `);

    const networks = networksResult.rows;
    const scores = [];

    // Score each network
    for (const network of networks) {
      const features = {
        distance_range_km: (network.max_distance_km || 0) / 1000.0,
        unique_days: network.unique_days || 0,
        observation_count: network.observation_count || 0,
        max_signal: network.max_signal || -100,
        unique_locations: network.unique_locations || 0,
        seen_both_locations: (network.seen_at_home && network.seen_away_from_home) ? 1 : 0,
      };

      // Compute logistic regression prediction
      let score = intercept;
      for (let i = 0; i < coefficients.length; i++) {
        const featureName = model.feature_names[i];
        score += coefficients[i] * (features[featureName] || 0);
      }

      // Convert to probability (logistic function)
      const probability = 1 / (1 + Math.exp(-score));
      const threatScore = probability * 100;

      // Determine threat level
      let threatLevel = 'NONE';
      if (threatScore >= 70) {threatLevel = 'CRITICAL';} else if (threatScore >= 50) {threatLevel = 'HIGH';} else if (threatScore >= 30) {threatLevel = 'MED';} else if (threatScore >= 10) {threatLevel = 'LOW';}

      scores.push({
        bssid: network.bssid,
        ml_threat_score: parseFloat(threatScore.toFixed(2)),
        ml_threat_probability: parseFloat(probability.toFixed(3)),
        ml_primary_class: threatScore >= 50 ? 'THREAT' : 'LEGITIMATE',
        rule_based_score: network.rule_based_score,
        final_threat_score: Math.max(threatScore, network.rule_based_score),
        final_threat_level: threatLevel,
        model_version: modelVersion,
      });
    }

    // Insert scores into database
    if (scores.length > 0) {
      for (const s of scores) {
        await query(`
          INSERT INTO app.network_threat_scores 
            (bssid, ml_threat_score, ml_threat_probability, ml_primary_class, 
             rule_based_score, final_threat_score, final_threat_level, model_version)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (bssid) DO UPDATE SET
            ml_threat_score = EXCLUDED.ml_threat_score,
            ml_threat_probability = EXCLUDED.ml_threat_probability,
            ml_primary_class = EXCLUDED.ml_primary_class,
            rule_based_score = EXCLUDED.rule_based_score,
            final_threat_score = EXCLUDED.final_threat_score,
            final_threat_level = EXCLUDED.final_threat_level,
            model_version = EXCLUDED.model_version,
            scored_at = NOW(),
            updated_at = NOW()
        `, [s.bssid, s.ml_threat_score, s.ml_threat_probability, s.ml_primary_class,
          s.rule_based_score, s.final_threat_score, s.final_threat_level, s.model_version]);
      }
    }

    logger.info(`ML scoring complete: ${scores.length} networks scored`);

    res.json({
      ok: true,
      scored: scores.length,
      message: `Successfully scored ${scores.length} networks`,
      modelVersion,
    });
  } catch (error) {
    logger.error(`ML scoring error: ${error.message}`, { error });
    next(error);
  }
});

// GET /api/admin/ml-scores - Get ML scores
router.get('/admin/ml-scores', async (req, res, next) => {
  try {
    const { level, limit = 10 } = req.query;

    let whereClause = '';
    const params = [limit];

    if (level) {
      whereClause = 'WHERE final_threat_level = $2';
      params.push(level);
    }

    const result = await query(`
      SELECT bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
             rule_based_score, final_threat_score, final_threat_level,
             model_version, scored_at
      FROM app.network_threat_scores
      ${whereClause}
      ORDER BY final_threat_score DESC
      LIMIT $1
    `, params);

    res.json({
      ok: true,
      scores: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error(`ML scores get error: ${error.message}`, { error });
    next(error);
  }
});

// POST /api/admin/ml-score-now - Manually trigger ML scoring
router.post('/admin/ml-score-now', async (req, res, next) => {
  try {
    logger.info('[Admin] Manual ML scoring requested');
    const BackgroundJobsService = require('../../../services/backgroundJobsService');
    await BackgroundJobsService.scoreNow();

    res.json({
      ok: true,
      message: 'ML scoring completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`[Admin] ML scoring error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/ml-jobs-status - Check job status
router.get('/admin/ml-jobs-status', async (req, res, next) => {
  try {
    const lastScoringResult = await query(
      `SELECT final_threat_level, COUNT(*) as count
       FROM app.network_threat_scores
       GROUP BY final_threat_level
       ORDER BY count DESC`
    );

    // Helper function to calculate next job run
    const getNextRunTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const nextHour = Math.ceil(hour / 4) * 4;
      const next = new Date(now);
      next.setHours(nextHour, 0, 0, 0);
      if (next <= now) {next.setHours(nextHour + 4);}
      return next.toISOString();
    };

    res.json({
      ok: true,
      jobsScheduled: true,
      schedule: 'Every 4 hours (0, 4, 8, 12, 16, 20:00)',
      lastScoresSummary: lastScoringResult.rows,
      nextRun: getNextRunTime(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/network-tags/toggle - Toggle tag on/off (add if missing, remove if present)
router.post('/admin/network-tags/toggle', async (req, res, next) => {
  try {
    const { bssid, tag, notes } = req.body;

    if (!bssid || !tag) {
      return res.status(400).json({
        error: { message: 'BSSID and tag are required' },
      });
    }

    // Valid tags
    const validTags = ['THREAT', 'INVESTIGATE', 'FALSE_POSITIVE', 'SUSPECT'];
    if (!validTags.includes(tag)) {
      return res.status(400).json({
        error: { message: `Invalid tag. Must be one of: ${validTags.join(', ')}` },
      });
    }

    // Check if network exists and has the tag
    const existingResult = await query(
      'SELECT tags FROM app.network_tags WHERE bssid = $1',
      [bssid]
    );

    let action, newTags;

    if (existingResult.rows.length === 0) {
      // Network doesn't exist, create with tag
      await query(`
        INSERT INTO app.network_tags (bssid, tags, notes, created_by)
        VALUES ($1, $2::jsonb, $3, 'admin')
      `, [bssid, JSON.stringify([tag]), notes]);
      action = 'added';
      newTags = [tag];
    } else {
      // Network exists, toggle the tag
      const currentTags = existingResult.rows[0].tags || [];
      const hasTag = currentTags.includes(tag);

      if (hasTag) {
        // Remove tag
        await query(`
          UPDATE app.network_tags 
          SET tags = app.network_remove_tag(tags, $2),
              updated_at = NOW()
          WHERE bssid = $1
        `, [bssid, tag]);
        action = 'removed';
        newTags = currentTags.filter(t => t !== tag);
      } else {
        // Add tag
        await query(`
          UPDATE app.network_tags 
          SET tags = app.network_add_tag(tags, $2),
              notes = COALESCE($3, notes),
              updated_at = NOW()
          WHERE bssid = $1
        `, [bssid, tag, notes]);
        action = 'added';
        newTags = [...currentTags, tag];
      }
    }

    // Get updated network info
    const result = await query(
      'SELECT bssid, tags, notes FROM app.network_tags WHERE bssid = $1',
      [bssid]
    );

    res.json({
      ok: true,
      action: action,
      message: `Tag '${tag}' ${action} ${action === 'added' ? 'to' : 'from'} network ${bssid}`,
      network: result.rows[0],
    });
  } catch (error) {
    logger.error(`Toggle tag error: ${error.message}`);
    next(error);
  }
});

// DELETE /api/admin/network-tags/remove - Remove tag from network
router.delete('/admin/network-tags/remove', async (req, res, next) => {
  try {
    const { bssid, tag } = req.body;

    if (!bssid || !tag) {
      return res.status(400).json({
        error: { message: 'BSSID and tag are required' },
      });
    }

    // Remove tag
    await query(`
      UPDATE app.network_tags 
      SET tags = app.network_remove_tag(tags, $2),
          updated_at = NOW()
      WHERE bssid = $1
    `, [bssid, tag]);

    // Get updated tags
    const result = await query(
      'SELECT bssid, tags, notes FROM app.network_tags WHERE bssid = $1',
      [bssid]
    );

    res.json({
      ok: true,
      message: `Tag '${tag}' removed from network ${bssid}`,
      network: result.rows[0],
    });
  } catch (error) {
    logger.error(`Remove tag error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/network-tags/:bssid - Get all tags for a network
router.get('/admin/network-tags/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const result = await query(`
      SELECT 
        bssid,
        tags,
        tag_array,
        is_threat,
        is_investigate,
        is_false_positive,
        is_suspect,
        notes,
        created_at,
        updated_at
      FROM app.network_tags_expanded 
      WHERE bssid = $1
    `, [bssid]);

    if (!result.rows.length) {
      return res.status(404).json({
        error: { message: `No tags found for network ${bssid}` },
      });
    }

    res.json({
      ok: true,
      network: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/network-tags/search - Search networks by tags
router.get('/admin/network-tags/search', async (req, res, next) => {
  try {
    const { tags, limit = 50 } = req.query;

    if (!tags) {
      return res.status(400).json({
        error: { message: 'tags parameter required (comma-separated)' },
      });
    }

    const tagArray = tags.split(',').map(t => t.trim());

    // Find networks that have ALL specified tags
    const result = await query(`
      SELECT 
        bssid,
        tags,
        tag_array,
        is_threat,
        is_investigate,
        is_false_positive,
        is_suspect,
        notes,
        updated_at
      FROM app.network_tags_expanded 
      WHERE tags ?& $1
      ORDER BY updated_at DESC
      LIMIT $2
    `, [tagArray, parseInt(limit)]);

    res.json({
      ok: true,
      searchTags: tagArray,
      networks: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/network-notations/add - Add notation to network
router.post('/admin/network-notations/add', async (req, res, next) => {
  try {
    const { bssid, text, type = 'general' } = req.body;

    if (!bssid || !text) {
      return res.status(400).json({
        error: { message: 'BSSID and text are required' },
      });
    }

    const validTypes = ['general', 'observation', 'technical', 'location', 'behavior'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: { message: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
      });
    }

    // Add notation
    const result = await query(
      'SELECT app.network_add_notation($1, $2, $3) as notation',
      [bssid, text, type]
    );

    res.json({
      ok: true,
      message: 'Notation added successfully',
      notation: result.rows[0].notation,
    });
  } catch (error) {
    logger.error(`Add notation error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/network-notations/:bssid - Get all notations for network
router.get('/admin/network-notations/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const result = await query(
      'SELECT detailed_notes FROM app.network_tags WHERE bssid = $1',
      [bssid]
    );

    const notations = result.rows.length > 0 ? result.rows[0].detailed_notes || [] : [];

    res.json({
      ok: true,
      bssid,
      notations,
      count: notations.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/network-media/upload - Upload media (image/video) to network
router.post('/admin/network-media/upload', async (req, res, next) => {
  try {
    const { bssid, media_type, filename, media_data_base64, description, mime_type } = req.body;

    if (!bssid || !media_type || !filename || !media_data_base64) {
      return res.status(400).json({
        error: { message: 'BSSID, media_type, filename, and media_data_base64 are required' },
      });
    }

    if (!['image', 'video'].includes(media_type)) {
      return res.status(400).json({
        error: { message: 'media_type must be "image" or "video"' },
      });
    }

    // Decode base64 and get file size
    const mediaBuffer = Buffer.from(media_data_base64, 'base64');
    const fileSize = mediaBuffer.length;

    // Insert media
    const result = await query(`
      INSERT INTO app.network_media 
        (bssid, media_type, filename, file_size, mime_type, media_data, description, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin')
      RETURNING id, filename, file_size, created_at
    `, [bssid, media_type, filename, fileSize, mime_type, mediaBuffer, description]);

    res.json({
      ok: true,
      message: `${media_type} uploaded successfully`,
      media: result.rows[0],
    });
  } catch (error) {
    logger.error(`Upload media error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/network-media/:bssid - Get media list for network
router.get('/admin/network-media/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const result = await query(`
      SELECT id, media_type, filename, original_filename, file_size, 
             mime_type, description, uploaded_by, created_at
      FROM app.network_media 
      WHERE bssid = $1
      ORDER BY created_at DESC
    `, [bssid]);

    res.json({
      ok: true,
      bssid,
      media: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/network-media/download/:id - Download media file
router.get('/admin/network-media/download/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT filename, mime_type, media_data FROM app.network_media WHERE id = $1',
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: { message: 'Media not found' },
      });
    }

    const media = result.rows[0];

    res.set({
      'Content-Type': media.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${media.filename}"`,
    });

    res.send(media.media_data);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/network-summary/:bssid - Get complete network summary
router.get('/admin/network-summary/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const result = await query(`
      SELECT bssid, tags, tag_array, is_threat, is_investigate, is_false_positive, is_suspect,
             notes, detailed_notes, notation_count, image_count, video_count, total_media_count,
             created_at, updated_at
      FROM app.network_tags_full 
      WHERE bssid = $1
    `, [bssid]);

    if (!result.rows.length) {
      return res.status(404).json({
        error: { message: `No data found for network ${bssid}` },
      });
    }

    res.json({
      ok: true,
      network: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/network-notes/add
 * Add note to network (right-click context menu)
 */
router.post('/admin/network-notes/add', async (req, res) => {
  try {
    const { bssid, content, note_type = 'general', user_id = 'default_user' } = req.body;

    if (!bssid || !content) {
      return res.status(400).json({
        ok: false,
        error: 'BSSID and content are required',
      });
    }

    const result = await query(
      'SELECT app.network_add_note($1, $2, $3, $4) as note_id',
      [bssid, content, note_type, user_id]
    );

    res.json({
      ok: true,
      bssid,
      note_id: result.rows[0].note_id,
      message: 'Note added successfully',
    });
  } catch (error) {
    logger.error('Add note failed:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to add note',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/network-notes/:bssid
 * Get all notes for a network
 */
router.get('/admin/network-notes/:bssid', async (req, res) => {
  try {
    const { bssid } = req.params;

    const result = await query(`
      SELECT id, content, note_type, user_id, created_at, updated_at
      FROM app.network_notes
      WHERE bssid = $1
      ORDER BY created_at DESC
    `, [bssid]);

    res.json({
      ok: true,
      bssid,
      notes: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Get notes failed:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get notes',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/network-notes/add
 */
router.post('/admin/network-notes/add', async (req, res) => {
  try {
    const { bssid, content, note_type = 'general', user_id = 'default_user' } = req.body;
    if (!bssid || !content) {
      return res.status(400).json({ ok: false, error: 'BSSID and content required' });
    }
    const result = await query(
      'SELECT app.network_add_note($1, $2, $3, $4) as note_id',
      [bssid, content, note_type, user_id]
    );
    res.json({ ok: true, bssid, note_id: result.rows[0].note_id, message: 'Note added' });
  } catch (error) {
    logger.error('Add note failed:', error);
    res.status(500).json({ ok: false, error: 'Failed to add note' });
  }
});

/**
 * GET /api/admin/network-notes/:bssid
 */
router.get('/admin/network-notes/:bssid', async (req, res) => {
  try {
    const { bssid } = req.params;
    const result = await query(`
      SELECT id, content, note_type, user_id, created_at, updated_at
      FROM app.network_notes
      WHERE bssid = $1
      ORDER BY created_at DESC
    `, [bssid]);
    res.json({ ok: true, bssid, notes: result.rows, count: result.rows.length });
  } catch (error) {
    logger.error('Get notes failed:', error);
    res.status(500).json({ ok: false, error: 'Failed to get notes' });
  }
});

/**
 * DELETE /api/admin/network-notes/:noteId
 */
router.delete('/admin/network-notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const result = await query(
      'DELETE FROM app.network_notes WHERE id = $1 RETURNING bssid',
      [noteId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Note not found' });
    }
    res.json({ ok: true, note_id: noteId, bssid: result.rows[0].bssid, message: 'Note deleted' });
  } catch (error) {
    logger.error('Delete note failed:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete note' });
  }
});

/**
 * POST /api/admin/network-notes/:noteId/media
 */
router.post('/admin/network-notes/:noteId/media', mediaUpload.single('file'), async (req, res) => {
  try {
    const { noteId } = req.params;
    const { bssid } = req.body;
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file provided' });
    }
    const result = await query(`
      INSERT INTO app.note_media (note_id, bssid, file_path, file_name, file_size, media_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, file_path
    `, [
      noteId, bssid,
      `/api/media/${req.file.filename}`,
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
    ]);
    res.json({
      ok: true,
      note_id: noteId,
      media_id: result.rows[0].id,
      file_path: result.rows[0].file_path,
      message: 'Media uploaded',
    });
  } catch (error) {
    logger.error('Media upload failed:', error);
    res.status(500).json({ ok: false, error: 'Failed to upload media' });
  }
});

/**
 * GET /api/media/:filename
 */
router.get('/media/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(__dirname, '../../..', 'data/notes-media', filename);
    const normalized = path.normalize(filepath);
    const baseDir = path.normalize(path.join(__dirname, '../../..', 'data/notes-media'));

    if (!normalized.startsWith(baseDir)) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }
    res.sendFile(filepath);
  } catch (error) {
    logger.error('Media download failed:', error);
    res.status(404).json({ ok: false, error: 'File not found' });
  }
});

/**
 * GET /api/demo/context-menu - Serve context menu demo
 */
router.get('/demo/context-menu', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Right-Click Context Menu Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
        th { background: #f5f5f5; }
        .network-row { cursor: context-menu; }
        .network-row:hover { background: #f9f9f9; }
        .context-menu {
            position: absolute; background: white; border: 1px solid #ccc;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000; display: none;
        }
        .context-menu-item {
            padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee;
        }
        .context-menu-item:hover { background: #f0f0f0; }
        .modal {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 2000;
        }
        .modal-content {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: white; padding: 20px; border-radius: 5px; width: 400px;
        }
        .form-group { margin: 10px 0; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group textarea, .form-group select {
            width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;
        }
        .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 3px; cursor: pointer; }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
    </style>
</head>
<body>
    <h1>🛡️ Right-Click Context Menu Test</h1>
    <p><strong>Instructions:</strong> Right-click on any network row below to see the context menu.</p>
    
    <table>
        <thead>
            <tr><th>BSSID</th><th>SSID</th><th>Threat Level</th><th>Notes</th></tr>
        </thead>
        <tbody>
            <tr class="network-row" data-bssid="00:00:00:00:6E:36">
                <td>00:00:00:00:6E:36</td><td>TestNetwork</td><td>HIGH</td><td id="notes-00:00:00:00:6E:36">0</td>
            </tr>
            <tr class="network-row" data-bssid="AA:BB:CC:DD:EE:FF">
                <td>AA:BB:CC:DD:EE:FF</td><td>(hidden)</td><td>MED</td><td id="notes-AA:BB:CC:DD:EE:FF">0</td>
            </tr>
            <tr class="network-row" data-bssid="11:22:33:44:55:66">
                <td>11:22:33:44:55:66</td><td>CoffeeShop_WiFi</td><td>LOW</td><td id="notes-11:22:33:44:55:66">0</td>
            </tr>
        </tbody>
    </table>

    <!-- Context Menu -->
    <div id="contextMenu" class="context-menu">
        <div class="context-menu-item" onclick="openNoteModal()">📝 Add Note</div>
        <div class="context-menu-item" onclick="attachMedia()">📎 Attach Media</div>
        <div class="context-menu-item" onclick="closeContextMenu()">❌ Close</div>
    </div>

    <!-- Note Modal -->
    <div id="noteModal" class="modal">
        <div class="modal-content">
            <h3>Add Note</h3>
            <div class="form-group">
                <label>BSSID: <span id="modalBssid" style="font-family: monospace; color: blue;"></span></label>
            </div>
            <div class="form-group">
                <label>Note Type:</label>
                <select id="noteType">
                    <option value="general">General</option>
                    <option value="threat">Threat</option>
                    <option value="location">Location</option>
                    <option value="device_info">Device Info</option>
                </select>
            </div>
            <div class="form-group">
                <label>Note:</label>
                <textarea id="noteContent" rows="4" placeholder="Enter your note..."></textarea>
            </div>
            <div class="form-group">
                <label>Attach File:</label>
                <input type="file" id="fileInput" multiple accept="image/*,video/*,.pdf">
            </div>
            <div>
                <button class="btn btn-primary" onclick="saveNote()">Save Note</button>
                <button class="btn btn-secondary" onclick="closeNoteModal()">Cancel</button>
            </div>
        </div>
    </div>

    <script>
        let currentBssid = null;

        // Right-click handler
        document.addEventListener('contextmenu', function(e) {
            const row = e.target.closest('.network-row');
            if (row) {
                e.preventDefault();
                currentBssid = row.dataset.bssid;
                
                const menu = document.getElementById('contextMenu');
                menu.style.display = 'block';
                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
            }
        });

        // Close context menu on click elsewhere
        document.addEventListener('click', function() {
            document.getElementById('contextMenu').style.display = 'none';
        });

        function openNoteModal() {
            document.getElementById('modalBssid').textContent = currentBssid;
            document.getElementById('noteModal').style.display = 'block';
            closeContextMenu();
        }

        function closeNoteModal() {
            document.getElementById('noteModal').style.display = 'none';
            document.getElementById('noteContent').value = '';
        }

        function closeContextMenu() {
            document.getElementById('contextMenu').style.display = 'none';
        }

        function attachMedia() {
            document.getElementById('fileInput').click();
            closeContextMenu();
        }

        async function saveNote() {
            const content = document.getElementById('noteContent').value.trim();
            const noteType = document.getElementById('noteType').value;
            
            if (!content) {
                alert('Please enter a note');
                return;
            }

            try {
                const response = await fetch('/api/admin/network-notes/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bssid: currentBssid,
                        content: content,
                        note_type: noteType,
                        user_id: 'demo_user'
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Upload files if selected
                    const fileInput = document.getElementById('fileInput');
                    if (fileInput.files.length > 0) {
                        for (const file of fileInput.files) {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('bssid', currentBssid);
                            
                            await fetch('/api/admin/network-notes/' + data.note_id + '/media', {
                                method: 'POST',
                                body: formData
                            });
                        }
                    }

                    // Update note count
                    const noteCell = document.getElementById('notes-' + currentBssid);
                    const currentCount = parseInt(noteCell.textContent) || 0;
                    noteCell.textContent = currentCount + 1;
                    
                    alert('Note saved successfully!');
                    closeNoteModal();
                } else {
                    alert('Failed to save note');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error saving note');
            }
        }
    </script>
</body>
</html>
  `);
});

/**
 * GET /api/admin/oui/groups
 * Get all OUI device groups with collective threat scores
 */
router.get('/admin/oui/groups', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        oui,
        device_count,
        collective_threat_score,
        threat_level,
        primary_bssid,
        secondary_bssids,
        has_randomization,
        randomization_confidence,
        last_updated
      FROM app.oui_device_groups
      WHERE device_count > 1
      ORDER BY collective_threat_score DESC
    `);

    res.json({
      ok: true,
      groups: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    logger.error('Failed to get OUI groups:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch OUI groups' });
  }
});

/**
 * GET /api/admin/oui/:oui/details
 * Get detailed info for specific OUI group
 */
router.get('/admin/oui/:oui/details', async (req, res) => {
  try {
    const { oui } = req.params;

    const group = await query(`
      SELECT * FROM app.oui_device_groups WHERE oui = $1
    `, [oui]);

    const randomization = await query(`
      SELECT * FROM app.mac_randomization_suspects WHERE oui = $1
    `, [oui]);

    const networks = await query(`
      SELECT 
        ap.bssid,
        nts.final_threat_score,
        nts.final_threat_level,
        ap.ssid,
        COUNT(obs.id) as observation_count
      FROM public.access_points ap
      LEFT JOIN app.network_threat_scores nts ON ap.bssid = nts.bssid
      LEFT JOIN public.observations obs ON ap.bssid = obs.bssid
      WHERE SUBSTRING(ap.bssid, 1, 8) = $1
      GROUP BY ap.bssid, nts.final_threat_score, nts.final_threat_level, ap.ssid
      ORDER BY nts.final_threat_score DESC
    `, [oui]);

    res.json({
      ok: true,
      group: group.rows[0],
      randomization: randomization.rows[0],
      networks: networks.rows,
    });
  } catch (err) {
    logger.error('Failed to get OUI details:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch OUI details' });
  }
});

/**
 * GET /api/admin/oui/randomization/suspects
 * Get all suspected MAC randomization devices
 */
router.get('/admin/oui/randomization/suspects', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        oui,
        status,
        confidence_score,
        avg_distance_km,
        movement_speed_kmh,
        array_length(mac_sequence, 1) as mac_count,
        created_at
      FROM app.mac_randomization_suspects
      ORDER BY confidence_score DESC
    `);

    res.json({
      ok: true,
      suspects: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    logger.error('Failed to get randomization suspects:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch suspects' });
  }
});

/**
 * POST /api/admin/oui/analyze
 * Trigger OUI grouping and MAC randomization analysis
 */
router.post('/admin/oui/analyze', async (req, res) => {
  try {
    const OUIGroupingService = require('../../../services/ouiGroupingService');
    
    logger.info('[Admin] Starting OUI analysis...');
    await OUIGroupingService.generateOUIGroups();
    await OUIGroupingService.detectMACRandomization();
    
    res.json({
      ok: true,
      message: 'OUI analysis completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('OUI analysis failed:', err);
    res.status(500).json({ ok: false, error: 'OUI analysis failed' });
  }
});

/**
 * GET /api/admin/demo/oui-grouping - Serve OUI grouping demo page
 */
router.get('/admin/demo/oui-grouping', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>🛡️ ShadowCheck: OUI Grouping + MAC Spoofing Detection</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #2c3e50; text-align: center; }
        .section { background: white; margin: 20px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-card { flex: 1; background: #3498db; color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-card.critical { background: #e74c3c; }
        .stat-card.high { background: #f39c12; }
        .stat-card.medium { background: #f1c40f; color: #2c3e50; }
        .stat-number { font-size: 2em; font-weight: bold; }
        .stat-label { font-size: 0.9em; opacity: 0.9; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
        th { background: #34495e; color: white; }
        .threat-critical { background: #ffebee; color: #c62828; font-weight: bold; }
        .threat-high { background: #fff3e0; color: #ef6c00; font-weight: bold; }
        .threat-med { background: #fffde7; color: #f57f17; font-weight: bold; }
        .threat-low { background: #f3e5f5; color: #7b1fa2; }
        .oui { font-family: monospace; font-weight: bold; color: #2980b9; }
        .bssid { font-family: monospace; font-size: 0.9em; color: #7f8c8d; }
        .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-primary { background: #3498db; color: white; }
        .btn-success { background: #27ae60; color: white; }
        .loading { text-align: center; padding: 40px; color: #7f8c8d; }
        .error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .success { background: #e8f5e8; color: #2e7d32; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .device-count { background: #ecf0f1; padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ ShadowCheck: OUI Grouping + MAC Spoofing Detection</h1>
        
        <div class="section">
            <h2>📊 Detection Overview</h2>
            <p><strong>OUI Grouping</strong> detects multiple BSSIDs from the same physical device (multi-radio devices).</p>
            <p><strong>MAC Randomization</strong> identifies devices that change their MAC addresses over time for privacy.</p>
            
            <div class="stats" id="stats">
                <div class="stat-card">
                    <div class="stat-number" id="totalGroups">-</div>
                    <div class="stat-label">OUI Groups</div>
                </div>
                <div class="stat-card critical">
                    <div class="stat-number" id="criticalGroups">-</div>
                    <div class="stat-label">Critical Threats</div>
                </div>
                <div class="stat-card high">
                    <div class="stat-number" id="highGroups">-</div>
                    <div class="stat-label">High Threats</div>
                </div>
                <div class="stat-card medium">
                    <div class="stat-number" id="randomizationSuspects">-</div>
                    <div class="stat-label">MAC Randomization</div>
                </div>
            </div>
            
            <button class="btn btn-primary" onclick="runAnalysis()">🔄 Run OUI Analysis</button>
            <button class="btn btn-success" onclick="loadData()">📊 Refresh Data</button>
        </div>

        <div class="section">
            <h2>🎯 Top OUI Device Groups</h2>
            <div id="ouiGroupsLoading" class="loading">Loading OUI groups...</div>
            <div id="ouiGroupsError" class="error" style="display: none;"></div>
            <table id="ouiGroupsTable" style="display: none;">
                <thead>
                    <tr>
                        <th>OUI</th>
                        <th>Device Count</th>
                        <th>Collective Threat</th>
                        <th>Threat Level</th>
                        <th>Primary BSSID</th>
                        <th>Secondary BSSIDs (Sample)</th>
                    </tr>
                </thead>
                <tbody id="ouiGroupsBody"></tbody>
            </table>
        </div>

        <div class="section">
            <h2>🚶 MAC Randomization Suspects</h2>
            <div id="randomizationLoading" class="loading">Loading MAC randomization suspects...</div>
            <div id="randomizationError" class="error" style="display: none;"></div>
            <table id="randomizationTable" style="display: none;">
                <thead>
                    <tr>
                        <th>OUI</th>
                        <th>Status</th>
                        <th>Confidence</th>
                        <th>MAC Count</th>
                        <th>Avg Distance</th>
                        <th>Movement Speed</th>
                        <th>Detected</th>
                    </tr>
                </thead>
                <tbody id="randomizationBody"></tbody>
            </table>
            <div id="noRandomization" style="display: none;">
                <p>✅ No MAC randomization suspects detected. This could mean:</p>
                <ul>
                    <li>No devices are using MAC randomization in your dataset</li>
                    <li>Detection thresholds are too strict</li>
                    <li>Insufficient temporal data for pattern detection</li>
                </ul>
            </div>
        </div>
    </div>

    <script>
        let ouiGroups = [];
        let randomizationSuspects = [];

        async function runAnalysis() {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = '🔄 Running Analysis...';
            
            try {
                const response = await fetch('/api/admin/oui/analyze', { method: 'POST' });
                const data = await response.json();
                
                if (data.ok) {
                    document.getElementById('ouiGroupsError').style.display = 'none';
                    const success = document.createElement('div');
                    success.className = 'success';
                    success.textContent = '✅ OUI analysis completed successfully!';
                    btn.parentNode.appendChild(success);
                    setTimeout(() => success.remove(), 3000);
                    
                    // Refresh data
                    await loadData();
                } else {
                    throw new Error(data.error || 'Analysis failed');
                }
            } catch (error) {
                const errorDiv = document.getElementById('ouiGroupsError');
                errorDiv.textContent = \`❌ Analysis failed: \${error.message}\`;
                errorDiv.style.display = 'block';
            } finally {
                btn.disabled = false;
                btn.textContent = '🔄 Run OUI Analysis';
            }
        }

        async function loadData() {
            await Promise.all([loadOUIGroups(), loadRandomizationSuspects()]);
            updateStats();
        }

        async function loadOUIGroups() {
            try {
                document.getElementById('ouiGroupsLoading').style.display = 'block';
                document.getElementById('ouiGroupsTable').style.display = 'none';
                
                const response = await fetch('/api/admin/oui/groups');
                const data = await response.json();
                
                if (data.ok) {
                    ouiGroups = data.groups;
                    renderOUIGroups();
                    document.getElementById('ouiGroupsError').style.display = 'none';
                } else {
                    throw new Error(data.error || 'Failed to load OUI groups');
                }
            } catch (error) {
                const errorDiv = document.getElementById('ouiGroupsError');
                errorDiv.textContent = \`❌ Failed to load OUI groups: \${error.message}\`;
                errorDiv.style.display = 'block';
            } finally {
                document.getElementById('ouiGroupsLoading').style.display = 'none';
            }
        }

        async function loadRandomizationSuspects() {
            try {
                document.getElementById('randomizationLoading').style.display = 'block';
                document.getElementById('randomizationTable').style.display = 'none';
                document.getElementById('noRandomization').style.display = 'none';
                
                const response = await fetch('/api/admin/oui/randomization/suspects');
                const data = await response.json();
                
                if (data.ok) {
                    randomizationSuspects = data.suspects;
                    if (randomizationSuspects.length > 0) {
                        renderRandomizationSuspects();
                    } else {
                        document.getElementById('noRandomization').style.display = 'block';
                    }
                    document.getElementById('randomizationError').style.display = 'none';
                } else {
                    throw new Error(data.error || 'Failed to load randomization suspects');
                }
            } catch (error) {
                const errorDiv = document.getElementById('randomizationError');
                errorDiv.textContent = \`❌ Failed to load randomization suspects: \${error.message}\`;
                errorDiv.style.display = 'block';
            } finally {
                document.getElementById('randomizationLoading').style.display = 'none';
            }
        }

        function renderOUIGroups() {
            const tbody = document.getElementById('ouiGroupsBody');
            tbody.innerHTML = '';
            
            // Show top 20 groups
            const topGroups = ouiGroups.slice(0, 20);
            
            topGroups.forEach(group => {
                const row = document.createElement('tr');
                
                const threatClass = group.threat_level.toLowerCase().replace('critical', 'critical');
                row.className = \`threat-\${threatClass}\`;
                
                const secondaryBssids = group.secondary_bssids || [];
                const sampleSecondary = secondaryBssids.slice(0, 3).join(', ');
                const moreCount = secondaryBssids.length > 3 ? \` (+\${secondaryBssids.length - 3} more)\` : '';
                
                row.innerHTML = \`
                    <td class="oui">\${group.oui}</td>
                    <td><span class="device-count">\${group.device_count}</span></td>
                    <td>\${parseFloat(group.collective_threat_score).toFixed(1)}</td>
                    <td>\${group.threat_level}</td>
                    <td class="bssid">\${group.primary_bssid}</td>
                    <td class="bssid">\${sampleSecondary}\${moreCount}</td>
                \`;
                
                tbody.appendChild(row);
            });
            
            document.getElementById('ouiGroupsTable').style.display = 'table';
        }

        function renderRandomizationSuspects() {
            const tbody = document.getElementById('randomizationBody');
            tbody.innerHTML = '';
            
            randomizationSuspects.forEach(suspect => {
                const row = document.createElement('tr');
                
                const confidenceClass = parseFloat(suspect.confidence_score) >= 0.8 ? 'threat-critical' : 
                                       parseFloat(suspect.confidence_score) >= 0.6 ? 'threat-high' : 'threat-med';
                row.className = confidenceClass;
                
                row.innerHTML = \`
                    <td class="oui">\${suspect.oui}</td>
                    <td>\${suspect.status.toUpperCase()}</td>
                    <td>\${(parseFloat(suspect.confidence_score) * 100).toFixed(1)}%</td>
                    <td>\${suspect.mac_count}</td>
                    <td>\${parseFloat(suspect.avg_distance_km).toFixed(1)} km</td>
                    <td>\${parseFloat(suspect.movement_speed_kmh).toFixed(1)} km/h</td>
                    <td>\${new Date(suspect.created_at).toLocaleDateString()}</td>
                \`;
                
                tbody.appendChild(row);
            });
            
            document.getElementById('randomizationTable').style.display = 'table';
        }

        function updateStats() {
            document.getElementById('totalGroups').textContent = ouiGroups.length;
            
            const critical = ouiGroups.filter(g => g.threat_level === 'CRITICAL').length;
            const high = ouiGroups.filter(g => g.threat_level === 'HIGH').length;
            
            document.getElementById('criticalGroups').textContent = critical;
            document.getElementById('highGroups').textContent = high;
            document.getElementById('randomizationSuspects').textContent = randomizationSuspects.length;
        }

        // Load data on page load
        window.addEventListener('load', loadData);
    </script>
</body>
</html>
  `);
});

module.exports = router;
