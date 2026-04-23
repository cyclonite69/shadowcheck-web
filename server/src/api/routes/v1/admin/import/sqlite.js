const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const { spawn } = require('child_process');
const {
  secretsManager,
  adminImportHistoryService,
  backupService,
} = require('../../../../../config/container');
const { runPostgresBackup } = backupService;
const logger = require('../../../../../logging/logger');
const {
  upload,
  validateSQLiteMagic,
  getImportCommand,
  PROJECT_ROOT,
} = require('../../../../../services/admin/adminHelpers');

router.post('/import-sqlite', upload.single('database'), async (req, res) => {
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
  const sourceTag = (req.body?.source_tag || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 50);
  if (!sourceTag) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ ok: false, error: 'source_tag is required' });
  }
  const sqliteFile = req.file.path;
  const originalName = req.file.originalname;
  const backupRequested = req.body?.backup === 'true' || req.body?.backup === true;
  const startedAt = new Date();
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
      if (historyId) {
        await adminImportHistoryService.markImportBackupTaken(historyId);
      }
    } catch (e) {
      logger.warn(`Backup failed: ${e.message}`);
    }
  }
  const { cmd, args } = getImportCommand(sqliteFile, sourceTag, originalName);
  const importProcess = spawn(cmd, args, {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      DB_ADMIN_PASSWORD: secretsManager.get('db_admin_password') || '',
      DB_ADMIN_USER: 'shadowcheck_admin',
    },
  });
  let output = '',
    errorOutput = '';
  importProcess.stdout.on('data', (d) => (output += d));
  importProcess.stderr.on('data', (d) => (errorOutput += d));
  importProcess.on('close', async (code) => {
    await fs.unlink(sqliteFile).catch(() => {});
    const durationS = ((Date.now() - startedAt.getTime()) / 1000).toFixed(2);
    if (code === 0) {
      const imported = output.match(/Imported:\s*([\d,]+)/)?.[1].replace(/,/g, '') || 0;
      const failed = output.match(/Failed:\s*([\d,]+)/)?.[1].replace(/,/g, '') || 0;
      const metricsAfter = await adminImportHistoryService.captureImportMetrics();
      if (historyId) {
        await adminImportHistoryService.completeImportSuccess(
          historyId,
          parseInt(imported),
          parseInt(failed),
          durationS,
          metricsAfter
        );
      }
      res.json({
        ok: true,
        sourceTag,
        imported,
        failed,
        backupTaken,
        historyId,
        metricsBefore,
        metricsAfter,
        output,
      });
    } else {
      if (historyId) {
        await adminImportHistoryService.failImportHistory(
          historyId,
          errorOutput.slice(0, 500) || `exit code ${code}`,
          durationS
        );
      }
      res.status(500).json({ ok: false, error: 'Import failed', code, output, errorOutput });
    }
  });
});

module.exports = router;
