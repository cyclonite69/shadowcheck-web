/**
 * WiGLE Search API Routes
 * Thin router — delegates to wigleSearchService, wigleImportRunService, and wigleBluetoothImportService.
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
const router = express.Router();
const {
  wigleImportRunService,
  wigleBluetoothImportService,
} = require('../../../../config/container');
import logger from '../../../../logging/logger';
import { requireAdmin } from '../../../../middleware/authMiddleware';
import { validateImportQuery as validateSearchQuery } from '../../../../services/wigleImport/params';
import { WigleValidationError } from '../../../../services/wigleImport/wigleApiSpec';
import {
  searchWigle,
  getSavedSsidTerms,
  upsertSavedSsidTerm,
  deleteSavedSsidTerm,
} from '../../../../services/wigleSearchService';
import { buildRunImportResponse } from '../../../../services/wigleSearchTransforms';

/**
 * POST/GET /search-api - Search WiGLE API with optional import
 */
router.all('/search-api', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const validationError = validateSearchQuery(req.query);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const shouldImport = req.body?.import === true || req.query?.import === 'true';
    const query = { ...req.query, version: req.query.version ?? 'v2' };

    const result = await searchWigle(query, shouldImport);
    if (!result.ok) {
      return res.status(result.status).json(result);
    }
    res.json(result);
  } catch (err: any) {
    if (err instanceof WigleValidationError) {
      logger.error(`[WiGLE] VALIDATION_BLOCKED ${err.message}`, {
        invalidKey: err.invalidKey,
        invalidValue: err.invalidValue,
      });
      return res
        .status(400)
        .json({ ok: false, status: 400, error: `Invalid search parameter: ${err.message}` });
    }
    logger.error(`[WiGLE] Search error: ${err.message}`, { error: err });
    next(err);
  }
});

/**
 * POST /search-api/import-all - Start or resume a full paginated import run
 */
router.post(
  '/search-api/import-all',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = { ...req.query, ...req.body };
      const validationError = wigleImportRunService.validateImportQuery(query);
      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }

      const runId =
        query.runId !== null && query.runId !== undefined
          ? Number.parseInt(String(query.runId), 10)
          : null;
      const resumeLatest = query.resumeLatest === true || query.resumeLatest === 'true';

      const run = runId
        ? await wigleImportRunService.resumeImportRun(runId)
        : resumeLatest
          ? await wigleImportRunService.resumeLatestImportRun(query)
          : await wigleImportRunService.startImportRun(query);

      return res.json(buildRunImportResponse(run));
    } catch (err: any) {
      logger.error(`[WiGLE] Import-all error: ${err.message}`, { error: err });
      if (err?.status === 403) {
        return res.status(403).json({ ok: false, error: err.message, code: err.code });
      }
      next(err);
    }
  }
);

/**
 * GET /api/v1/wigle/search-api/import-runs
 * Paginated list of WiGLE import runs with server-side sort.
 * @param {number} [page=1] - Page number (1-based)
 * @param {number} [limit=100] - Page size
 * @param {string} [status] - Filter by status (running|paused|failed|completed|cancelled)
 * @param {string} [state] - Filter by US state code
 * @param {string} [searchTerm] - Filter by search term (ILIKE)
 * @param {boolean} [incompleteOnly] - Only return running/paused/failed runs
 * @param {string} [sortBy] - Comma-separated sort keys (started_at|updated_at|completed_at|status|state|search_term|rows_inserted|rows_returned|pages_fetched|total_pages|source)
 * @param {string} [sortDir] - Comma-separated directions matching sortBy (asc|desc)
 */
router.get(
  '/search-api/import-runs',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 100;
      const page = req.query.page ? Math.max(1, Number.parseInt(String(req.query.page), 10)) : 1;
      const offset = (page - 1) * limit;
      const result = await wigleImportRunService.listImportRuns({
        limit,
        offset,
        status: req.query.status ? String(req.query.status) : undefined,
        state: req.query.state ? String(req.query.state) : undefined,
        searchTerm: req.query.searchTerm ? String(req.query.searchTerm) : undefined,
        incompleteOnly: req.query.incompleteOnly === 'true',
        sortBy: req.query.sortBy ? String(req.query.sortBy) : undefined,
        sortDir: req.query.sortDir ? String(req.query.sortDir) : undefined,
      });
      return res.json({
        ok: true,
        runs: result.data,
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.data.length < result.total,
      });
    } catch (err: any) {
      logger.error(`[WiGLE] Import-runs list error: ${err.message}`, { error: err });
      next(err);
    }
  }
);

