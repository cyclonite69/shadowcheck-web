/**
 * WiGLE Batch Enrichment Routes
 * Thin router — delegates entirely to wigleEnrichmentService.
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../../../middleware/authMiddleware';
import { assertBulkWigleAllowed } from '../../../../services/wigleBulkPolicy';

const router = express.Router();
const { asyncHandler } = require('../../../../utils/asyncHandler');
const wigleEnrichmentService = require('../../../../services/wigleEnrichmentService');

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
 * Browse the v2 search catalog with enrichment stats.
 */
router.get(
  '/enrichment/catalog',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, region, city, ssid, bssid } = req.query;
    const catalog = await wigleEnrichmentService.getEnrichmentCatalog({
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      region: region as string,
      city: city as string,
      ssid: ssid as string,
      bssid: bssid as string,
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
      if (!Array.isArray(bssids) || bssids.length === 0) {
        assertBulkWigleAllowed('Start Batch Enrichment (Full Backlog)');
      }
      const run = await wigleEnrichmentService.startBatchEnrichment(bssids);
      res.json({ ok: true, run });
    } catch (err: any) {
      if (err?.status === 403) {
        return res.status(403).json({ ok: false, error: err.message, code: err.code });
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
  asyncHandler(async (req: Request, res: Response) => {
    const run = await wigleEnrichmentService.resumeEnrichment(Number(req.params.runId));
    res.json({ ok: true, run });
  })
);

export default router;
