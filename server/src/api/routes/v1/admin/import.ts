/**
 * Admin SQLite Import Route
 *
 * Accepts a WiGLE SQLite backup file and a source_tag, then runs the
 * consolidated SQLite importer (which still imports incrementally by source_tag).
 * Optionally takes a DB backup before importing.
 * Every run is recorded in app.import_history with before/after metrics.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fsNative = require('fs');
const fs = fsNative.promises;
const { spawn } = require('child_process');
const {
  secretsManager,
  adminImportHistoryService,
  backupService,
} = require('../../../../config/container');
const { runPostgresBackup } = backupService;
const logger = require('../../../../logging/logger');

export {};

// SQLite magic bytes: "SQLite format 3\0" (first 16 bytes)
const SQLITE_MAGIC = Buffer.from('53514c69746520666f726d61742033', 'hex');

async function validateSQLiteMagic(filePath: string): Promise<boolean> {
  const fd = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(15);
    const { bytesRead } = await fd.read(buf, 0, 15, 0);
    return bytesRead === 15 && buf.equals(SQLITE_MAGIC);
  } finally {
    await fd.close();
  }
}

const upload = multer({
  dest: '/tmp/',
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedExts = ['.sqlite', '.db', '.sqlite3', '.kismet'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only SQLite files (.sqlite, .db, .sqlite3, .kismet) are allowed'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 },
});

const sqlUpload = multer({
  dest: '/tmp/',
  fileFilter: (req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.sql') {
      cb(null, true);
    } else {
      cb(new Error('Only .sql files are allowed'));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 },
});

const PROJECT_ROOT = process.cwd();

function getImportCommand(
  sqliteFile: string,
  sourceTag: string,
  originalName: string
): { cmd: string; args: string[] } {
  const isKismet = originalName.toLowerCase().endsWith('.kismet');
  const scriptBase = isKismet ? 'kismet-import' : 'sqlite-import';

  const compiledCandidates = [
    path.join(PROJECT_ROOT, `dist/server/etl/load/${scriptBase}.js`),
    path.join(PROJECT_ROOT, `etl/load/${scriptBase}.js`),
    path.join(`/app/dist/server/etl/load/${scriptBase}.js`),
  ];
  const tsxCandidates = [
    path.join(PROJECT_ROOT, 'node_modules/.bin/tsx'),
    path.join('/app/node_modules/.bin/tsx'),
  ];
  const tsScriptCandidates = [
    path.join(PROJECT_ROOT, `etl/load/${scriptBase}.ts`),
    path.join(`/app/etl/load/${scriptBase}.ts`),
  ];

  const compiledScript = compiledCandidates.find((p) => fsNative.existsSync(p));
  const tsxBin = tsxCandidates.find((p) => fsNative.existsSync(p));
  const tsScript = tsScriptCandidates.find((p) => fsNative.existsSync(p));

  if (tsxBin && tsScript && process.env.NODE_ENV !== 'production') {
    return { cmd: tsxBin, args: [tsScript, sqliteFile, sourceTag] };
  }
  if (compiledScript) {
    return { cmd: 'node', args: [compiledScript, sqliteFile, sourceTag] };
  }
  if (tsxBin && tsScript) {
    return { cmd: tsxBin, args: [tsScript, sqliteFile, sourceTag] };
  }

  throw new Error(`${scriptBase} script not found (checked consolidated tsx and compiled paths)`);
}

function getSqlImportCommand(sqlFile: string): { cmd: string; args: string[]; env: any } {
  const dbHost = process.env.DB_HOST || 'shadowcheck_postgres';
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'shadowcheck_db';
  const dbUser = process.env.DB_ADMIN_USER || 'shadowcheck_admin';
  const dbPassword =
    secretsManager.get('db_admin_password') ||
    secretsManager.get('db_password') ||
    process.env.DB_PASSWORD ||
    '';

  const args = [
    '-h',
    dbHost,
    '-p',
    dbPort,
    '-U',
    dbUser,
    '-d',
    dbName,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    sqlFile,
  ];

  return {
    cmd: 'psql',
    args,
    env: {
      ...process.env,
      PGPASSWORD: dbPassword,
    },
  };
}

router.post(
  '/admin/import-sqlite',
  upload.single('database'),
  async (req: any, res: any, next: any) => {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No SQLite file uploaded' });
    }

    const isSQLiteFile = await validateSQLiteMagic(req.file.path).catch(() => false);
    if (!isSQLiteFile) {
      await fs.unlink(req.file.path).catch(() => {});
      return res
        .status(400)
        .json({ ok: false, error: 'Uploaded file is not a valid SQLite database' });
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
    const isKismet = originalName.toLowerCase().endsWith('.kismet');
    const backupRequested = req.body?.backup === 'true' || req.body?.backup === true;
    const startedAt = new Date();

    logger.info(
      `Starting ${isKismet ? 'Kismet Sidecar' : 'SQLite'} import: ${originalName} (source_tag: ${sourceTag}, backup: ${backupRequested})`
    );

    const metricsBefore = await adminImportHistoryService.captureImportMetrics();

    let historyId = await adminImportHistoryService.createImportHistoryEntry(
      sourceTag,
      originalName,
      metricsBefore
    );

    let backupTaken = false;
    if (backupRequested) {
      logger.info('Running pre-import backup...');
      try {
        await runPostgresBackup({ uploadToS3: true });
        backupTaken = true;
        logger.info('Pre-import backup complete');
        if (historyId) await adminImportHistoryService.markImportBackupTaken(historyId);
      } catch (e: any) {
        logger.warn(`Pre-import backup failed (continuing): ${e.message}`);
      }
    }

    const { cmd, args } = getImportCommand(sqliteFile, sourceTag, originalName);
    const adminPassword: string = secretsManager.get('db_admin_password') || '';

    const importProcess = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        DB_ADMIN_PASSWORD: adminPassword,
        DB_ADMIN_USER: 'shadowcheck_admin',
      },
    });
    let responseSent = false;

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
      if (responseSent) return;
      try {
        await fs.unlink(sqliteFile);
      } catch (e: any) {
        logger.warn(`Failed to clean up temp file: ${e.message}`);
      }

      const durationS = ((Date.now() - startedAt.getTime()) / 1000).toFixed(2);

      if (code === 0) {
        let imported = 0;
        let failed = 0;

        if (isKismet) {
          // For Kismet, we don't have a specific observation count in the same way,
          // but we mark it as successful. The detailed metrics capture will show table changes.
          imported = 1;
        } else {
          const importedMatch = output.match(/Imported:\s*([\d,]+)/);
          const failedMatch = output.match(/Failed:\s*([\d,]+)/);
          imported = importedMatch ? parseInt(importedMatch[1].replace(/,/g, '')) : 0;
          failed = failedMatch ? parseInt(failedMatch[1].replace(/,/g, '')) : 0;
        }

        const metricsAfter = await adminImportHistoryService.captureImportMetrics();

        if (historyId) {
          await adminImportHistoryService.completeImportSuccess(
            historyId,
            imported,
            failed,
            durationS,
            metricsAfter
          );
        }

        logger.info(
          `Import complete: ${imported} imported, ${failed} failed (source: ${sourceTag})`
        );

        responseSent = true;
        res.json({
          ok: true,
          importType: isKismet ? 'kismet_sidecar' : 'sqlite',
          sourceTag,
          source_tag: sourceTag,
          message: isKismet
            ? `Kismet sidecar import complete (session: ${sourceTag})`
            : `Incremental import complete (source: ${sourceTag})`,
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
          await adminImportHistoryService.failImportHistory(historyId, errMsg, durationS);
        }

        logger.error(`Import script failed with code ${code}`);
        responseSent = true;
        res.status(500).json({
          ok: false,
          importType: 'sqlite',
          sourceTag,
          source_tag: sourceTag,
          error: 'Import script failed',
          code,
          output,
          errorOutput,
        });
      }
    });

    importProcess.on('error', async (error: Error) => {
      if (responseSent) return;
      logger.error(`Failed to start import script: ${error.message}`, { error });
      if (historyId) {
        await adminImportHistoryService.failImportHistory(historyId, error.message);
      }
      try {
        await fs.unlink(sqliteFile);
      } catch (e) {
        // ignore
      }
      responseSent = true;
      res.status(500).json({
        ok: false,
        importType: 'sqlite',
        sourceTag,
        source_tag: sourceTag,
        error: 'Failed to start import process',
        details: error.message,
      });
    });
  }
);

// POST /api/admin/import-sql
router.post('/admin/import-sql', sqlUpload.single('sql_file'), async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No SQL file uploaded' });
  }

  const sqlFile = req.file.path;
  const originalName = req.file.originalname;
  const backupRequested = req.body?.backup === 'true' || req.body?.backup === true;
  const rawTag = (req.body?.source_tag || 'sql_upload') as string;
  const sourceTag = rawTag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 50);
  const startedAt = Date.now();

  try {
    logger.info(
      `Starting SQL import: ${originalName} (source_tag: ${sourceTag}, backup: ${backupRequested})`
    );

    const metricsBefore = await adminImportHistoryService.captureImportMetrics();
    const historyId = await adminImportHistoryService.createImportHistoryEntry(
      sourceTag,
      originalName,
      metricsBefore
    );

    let backupTaken = false;
    if (backupRequested) {
      try {
        await runPostgresBackup({ uploadToS3: true });
        backupTaken = true;
        if (historyId) await adminImportHistoryService.markImportBackupTaken(historyId);
      } catch (e: any) {
        logger.warn(`Pre-SQL-import backup failed (continuing): ${e.message}`);
      }
    }

    const { cmd, args, env } = getSqlImportCommand(sqlFile);
    const p = spawn(cmd, args, { cwd: PROJECT_ROOT, env });

    let output = '';
    let errorOutput = '';

    p.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    p.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    p.on('close', async (code: number) => {
      await fs.unlink(sqlFile).catch(() => {});
      const durationS = ((Date.now() - startedAt) / 1000).toFixed(2);
      const metricsAfter = await adminImportHistoryService.captureImportMetrics();

      if (code === 0) {
        if (historyId) {
          await adminImportHistoryService.completeImportSuccess(
            historyId,
            0,
            0,
            durationS,
            metricsAfter
          );
        }

        const metricsDelta = Object.keys(metricsAfter).reduce(
          (acc: Record<string, number>, key: string) => {
            acc[key] = (metricsAfter[key] || 0) - (metricsBefore[key] || 0);
            return acc;
          },
          {}
        );

        return res.json({
          ok: true,
          importType: 'sql',
          message: `SQL import complete: ${originalName}`,
          sourceTag,
          source_tag: sourceTag,
          backupTaken,
          historyId,
          durationSec: durationS,
          metricsBefore,
          metricsAfter,
          metricsDelta,
          output: output.slice(-10000),
        });
      }

      const errMsg = errorOutput.slice(0, 500) || `exit code ${code}`;
      if (historyId) {
        await adminImportHistoryService.failImportHistory(historyId, errMsg, durationS);
      }

      return res.status(500).json({
        ok: false,
        error: 'SQL import failed',
        code,
        sourceTag,
        historyId,
        durationSec: durationS,
        metricsBefore,
        metricsAfter,
        output: output.slice(-10000),
        errorOutput: errorOutput.slice(-10000),
      });
    });

    p.on('error', async (error: Error) => {
      await fs.unlink(sqlFile).catch(() => {});
      const durationS = ((Date.now() - startedAt) / 1000).toFixed(2);
      if (historyId) {
        await adminImportHistoryService.failImportHistory(historyId, error.message, durationS);
      }
      return res.status(500).json({
        ok: false,
        importType: 'sql',
        sourceTag,
        source_tag: sourceTag,
        error: 'Failed to start SQL import process',
        historyId,
        durationSec: durationS,
        details: error.message,
      });
    });
  } catch (e: any) {
    await fs.unlink(sqlFile).catch(() => {});
    return res.status(500).json({
      ok: false,
      error: e.message || 'SQL import failed',
    });
  }
});

// GET /api/admin/import-history
router.get('/admin/import-history', async (req: any, res: any, next: any) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const history = await adminImportHistoryService.getImportHistory(limit);
    res.json({ ok: true, history });
  } catch (e: any) {
    next(e);
  }
});

// GET /api/admin/device-sources — known source tags with last import date
router.get('/admin/device-sources', async (req: any, res: any, next: any) => {
  try {
    const sources = await adminImportHistoryService.getDeviceSources();
    res.json({ ok: true, sources });
  } catch (e: any) {
    next(e);
  }
});

module.exports = router;
