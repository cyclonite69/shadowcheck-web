const express = require('express');
const router = express.Router();
const logger = require('../../../../logging/logger');
const {
  runPostgresBackup,
  listS3Backups,
  deleteS3Backup,
} = require('../../../../services/backupService');

export {};

// POST /api/admin/backup - Run full database backup (no auth yet)
router.post('/admin/backup', async (req, res) => {
  try {
    const { uploadToS3 = false } = req.body;
    const result = await runPostgresBackup({ uploadToS3 });
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error(`[Backup] Failed to run pg_dump: ${err.message}`, { error: err });
    res.status(500).json({ ok: false, error: err.message || 'Backup failed' });
  }
});

// GET /api/admin/backup/s3 - List S3 backups
router.get('/admin/backup/s3', async (req, res) => {
  try {
    const backups = await listS3Backups();
    res.json({ ok: true, backups });
  } catch (err) {
    logger.error(`[Backup] Failed to list S3 backups: ${err.message}`, { error: err });
    res.status(500).json({ ok: false, error: err.message || 'Failed to list S3 backups' });
  }
});

// DELETE /api/admin/backup/s3/:key - Delete S3 backup
router.delete('/admin/backup/s3/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    if (!key || !key.startsWith('backups/')) {
      return res.status(400).json({ ok: false, error: 'Invalid backup key' });
    }

    const result = await deleteS3Backup(key);
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error(`[Backup] Failed to delete S3 backup: ${err.message}`, { error: err });
    res.status(500).json({ ok: false, error: err.message || 'Failed to delete S3 backup' });
  }
});

module.exports = router;
