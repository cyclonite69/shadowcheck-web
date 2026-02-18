/**
 * Admin SQLite Import Route
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const adminDbService = require('../../../../services/adminDbService');
const logger = require('../../../../logging/logger');

export {};

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

router.post('/admin/import-sqlite', upload.single('sqlite'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No SQLite file uploaded' });
    }

    const sqliteFile = req.file.path;
    const originalName = req.file.originalname;

    logger.info(`Starting turbo SQLite import: ${originalName}`);

    // Use the fastest turbo import script
    const scriptPath = path.join(__dirname, '../../../../../scripts/import/turbo-import.js');

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
          const result = await adminDbService.getImportCounts();

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

module.exports = router;
