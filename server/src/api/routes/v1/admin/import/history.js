const express = require('express');
const router = express.Router();
const {
  adminImportHistoryService,
  mobileIngestService,
} = require('../../../../../config/container');
const logger = require('../../../../../logging/logger');

router.get('/admin/import-history', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const history = await adminImportHistoryService.getImportHistory(limit);
    res.json({ ok: true, history });
  } catch (e) {
    next(e);
  }
});

router.post('/admin/import/mobile/:uploadId/start', async (req, res, next) => {
  try {
    const uploadId = Number.parseInt(String(req.params.uploadId), 10);
    if (!Number.isFinite(uploadId) || uploadId <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid uploadId' });
    }
    await mobileIngestService.startPendingUpload(uploadId);
    void mobileIngestService
      .processUpload(uploadId, { skipStateTransition: true })
      .catch((err) => logger.error(`[MobileIngest] ${err.message}`));
    return res.json({ ok: true, started: true });
  } catch (e) {
    if (e.message?.includes('not found')) {
      return res.status(404).json({ ok: false, error: e.message });
    }
    if (e.message?.includes('not pending')) {
      return res.status(409).json({ ok: false, error: e.message });
    }
    return next(e);
  }
});

router.get('/admin/device-sources', async (req, res, next) => {
  try {
    const sources = await adminImportHistoryService.getDeviceSources();
    res.json({ ok: true, sources });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
