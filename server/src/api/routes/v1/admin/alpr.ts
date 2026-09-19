/**
 * Admin ALPR Sync Routes
 *
 * Canonical Admin Endpoints:
 *   GET  /api/v1/admin/alpr/regions - List curated US metro regions for ALPR sync
 *   POST /api/v1/admin/alpr/sync    - Dispatch an asynchronous region sync
 *   GET  /api/v1/admin/alpr/sync/status - Get sync job status
 *
 * Protected by parent admin router's `requireAdmin` middleware.
 */

const express = require('express');
const logger = require('../../../../logging/logger');
import { alprSyncService, ALPR_REGIONS } from '../../../../services/admin/alprSyncService';

const router = express.Router();

/**
 * POST /v1/admin/alpr/sync
 *
 * Canonical body: { regionId: string, prune?: boolean }
 *
 * Status codes:
 *   202 - Sync dispatched
 *   400 - Missing or invalid region ID
 *   409 - Sync already in progress (advisory lock held)
 */
router.post('/v1/admin/alpr/sync', async (req: any, res: any) => {
  const region = req.body?.regionId;
  const prune = req.body?.prune ?? false;

  if (!region || typeof region !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'regionId is required',
    });
  }
  if (typeof prune !== 'boolean') {
    return res.status(400).json({
      ok: false,
      error: 'prune must be a boolean',
    });
  }

  try {
    const dispatch = alprSyncService.dispatchRegionSync(region, prune);
    if (dispatch.status === 'already_running') {
      return res.status(409).json({ success: false, ...dispatch });
    }
    return res.status(202).json({ success: true, ...dispatch });
  } catch (err: any) {
    const msg: string = err?.message ?? 'Unknown error';

    if (msg.startsWith('Unknown ALPR region id')) {
      return res.status(400).json({
        success: false,
        error: msg,
      });
    }
    logger.error(`[ALPR Sync] Dispatch failed for region '${region}'`, { error: msg });
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /v1/admin/alpr/sync/status
 */
router.get('/v1/admin/alpr/sync/status', (req: any, res: any) => {
  const regionId = req.query?.regionId;
  if (regionId !== undefined && typeof regionId !== 'string') {
    return res.status(400).json({ success: false, error: 'regionId must be a string' });
  }
  return res.json({
    success: true,
    jobs: alprSyncService.getSyncStatus(regionId),
  });
});

/**
 * GET /v1/admin/alpr/regions
 *
 * Returns curated list of 30 metro regions with bounding boxes.
 */
router.get('/v1/admin/alpr/regions', (_req: any, res: any) => {
  const regions = ALPR_REGIONS.map((r) => ({
    id: r.id,
    name: r.label,
    label: r.label,
    state: r.state,
    bbox: r.bbox,
  }));

  res.json({
    ok: true,
    regions,
  });
});

module.exports = router;
export default router;
