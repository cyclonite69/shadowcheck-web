const express = require('express');
const router = express.Router();
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { secretsManager, adminImportHistoryService } = require('../../../../../config/container');
const logger = require('../../../../../logging/logger');
const { runAwsCliJson } = require('../../../../../services/backup/awsCli');
const {
  sanitizeRelativePath,
  parseRelativePathsPayload,
  getKmlImportHistoryContext,
  parseKmlImportCounts,
  kmlUpload,
  getKmlImportCommand,
  PROJECT_ROOT,
} = require('../../../../../services/admin/adminHelpers');

const cleanupPaths = async (paths) => {
  for (const p of paths) {
    await fs.rm(p, { force: true, recursive: true }).catch(() => {});
  }
};

router.post('/admin/import-kml', kmlUpload.array('files', 1000), async (req, res) => {
  const uploadedFiles = req.files || [];
  if (uploadedFiles.length === 0) {
    return res.status(400).json({ ok: false, error: 'No KML files' });
  }
  const startedAt = Date.now();
  const sourceType =
    String(req.body?.source_type || 'wigle')
      .trim()
      .toLowerCase() || 'wigle';
  const uploadToS3 = req.body?.upload_to_s3 !== 'false';
  const bucketName = String(process.env.S3_BACKUP_BUCKET || '').trim();
  const prefix = String(process.env.KML_IMPORT_PREFIX || 'imports/kml/').replace(/^\/+|\/+$/g, '');
  const batchId = `kml_${Date.now()}`;
  let relativePaths;
  try {
    relativePaths = parseRelativePathsPayload(req.body?.relative_paths);
  } catch (parseErr) {
    return res.status(400).json({ ok: false, error: parseErr.message });
  }
  const tempBatchDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kml-import-'));
  const cleanupTargets = uploadedFiles.map((f) => f.path).concat(tempBatchDir);
  let historyId = 0;

  try {
    const metricsBefore = await adminImportHistoryService.captureImportMetrics();
    const historyContext = getKmlImportHistoryContext(sourceType, uploadedFiles, relativePaths);
    historyId = await adminImportHistoryService.createImportHistoryEntry(
      historyContext.sourceTag,
      historyContext.filename,
      metricsBefore
    );
    for (let i = 0; i < uploadedFiles.length; i += 1) {
      const file = uploadedFiles[i];
      const rel = sanitizeRelativePath(relativePaths[i] || file.originalname);
      const dest = path.join(tempBatchDir, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.rename(file.path, dest);
      if (uploadToS3 && bucketName) {
        await runAwsCliJson(['s3', 'cp', dest, `s3://${bucketName}/${prefix}/${batchId}/${rel}`]);
      }
    }
    const { cmd, args } = getKmlImportCommand(tempBatchDir, sourceType);
    const importResult = await new Promise((resolve, reject) => {
      const p = spawn(cmd, args, {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          DB_ADMIN_PASSWORD: secretsManager.get('db_admin_password') || '',
          DB_ADMIN_USER: 'shadowcheck_admin',
        },
      });
      let output = '',
        errorOutput = '';
      p.stdout.on('data', (d) => (output += d));
      p.stderr.on('data', (d) => (errorOutput += d));
      p.on('close', (code) => resolve({ code, output, errorOutput }));
      p.on('error', reject);
    });
    const durationSec = ((Date.now() - startedAt) / 1000).toFixed(2);
    if (importResult.code !== 0) {
      if (historyId) {
        await adminImportHistoryService.failImportHistory(
          historyId,
          importResult.errorOutput || `code ${importResult.code}`,
          durationSec
        );
      }
      return res.status(500).json({
        ok: false,
        error: 'KML import failed',
        output: importResult.output,
        errorOutput: importResult.errorOutput,
      });
    }
    const { filesImported, pointsImported } = parseKmlImportCounts(
      importResult.output,
      uploadedFiles.length
    );
    const metricsAfter = await adminImportHistoryService.captureImportMetrics();
    if (historyId) {
      await adminImportHistoryService.completeImportSuccess(
        historyId,
        pointsImported,
        Math.max(uploadedFiles.length - filesImported, 0),
        durationSec,
        metricsAfter
      );
    }
    res.json({
      ok: true,
      importType: 'kml',
      batchId,
      filesImported,
      pointsImported,
      durationSec,
      historyId,
      metricsBefore,
      metricsAfter,
      output: importResult.output,
    });
  } catch (err) {
    if (historyId) {
      await adminImportHistoryService.failImportHistory(
        historyId,
        err.message,
        ((Date.now() - startedAt) / 1000).toFixed(2)
      );
    }
    res.status(500).json({ ok: false, error: err.message });
    logger.error(`KML import failed (batch: ${batchId}): ${err.message}`, { error: err, batchId });
  } finally {
    await cleanupPaths(cleanupTargets);
  }
});
module.exports = router;
