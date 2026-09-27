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
import { alprSyncService } from '../../../../services/admin/alprSyncService';
import { formatErrorWithCause } from '../../../../utils/formatErrorWithCause';
import { validateAndNormalizeBbox, type Bbox } from '../../../../../../src/alpr/bboxValidation';

const router = express.Router();

/**
 * POST /v1/admin/alpr/sync
 *
 * Canonical body:
 *   Predefined region: { regionId: string, prune?: boolean }
 *   Custom bbox:       { bbox: [west, south, east, north] | { west, south, east, north }, prune?: boolean }
 *                      or { regionId: 'custom', bbox: ... }
 *
 * Status codes:
 *   202 - Sync dispatched
 *   400 - Missing or invalid region ID / bounding box
 *   409 - Sync already in progress (advisory lock held)
 */
router.post('/v1/admin/alpr/sync', async (req: any, res: any) => {
  const region = req.body?.regionId;
  const rawBbox = req.body?.bbox;
  const prune = req.body?.prune ?? false;

  if (typeof prune !== 'boolean') {
    return res.status(400).json({
      ok: false,
      error: 'prune must be a boolean',
    });
  }

  // Handle custom bbox sync
  if (rawBbox !== undefined || region === 'custom') {
    if (rawBbox === undefined) {
      return res.status(400).json({
        ok: false,
        error: 'bbox is required for custom region sync',
      });
    }

    let bbox: Bbox;
    try {
      bbox = validateAndNormalizeBbox(rawBbox);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({
        ok: false,
        success: false,
        error: msg,
      });
    }

    try {
      const dispatch = alprSyncService.dispatchCustomBboxSync(bbox, prune);
      if (dispatch.status === 'already_running') {
        return res.status(409).json({ success: false, ...dispatch });
      }
      return res.status(202).json({ success: true, ...dispatch });
    } catch (err: any) {
      const msg: string = err?.message ?? 'Unknown error';
      logger.error('[ALPR Sync] Custom bbox dispatch failed', { bbox, error: msg });
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // Handle predefined region sync
  if (!region || typeof region !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'regionId is required',
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
 * Returns curated metro regions with bounding boxes and durable sync
 * outcome fields from app.alpr_regions (idle defaults when no row yet).
 */
router.get('/v1/admin/alpr/regions', async (_req: any, res: any) => {
  try {
    const regions = await alprSyncService.getRegions();
    return res.json({ ok: true, regions });
  } catch (err: unknown) {
    const msg = formatErrorWithCause(err);
    logger.error('[ALPR] Failed to list regions', { error: msg });
    return res.status(500).json({ ok: false, error: msg });
  }
});

module.exports = router;
export default router;
