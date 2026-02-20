/**
 * Admin SQLite Import Route
 *
 * Accepts a WiGLE SQLite backup file and a source_tag, then runs the
 * incremental importer (only new observations since last import for that tag).
 * Optionally takes a DB backup before importing.
 * Every run is recorded in app.import_history with before/after metrics.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const secretsManager = require('../../../../services/secretsManager').default;
const adminDbService = require('../../../../services/adminDbService');
const { runPostgresBackup } = require('../../../../services/backupService');
const logger = require('../../../../logging/logger');

export {};

const upload = multer({
  dest: '/tmp/',
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedExts = ['.sqlite', '.db', '.sqlite3'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only SQLite files (.sqlite, .db, .sqlite3) are allowed'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 },
});

const PROJECT_ROOT = path.resolve(__dirname, '../../../../../../');

function getImportCommand(sqliteFile: string, sourceTag: string): { cmd: string; args: string[] } {
  if (process.env.NODE_ENV === 'production') {
    const compiledScript = path.join(
      PROJECT_ROOT,
      'dist/server/etl/load/sqlite-import-incremental.js'
    );
    return { cmd: 'node', args: [compiledScript, sqliteFile, sourceTag] };
  }
  const tsxBin = path.join(PROJECT_ROOT, 'node_modules/.bin/tsx');
  const tsScript = path.join(PROJECT_ROOT, 'etl/load/sqlite-import-incremental.ts');
  return { cmd: tsxBin, args: [tsScript, sqliteFile, sourceTag] };
}

async function captureMetrics(): Promise<Record<string, number>> {
  try {
    const { rows } = await adminDbService.query(`
      SELECT
        (SELECT COUNT(*) FROM app.networks)               AS networks,
        (SELECT COUNT(*) FROM app.access_points)          AS access_points,
        (SELECT COUNT(*) FROM app.observations)           AS observations,
        (SELECT COUNT(*) FROM app.api_network_explorer_mv) AS in_explorer_mv
    `);
    return {
      networks: parseInt(rows[0].networks),
      access_points: parseInt(rows[0].access_points),
      observations: parseInt(rows[0].observations),
      in_explorer_mv: parseInt(rows[0].in_explorer_mv),
    };
  } catch (e: any) {
    logger.warn(`Failed to capture metrics: ${e.message}`);
    return {};
  }
}

router.post(
  '/admin/import-sqlite',
  upload.single('database'),
  async (req: any, res: any, next: any) => {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No SQLite file uploaded' });
    }

    const rawTag = (req.body?.source_tag || '') as string;
    const sourceTag = rawTag
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 50);

    if (!sourceTag) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        ok: false,
        error: 'source_tag is required (device/source identifier, e.g. s22_backup)',
      });
    }

    const sqliteFile = req.file.path;
    const originalName = req.file.originalname;
    const backupRequested = req.body?.backup === 'true' || req.body?.backup === true;
    const startedAt = new Date();

    logger.info(
      `Starting incremental SQLite import: ${originalName} (source_tag: ${sourceTag}, backup: ${backupRequested})`
    );

    // Capture before metrics
    const metricsBefore = await captureMetrics();

    // Open history row immediately
    let historyId = 0;
    try {
      const { rows } = await adminDbService.query(
        `INSERT INTO app.import_history (source_tag, filename, status, metrics_before)
         VALUES ($1, $2, 'running', $3) RETURNING id`,
        [sourceTag, originalName, JSON.stringify(metricsBefore)]
      );
      historyId = rows[0].id;
    } catch (e: any) {
      logger.warn(`Could not create import_history row: ${e.message}`);
    }

    // Optional backup before import
    let backupTaken = false;
    if (backupRequested) {
      logger.info('Running pre-import backup...');
      try {
        await runPostgresBackup({ uploadToS3: true });
        backupTaken = true;
        logger.info('Pre-import backup complete');
        if (historyId)
          await adminDbService.query(
            `UPDATE app.import_history SET backup_taken = TRUE WHERE id = $1`,
            [historyId]
          );
      } catch (e: any) {
        logger.warn(`Pre-import backup failed (continuing): ${e.message}`);
      }
    }

    const { cmd, args } = getImportCommand(sqliteFile, sourceTag);
    const adminPassword: string = secretsManager.get('db_admin_password') || '';

    const importProcess = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        DB_ADMIN_PASSWORD: adminPassword,
        DB_ADMIN_USER: 'shadowcheck_admin',
      },
    });

    let output = '';
    let errorOutput = '';

    importProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      logger.debug(text.trim());
    });

    importProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      logger.warn(data.toString().trim());
    });

    importProcess.on('close', async (code: number) => {
      try {
        await fs.unlink(sqliteFile);
      } catch (e: any) {
        logger.warn(`Failed to clean up temp file: ${e.message}`);
      }

      const durationS = ((Date.now() - startedAt.getTime()) / 1000).toFixed(2);

      if (code === 0) {
        const importedMatch = output.match(/Imported:\s*([\d,]+)/);
        const failedMatch = output.match(/Failed:\s*([\d,]+)/);
        const imported = importedMatch ? parseInt(importedMatch[1].replace(/,/g, '')) : 0;
        const failed = failedMatch ? parseInt(failedMatch[1].replace(/,/g, '')) : 0;

        const metricsAfter = await captureMetrics();

        if (historyId) {
          await adminDbService.query(
            `UPDATE app.import_history
               SET finished_at   = NOW(),
                   status        = 'success',
                   imported      = $2,
                   failed        = $3,
                   duration_s    = $4,
                   metrics_after = $5
             WHERE id = $1`,
            [historyId, imported, failed, durationS, JSON.stringify(metricsAfter)]
          );
        }

        logger.info(
          `Import complete: ${imported} imported, ${failed} failed (source: ${sourceTag})`
        );

        res.json({
          ok: true,
          message: `Incremental import complete (source: ${sourceTag})`,
          imported,
          failed,
          backupTaken,
          historyId,
          metricsBefore,
          metricsAfter,
          output,
        });
      } else {
        const errMsg = errorOutput.slice(0, 500) || `exit code ${code}`;
        if (historyId) {
          await adminDbService.query(
            `UPDATE app.import_history
               SET finished_at  = NOW(),
                   status       = 'failed',
                   duration_s   = $2,
                   error_detail = $3
             WHERE id = $1`,
            [historyId, durationS, errMsg]
          );
        }

        logger.error(`Import script failed with code ${code}`);
        res.status(500).json({
          ok: false,
          error: 'Import script failed',
          code,
          output,
          errorOutput,
        });
      }
    });

    importProcess.on('error', async (error: Error) => {
      logger.error(`Failed to start import script: ${error.message}`, { error });
      if (historyId) {
        await adminDbService.query(
          `UPDATE app.import_history
             SET finished_at  = NOW(),
                 status       = 'failed',
                 error_detail = $2
           WHERE id = $1`,
          [historyId, error.message]
        );
      }
      try {
        await fs.unlink(sqliteFile);
      } catch (e) {
        // ignore
      }
      res.status(500).json({
        ok: false,
        error: 'Failed to start import process',
        details: error.message,
      });
    });
  }
);

// GET /api/admin/import-history
router.get('/admin/import-history', async (req: any, res: any, next: any) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const { rows } = await adminDbService.query(
      `SELECT id, started_at, finished_at, source_tag, filename,
              imported, failed, duration_s, status, error_detail,
              metrics_before, metrics_after, backup_taken
         FROM app.import_history
        ORDER BY started_at DESC
        LIMIT $1`,
      [limit]
    );
    res.json({ ok: true, history: rows });
  } catch (e: any) {
    next(e);
  }
});

module.exports = router;
