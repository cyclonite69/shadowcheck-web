const express = require('express');
const router = express.Router();
const {
  adminImportHistoryService,
  mobileIngestService,
} = require('../../../../../config/container');
const logger = require('../../../../../logging/logger');

router.get('/admin/import-history', async (req, res, next) => {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(parsedLimit || 20, 1), 100);
    const beforeStartedAt = req.query.beforeStartedAt;
    const beforeIdRaw = req.query.beforeId;
    const beforeId =
      typeof beforeIdRaw === 'string' && /^\d+$/.test(beforeIdRaw)
        ? Number(beforeIdRaw)
        : Number.NaN;
    let cursor;

    if (beforeStartedAt !== undefined || beforeIdRaw !== undefined) {
      if (
        typeof beforeStartedAt !== 'string' ||
        Number.isNaN(Date.parse(beforeStartedAt)) ||
        !Number.isSafeInteger(beforeId) ||
        beforeId <= 0
      ) {
        return res.status(400).json({ ok: false, error: 'Invalid import history cursor' });
      }
      cursor = { startedAt: beforeStartedAt, id: beforeId };
    }

    const rows = await adminImportHistoryService.getImportHistory(limit + 1, cursor);
    const hasMore = rows.length > limit;
    const history = hasMore ? rows.slice(0, limit) : rows;
    res.json({ ok: true, history, hasMore });
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