router.get(
  '/search-api/import-runs/completeness/summary',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await wigleImportRunService.getImportCompletenessReport({
        searchTerm: req.query.searchTerm ? String(req.query.searchTerm) : undefined,
        state: req.query.state ? String(req.query.state).toUpperCase() : undefined,
      });
      return res.json({ ok: true, report });
    } catch (err: any) {
      logger.error(`[WiGLE] Completeness report error: ${err.message}`, { error: err });
      next(err);
    }
  }
);

/**
 * DELETE /search-api/import-runs/cluster-cleanup
 */
router.delete(
  '/search-api/import-runs/cluster-cleanup',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body?.confirm !== true) {
        return res
          .status(400)
          .json({ ok: false, error: 'Pass { confirm: true } to confirm deletion' });
      }
      const deleted = await wigleImportRunService.bulkDeleteGlobalCancelledCluster();
      logger.info('[WiGLE] Cluster cleanup completed', { deleted });
      return res.json({ ok: true, deleted });
    } catch (err: any) {
      logger.error(`[WiGLE] Cluster cleanup error: ${err.message}`, { error: err });
      next(err);
    }
  }
);

router.get(
  '/search-api/import-runs/:id',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const runId = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(runId)) {
        return res.status(400).json({ ok: false, error: 'Invalid run id' });
      }
      const run = await wigleImportRunService.getImportRun(runId);
      return res.json({ ok: true, run });
    } catch (err: any) {
      logger.error(`[WiGLE] Import-run status error: ${err.message}`, { error: err });
      next(err);
    }
  }
);

/**
 * DELETE /search-api/import-runs/:id
 * Hard-delete a completed, cancelled, or failed import run.
 */
router.delete(
  '/search-api/import-runs/:id',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const runId = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(runId)) {
        return res.status(400).json({ ok: false, error: 'Invalid run id' });
      }
      const deleted = await wigleImportRunService.deleteImportRun(runId);
      if (!deleted) {
        return res
          .status(404)
          .json({ ok: false, error: 'Run not found or not in a deletable state' });
      }
      return res.json({ ok: true, deleted: runId });
    } catch (err: any) {
      logger.error(`[WiGLE] Delete run error: ${err.message}`, { error: err });
      next(err);
    }
  }
);

router.post(
  '/search-api/import-runs/resume-latest',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = { ...req.query, ...req.body };
      const validationError = wigleImportRunService.validateImportQuery(query);
      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }
      const run = await wigleImportRunService.resumeLatestImportRun(query);
      return res.json(buildRunImportResponse(run));
    } catch (err: any) {
      logger.error(`[WiGLE] Resume-latest error: ${err.message}`, { error: err });
      if (err?.status === 403) {
        return res.status(403).json({ ok: false, error: err.message, code: err.code });
      }
      next(err);
    }
  }
);

router.get(
  '/search-api/import-runs/resumable/latest',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = { ...req.query, ...req.body };
      const validationError = wigleImportRunService.validateImportQuery(query);
      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }
      const run = await wigleImportRunService.getLatestResumableImportRun(query);
      return res.json({ ok: true, run });
    } catch (err: any) {
      logger.error(`[WiGLE] Latest resumable error: ${err.message}`, { error: err });
      next(err);
    }
  }
);

router.post(
  '/search-api/import-runs/:id/resume',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const runId = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(runId)) {
        return res.status(400).json({ ok: false, error: 'Invalid run id' });
      }
      const run = await wigleImportRunService.resumeImportRun(runId);
      return res.json(buildRunImportResponse(run));
    } catch (err: any) {
      logger.error(`[WiGLE] Resume run error: ${err.message}`, { error: err });
      if (err?.status === 403) {
        return res.status(403).json({ ok: false, error: err.message, code: err.code });
      }
      next(err);
    }
  }
);

router.post(
  '/search-api/import-runs/:id/pause',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const runId = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(runId)) {
        return res.status(400).json({ ok: false, error: 'Invalid run id' });
      }
      const run = await wigleImportRunService.pauseImportRun(runId);
      return res.json({ ok: true, run });
    } catch (err: any) {
      logger.error(`[WiGLE] Pause run error: ${err.message}`, { error: err });
      next(err);
    }
  }
);

