/**
 * Admin ALPR Sync Routes
 *
 * Canonical Admin Endpoints:
 *   GET  /api/admin/alpr/regions - List curated US metro regions for ALPR sync
 *   POST /api/admin/alpr/sync    - Trigger in-process Overpass sync for a region
 *
 * Protected by parent admin router's `requireAdmin` middleware.
 */

const express = require('express');
const logger = require('../../../../logging/logger');
const { longRunningPool } = require('../../../../config/database');
import { syncAlprRegion, ALPR_REGIONS } from '../../../../services/admin/alprSyncService';

const router = express.Router();

/**
 * POST /admin/alpr/sync
 *
 * Canonical body: { region: string, prune?: boolean }
 *
 * Status codes:
 *   200 - Sync completed successfully
 *   400 - Missing or invalid region ID
 *   409 - Sync already in progress (advisory lock held)
 *   502 - Overpass API network/gateway error
 *   500 - Unexpected database or server error
 */
router.post('/admin/alpr/sync', async (req: any, res: any) => {
  const region = req.body?.region;
  const prune = req.body?.prune ?? false;

  if (!region || typeof region !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'Region identifier is required',
    });
  }
  if (typeof prune !== 'boolean') {
    return res.status(400).json({
      ok: false,
      error: 'prune must be a boolean',
    });
  }

  logger.info(`[ALPR Sync] Starting sync for region '${region}'`, { prune });

  try {
    const result = await syncAlprRegion(longRunningPool, region, Boolean(prune));

    logger.info(`[ALPR Sync] Completed '${region}'`, {
      upserted: result.upsertedCount,
      pruned: result.prunedCount,
      durationMs: result.durationMs,
    });

    return res.json({
      ok: true,
      upserts: result.upsertedCount,
      result,
    });
  } catch (err: any) {
    const msg: string = err?.message ?? 'Unknown error';

    if (msg.startsWith('Unknown ALPR region id')) {
      return res.status(400).json({
        ok: false,
        error: msg,
      });
    }

    if (msg === 'ALPR synchronization is already in progress') {
      return res.status(409).json({
        ok: false,
        error: msg,
      });
    }

    const isNetworkError =
      msg.includes('fetch') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('HTTP') ||
      msg.includes('Overpass');

    logger.error(`[ALPR Sync] Failed for region '${region}'`, { error: msg });
    return res.status(isNetworkError ? 502 : 500).json({
      ok: false,
      error: msg,
    });
  }
});

/**
 * GET /admin/alpr/regions
 *
 * Returns curated list of 30 metro regions with bounding boxes.
 */
router.get('/admin/alpr/regions', (_req: any, res: any) => {
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
