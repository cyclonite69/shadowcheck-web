const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { adminImportHistoryService, backupService } = require('../../../../../config/container');
const { runPostgresBackup } = backupService;
const logger = require('../../../../../logging/logger');
const {
  sqlUpload,
  getSqlImportCommand,
  PROJECT_ROOT,
} = require('../../../../../services/admin/adminHelpers');

router.post('/admin/import-sql', sqlUpload.single('sql_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No SQL file uploaded' });
  }
  const sqlFile = req.file.path;
  const originalName = req.file.originalname;
  const backupRequested = req.body?.backup === 'true' || req.body?.backup === true;
  const sourceTag = (req.body?.source_tag || 'sql_upload')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 50);
  const startedAt = Date.now();
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
  const { cmd, args, env } = getSqlImportCommand(sqlFile);
  const p = spawn(cmd, args, { cwd: PROJECT_ROOT, env });
  let output = '',
    errorOutput = '';
  p.stdout.on('data', (d) => (output += d));
  p.stderr.on('data', (d) => (errorOutput += d));
  p.on('error', async (err) => {
    if (historyId) {
      await adminImportHistoryService.failImportHistory(historyId, err.message, '0');
    }
    res.status(500).json({ ok: false, error: err.message });
  });
  p.on('close', async (code) => {
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
      res.json({
        ok: true,
        sourceTag,
        backupTaken,
        historyId,
        durationSec: durationS,
        metricsBefore,
        metricsAfter,
        output: output.slice(-10000),
      });
    } else {
      if (historyId) {
        await adminImportHistoryService.failImportHistory(
          historyId,
          errorOutput.slice(0, 500) || `code ${code}`,
          durationS
        );
      }
      res.status(500).json({
        ok: false,
        error: 'SQL import failed',
        code,
        output: output.slice(-10000),
        errorOutput: errorOutput.slice(-10000),
      });
    }
  });
});
module.exports = router;
