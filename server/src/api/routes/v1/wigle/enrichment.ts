/**
 * WiGLE Batch Enrichment Routes
 * Thin router — delegates entirely to wigleEnrichmentService.
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../../../middleware/authMiddleware';

const router = express.Router();
const { asyncHandler } = require('../../../../utils/asyncHandler');
const { wigleEnrichmentService } = require('../../../../config/container');
const { serializeRun } = require('../../../../services/wigleImport/serialization');

/**
 * GET /api/v1/wigle/enrichment/stats
 * Count of v2 networks awaiting v3 enrichment.
 */
router.get(
  '/enrichment/stats',
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const pendingCount = await wigleEnrichmentService.getPendingEnrichmentCount();
    res.json({ ok: true, pendingCount });
  })
);

/**
 * GET /api/v1/wigle/enrichment/catalog
 * Browse the v2 search catalog with per-BSSID v3 enrichment stats.
 * Supports server-side multi-column sort via sortBy/sortDir query params.
 * @param {string} [sortBy] - Comma-separated sort keys (ssid|firsttime|lasttime|last_v3_import|signal|channel|encryption|status|location)
 * @param {string} [sortDir] - Comma-separated directions matching sortBy (asc|desc). Defaults to asc.
 */
router.get(
  '/enrichment/catalog',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, region, city, ssid, bssid, sortBy, sortDir } = req.query;
    const catalog = await wigleEnrichmentService.getEnrichmentCatalog({
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      region: region as string,
      city: city as string,
      ssid: ssid as string,
      bssid: bssid as string,
      sortBy: sortBy as string,
      sortDir: sortDir as string,
    });
    res.json({ ok: true, ...catalog });
  })
);

/**
 * POST /api/v1/wigle/enrichment/start
 * Start a new batch enrichment run.
 */
router.post(
  '/enrichment/start',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bssids } = req.body;
      const run = await wigleEnrichmentService.startBatchEnrichment(bssids);
      res.json({ ok: true, run: serializeRun(run) });
    } catch (err: any) {
      if (err?.status === 400) {
        return res.status(400).json({ ok: false, error: err.message });
      }
      if (err?.status === 403) {
        return res.status(403).json({ ok: false, error: err.message, code: err.code });
      }
      if (err?.status === 409) {
        return res.status(409).json({ ok: false, error: err.message, code: 'ENRICHMENT_CONFLICT' });
      }
      next(err);
    }
  }
);

/**
 * POST /api/v1/wigle/enrichment/resume/:runId
 * Resume an existing enrichment run.
 */
router.post(
  '/enrichment/resume/:runId',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const runId = Number(req.params.runId);
      if (!Number.isFinite(runId) || runId <= 0) {
        return res.status(400).json({ ok: false, error: 'Invalid run id' });
      }
      const run = await wigleEnrichmentService.resumeEnrichment(runId);
      res.json({ ok: true, run });
    } catch (err: any) {
      if (err?.status === 400) {
        return res.status(400).json({ ok: false, error: err.message });
      }
      if (err?.status === 404) {
        return res.status(404).json({ ok: false, error: err.message });
      }
      if (err?.status === 409) {
        return res.status(409).json({
          ok: false,
          error: err.message,
          code: err.code || 'ENRICHMENT_CONFLICT',
        });
      }
      next(err);
    }
  }
);

/**
 * POST /api/v1/wigle/enrichment/force-clear/:runId
 * Force a stuck 'running' enrichment run to 'failed' so a new run can start.
 */
router.post(
  '/enrichment/force-clear/:runId',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { cleared } = await wigleEnrichmentService.forceClearEnrichmentRun(
      Number(req.params.runId)
    );
    res.json({ ok: true, cleared });
  })
);

export default router;
