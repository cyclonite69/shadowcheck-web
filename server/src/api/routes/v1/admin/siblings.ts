const express = require('express');
const logger = require('../../../../logging/logger');
const {
  siblingDetectionAdminService,
  adminSiblingService,
} = require('../../../../config/container');

export {};

const router = express.Router();

router.post('/admin/siblings/override', async (req: any, res: any) => {
  try {
    const relation = req.body?.relation === 'not_sibling' ? 'not_sibling' : 'sibling';
    const bssidA = String(req.body?.bssidA || '')
      .trim()
      .toUpperCase();
    const bssidB = String(req.body?.bssidB || '')
      .trim()
      .toUpperCase();
    const notes =
      typeof req.body?.notes === 'string' && req.body.notes.trim().length > 0
        ? req.body.notes.trim()
        : null;

    if (!bssidA || !bssidB) {
      return res.status(400).json({
        ok: false,
        error: 'Both bssidA and bssidB are required',
      });
    }

    if (bssidA === bssidB) {
      return res.status(400).json({
        ok: false,
        error: 'A network cannot be paired with itself',
      });
    }

    await adminSiblingService.setNetworkSiblingOverride(
      bssidA,
      bssidB,
      relation,
      req.user?.username || 'admin',
      notes,
      1.0
    );

    res.json({
      ok: true,
      pair: {
        bssidA,
        bssidB,
        relation,
      },
    });
  } catch (err: any) {
    logger.error('[Siblings] Failed to save manual override', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to save sibling override',
    });
  }
});

router.get('/admin/siblings/linked/:bssid', async (req: any, res: any) => {
  try {
    const bssid = String(req.params?.bssid || '')
      .trim()
      .toUpperCase();

    if (!bssid) {
      return res.status(400).json({
        ok: false,
        error: 'BSSID is required',
      });
    }

    const links = await adminSiblingService.getNetworkSiblingLinks(bssid);
    res.json({
      ok: true,
      bssid,
      links,
    });
  } catch (err: any) {
    logger.error('[Siblings] Failed to load linked siblings', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to load linked siblings',
    });
  }
});

router.post('/admin/siblings/linked-batch', async (req: any, res: any) => {
  try {
    const rawBssids = Array.isArray(req.body?.bssids) ? req.body.bssids : [];
    const bssids = Array.from(
      new Set(
        rawBssids
          .map((value: any) =>
            String(value || '')
              .trim()
              .toUpperCase()
          )
          .filter(Boolean)
      )
    );

    if (bssids.length === 0) {
      return res.json({
        ok: true,
        links: [],
      });
    }

    const links = await adminSiblingService.getNetworkSiblingLinksBatch(bssids);
    res.json({
      ok: true,
      links,
    });
  } catch (err: any) {
    logger.error('[Siblings] Failed to load batch linked siblings', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to load batch sibling links',
    });
  }
});

router.post('/admin/siblings/refresh', async (req: any, res: any) => {
  try {
    const { batchSize, maxOctetDelta, maxDistanceM, minCandidateConf, minStrongConf, maxBatches } =
      req.body || {};

    const result = await siblingDetectionAdminService.startSiblingRefresh({
      batchSize,
      maxOctetDelta,
      maxDistanceM,
      minCandidateConf,
      minStrongConf,
      maxBatches,
    });

    res.status(result.accepted ? 202 : 409).json({
      ok: result.accepted,
      message: result.accepted
        ? 'Sibling refresh started in background'
        : 'Sibling refresh already running',
      status: result.status,
    });
  } catch (err: any) {
    logger.error('[Siblings] Failed to start refresh', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to start sibling refresh',
    });
  }
});

router.get('/admin/siblings/refresh/status', (req: any, res: any) => {
  try {
    const status = siblingDetectionAdminService.getSiblingRefreshStatus();
    res.json({ ok: true, status });
  } catch (err: any) {
    logger.error('[Siblings] Failed to load refresh status', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to load sibling refresh status',
    });
  }
});

router.get('/admin/siblings/stats', async (req: any, res: any) => {
  try {
    const stats = await siblingDetectionAdminService.getSiblingStats();
    res.json({ ok: true, stats });
  } catch (err: any) {
    logger.error('[Siblings] Failed to load stats', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to load sibling stats',
    });
  }
});

module.exports = router;
