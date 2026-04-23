const express = require('express');
const router = express.Router();
const { adminOrphanNetworksService } = require('../../../../../config/container');

router.get('/orphan-networks', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search = String(req.query.search || '').trim();
    const rows = await adminOrphanNetworksService.listOrphanNetworks({ search, limit, offset });
    const counts = await adminOrphanNetworksService.getOrphanNetworkCounts({ search });
    res.json({
      ok: true,
      total: counts.total,
      rows,
      pagination: { limit, offset, hasMore: offset + rows.length < counts.total },
    });
  } catch (e) {
    next(e);
  }
});

router.post('/orphan-networks/:bssid/check-wigle', async (req, res, next) => {
  try {
    const result = await adminOrphanNetworksService.backfillOrphanNetworkFromWigle(
      req.params.bssid
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
