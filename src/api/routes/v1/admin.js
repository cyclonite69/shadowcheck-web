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
const { validateBSSID, validateTimestampMs } = require('../../../validation/schemas');
const adminMlRoutes = require('./admin/ml');
const adminTagsRoutes = require('./admin/tags');
const adminNotesRoutes = require('./admin/notes');
const adminMediaRoutes = require('./admin/media');
const adminOuiRoutes = require('./admin/oui');

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

router.use(adminMlRoutes);
router.use(adminTagsRoutes);
router.use(adminNotesRoutes);
router.use(adminMediaRoutes);
router.use(adminOuiRoutes);

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

    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    if (time === undefined || time === null || time === '') {
      return res.status(400).json({ error: 'time parameter required (milliseconds)' });
    }

    const timeValidation = validateTimestampMs(time);
    if (!timeValidation.valid) {
      return res.status(400).json({ error: timeValidation.error });
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
      [bssidValidation.cleaned, timeValidation.value]
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
      "SELECT app.network_add_note($1, $2, 'general', 'user') as note_id",
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

// GET /api/admin/network-summary/:bssid - Get complete network summary
router.get('/admin/network-summary/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

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

module.exports = router;