router.post(
  '/search-api/import-runs/:id/cancel',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const runId = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(runId)) {
        return res.status(400).json({ ok: false, error: 'Invalid run id' });
      }
      const run = await wigleImportRunService.cancelImportRun(runId);
      return res.json({ ok: true, run });
    } catch (err: any) {
      logger.error(`[WiGLE] Cancel run error: ${err.message}`, { error: err });
      next(err);
    }
  }
);

/**
 * GET /search-api/saved-ssid-terms
 */
router.get(
  '/search-api/saved-ssid-terms',
  requireAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const terms = await getSavedSsidTerms();
      return res.json({ ok: true, terms });
    } catch (err: any) {
      logger.error(`[WiGLE] Saved terms fetch error: ${err.message}`);
      next(err);
    }
  }
);

/**
 * POST /search-api/saved-ssid-terms
 */
router.post(
  '/search-api/saved-ssid-terms',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = String(req.body?.term ?? '').trim();
      const normalized = raw.toLowerCase();
      if (
        raw.length < 3 ||
        /^\s*$/.test(raw) ||
        ['us', 'uk', 'ca', 'au', 'de', 'fr', 'jp'].includes(normalized)
      ) {
        return res.status(400).json({ ok: false, error: 'Term too short or invalid' });
      }
      const term = await upsertSavedSsidTerm(raw);
      return res.json({ ok: true, term });
    } catch (err: any) {
      logger.error(`[WiGLE] Saved term upsert error: ${err.message}`);
      next(err);
    }
  }
);

/**
 * DELETE /search-api/saved-ssid-terms/:id
 */
router.delete(
  '/search-api/saved-ssid-terms/:id',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number.parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ ok: false, error: 'Invalid id' });
      }
      const deleted = await deleteSavedSsidTerm(id);
      if (!deleted) {
        return res.status(404).json({ ok: false, error: 'Term not found' });
      }
      return res.json({ ok: true, deleted: id });
    } catch (err: any) {
      logger.error(`[WiGLE] Saved term delete error: ${err.message}`);
      next(err);
    }
  }
);

/**
 * POST /search-api/bt-import-start
 * Start or resume a full paginated BT/BLE import run from WiGLE /api/v2/bluetooth/search.
 * @param {string} [namelike] - Device name wildcard filter
 * @param {string} [netid] - Specific BT/BLE address
 * @param {string} [country] - ISO 3166-1 alpha-2 country code (default: US)
 * @param {string} [region] - State/region code
 * @param {string} [city] - City name
 * @param {string} [latrange1] - Min latitude
 * @param {string} [latrange2] - Max latitude
 * @param {string} [longrange1] - Min longitude
 * @param {string} [longrange2] - Max longitude
 * @param {number} [mfgrIdMinimum] - WiGLE manufacturer ID range start (e.g. 2504 for Raven)
 * @param {number} [mfgrIdMaximum] - WiGLE manufacturer ID range end
 * @param {boolean} [showBt] - Include BT devices (default: true)
 * @param {boolean} [showBle] - Include BLE devices (default: true)
 * @param {number} [runId] - Resume a specific existing BT run by ID
 */
router.post(
  '/search-api/bt-import-start',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = { ...req.query, ...req.body };

      if (query.runId !== null && query.runId !== undefined) {
        const runId = Number.parseInt(String(query.runId), 10);
        if (!Number.isFinite(runId)) {
          return res.status(400).json({ ok: false, error: 'Invalid runId' });
        }
        const run = await wigleBluetoothImportService.resumeBluetoothImportRun(runId);
        return res.json(buildRunImportResponse(run));
      }

      const validationError = wigleBluetoothImportService.validateBtImportQuery(query);
      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }

      const run = await wigleBluetoothImportService.startBluetoothImportRun(query);
      return res.json(buildRunImportResponse(run));
    } catch (err: any) {
      logger.error(`[WiGLE BT] Import-start error: ${err.message}`, { error: err });
      if (err?.status === 403) {
        return res.status(403).json({ ok: false, error: err.message, code: err.code });
      }
      next(err);
    }
  }
);

export default router;
