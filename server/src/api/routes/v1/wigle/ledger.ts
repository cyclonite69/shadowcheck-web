/**
 * WiGLE Request Ledger Route
 * GET /api/wigle/ledger — unified view of ledger events + import runs, cursor-paginated
 */

import express from 'express';
const router = express.Router();
const { adminQuery } = require('../../../../services/adminDbService');
const { getUnifiedLedger } = require('../../../../repositories/wigleLedgerRepository');
const logger = require('../../../../logging/logger');
import { requireAdmin } from '../../../../middleware/authMiddleware';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/wigle/ledger
 * Returns unified rows from wigle_ledger_events and wigle_import_runs,
 * sorted by timestamp DESC with cursor-based pagination.
 *
 * Query params:
 *   limit    - number of rows (default 50, max 200)
 *   before   - ISO timestamp cursor
 *   beforeId - id cursor tiebreaker ("evt_N" or "run_N")
 *   status   - all | success | error | rate_limited | skipped
 *   source   - all | import | event
 */
router.get('/ledger', requireAdmin, async (req: any, res: any) => {
  try {
    const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const before: string | undefined = req.query.before as string | undefined;
    const beforeId: string | undefined = req.query.beforeId as string | undefined;
    const statusFilter = (req.query.status as string) || 'all';
    const sourceFilter = (req.query.source as string) || 'all';

    const VALID_STATUSES = ['all', 'success', 'error', 'rate_limited', 'skipped'];
    const VALID_SOURCES = ['all', 'import', 'event'];
    if (!VALID_STATUSES.includes(statusFilter) || !VALID_SOURCES.includes(sourceFilter)) {
      return res.status(400).json({ error: 'Invalid status or source filter' });
    }

    const { rows: dbRows, hasMore } = await getUnifiedLedger(adminQuery, {
      limit,
      before,
      beforeId,
      statusFilter,
      sourceFilter,
    });
    const data = dbRows.map((r: any) => ({
      id: r.id,
      source: r.source,
      kind: r.kind,
      status: r.status,
      timestamp: r.ts,
      rowsReturned: r.rows_returned ?? undefined,
      rowsInserted: r.rows_inserted ?? undefined,
      pagesFetched: r.pages_fetched ?? undefined,
      durationMs: r.duration_ms ?? undefined,
      error: r.error ?? undefined,
      phase: r.phase ?? undefined,
      querySource: r.query_source ?? undefined,
      queryUrl: r.query_url ?? undefined,
      queryParams: r.query_params ?? undefined,
      resultCount: r.result_count ?? undefined,
      retryAfterHint: r.retry_after_hint ?? undefined,
      httpStatus: r.http_status ?? undefined,
    }));

    res.json({ rows: data, hasMore });
  } catch (err: any) {
    logger.error(`[WiGLE Ledger] Failed to fetch ledger: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/wigle/soft-limits
 * Mutates process.env soft-limit overrides in the running process without a restart.
 * Body: { search?: number, detail?: number, stats?: number }
 */
router.patch('/soft-limits', requireAdmin, (req: any, res: any) => {
  const VALID_KINDS = ['search', 'detail', 'stats'] as const;
  const updated: Record<string, number> = {};

  for (const kind of VALID_KINDS) {
    if (req.body[kind] !== undefined) {
      const val = Number(req.body[kind]);
      if (!Number.isFinite(val) || val <= 0) {
        return res.status(400).json({ error: `Invalid value for ${kind}` });
      }
      process.env[`WIGLE_SOFT_LIMIT_${kind.toUpperCase()}`] = String(val);
      updated[kind] = val;
    }
  }

  if (Object.keys(updated).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  logger.info(`[WiGLE] Soft limits updated at runtime: ${JSON.stringify(updated)}`);
  res.json({ ok: true, updated });
});

export default router;
