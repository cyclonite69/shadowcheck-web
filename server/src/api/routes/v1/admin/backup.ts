import type { Request, Response } from 'express';
const express = require('express');
const router = express.Router();
const logger = require('../../../../logging/logger');
const { backupService } = require('../../../../config/container');
const { runPostgresBackup, listS3Backups, deleteS3Backup } = backupService;

export {};

// POST /api/admin/backup - Run full database backup (no auth yet)
router.post('/admin/backup', async (req: Request, res: Response) => {
  try {
    const { uploadToS3 = false } = req.body;
    const result = await runPostgresBackup({ uploadToS3 });
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Backup] Failed to run pg_dump: ${msg}`, { error: err });
    res.status(500).json({ ok: false, error: msg || 'Backup failed' });
  }
});

// GET /api/admin/backup/s3 - List S3 backups
router.get('/admin/backup/s3', async (req: Request, res: Response) => {
  try {
    const backups = await listS3Backups();
    res.json({ ok: true, backups });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('S3_BACKUP_BUCKET is not configured')) {
      return res.json({
        ok: true,
        backups: [],
        configured: false,
        message: msg,
      });
    }
    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        ok: true,
        backups: [],
        configured: false,
        message: msg || 'S3 backup listing unavailable in local development',
      });
    }
    logger.error(`[Backup] Failed to list S3 backups: ${msg}`, { error: err });
    res.status(500).json({ ok: false, error: msg || 'Failed to list S3 backups' });
  }
});

// DELETE /api/admin/backup/s3/:key - Delete S3 backup
router.delete('/admin/backup/s3/:key(*)', async (req: Request, res: Response) => {
  try {
    const key = req.params['key'];
    if (!key || !String(key).startsWith('backups/')) {
      return res.status(400).json({ ok: false, error: 'Invalid backup key' });
    }

    const result = await deleteS3Backup(key);
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Backup] Failed to delete S3 backup: ${msg}`, { error: err });
    res.status(500).json({ ok: false, error: msg || 'Failed to delete S3 backup' });
  }
});

module.exports = router;
