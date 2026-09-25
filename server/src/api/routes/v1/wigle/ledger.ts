/**
 * WiGLE Request Ledger Route
 * GET /api/wigle/ledger — unified view of ledger events + import runs, cursor-paginated
 */

import express from 'express';
const router = express.Router();
const { adminQuery } = require('../../../../services/adminDbService');
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

    // Parse cursor tiebreaker
    let beforeEvtId: number | null = null;
    let beforeRunId: number | null = null;
    if (beforeId) {
      if (beforeId.startsWith('evt_')) {
        beforeEvtId = Number(beforeId.slice(4));
      } else if (beforeId.startsWith('run_')) {
        beforeRunId = Number(beforeId.slice(4));
      }
    }

    // Build separate param arrays for each CTE to keep indexing simple
    const buildEvtQuery = () => {
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (before) {
        params.push(before);
        if (beforeEvtId !== null) {
          params.push(beforeEvtId);
          conditions.push(
            '(e.requested_at < $1::timestamptz OR (e.requested_at = $1::timestamptz AND e.id < $2))'
          );
        } else {
          conditions.push('e.requested_at < $1::timestamptz');
        }
      }
      if (statusFilter !== 'all') {
        params.push(statusFilter);
        conditions.push(`e.status = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit + 1);
      return {
        sql: `
          SELECT
            'evt_' || e.id::text AS id,
            'event'              AS source,
            e.kind               AS kind,
            e.status             AS status,
            e.requested_at       AS ts,
            NULL::integer        AS rows_returned,
            NULL::integer        AS rows_inserted,
            NULL::integer        AS pages_fetched,
            e.duration_ms        AS duration_ms,
            e.error_message      AS error,
            e.phase              AS phase,
            e.query_source       AS query_source,
            e.query_url          AS query_url,
            e.query_params       AS query_params,
            e.result_count       AS result_count,
            e.retry_after_hint   AS retry_after_hint,
            e.http_status        AS http_status
          FROM app.wigle_ledger_events e
          ${where}
          ORDER BY e.requested_at DESC, e.id DESC
          LIMIT $${params.length}`,
        params,
      };
    };

    const buildRunQuery = () => {
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (before) {
        params.push(before);
        if (beforeRunId !== null) {
          params.push(beforeRunId);
          conditions.push(
            '(r.started_at < $1::timestamptz OR (r.started_at = $1::timestamptz AND r.id < $2))'
          );
        } else {
          conditions.push('r.started_at < $1::timestamptz');
        }
      }

      // Map ledger status filter to import run statuses
      if (statusFilter !== 'all') {
        const statusMap: Record<string, string[]> = {
          success: ['completed', 'running'],
          error: ['failed'],
          skipped: ['paused', 'cancelled'],
          rate_limited: [],
        };
        const matching = statusMap[statusFilter] ?? [];
        if (matching.length === 0) {
          return null; // no import runs match this status
        }
        params.push(matching);
        conditions.push(`r.status = ANY($${params.length}::text[])`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit + 1);
      return {
        sql: `
          SELECT
            'run_' || r.id::text                                            AS id,
            'import'                                                        AS source,
            COALESCE(r.request_params->>'search_term', r.state, r.status)  AS kind,
            CASE r.status
              WHEN 'completed' THEN 'success'
              WHEN 'running'   THEN 'success'
              WHEN 'paused'    THEN 'skipped'
              WHEN 'cancelled' THEN 'skipped'
              ELSE 'error'
            END                                                             AS status,
            r.started_at                                                    AS ts,
            r.rows_returned,
            r.rows_inserted,
            r.pages_fetched,
            CASE WHEN r.completed_at IS NOT NULL
              THEN (EXTRACT(EPOCH FROM (r.completed_at - r.started_at)) * 1000)::bigint
            END                                                             AS duration_ms,
            r.last_error                                                    AS error,
            CASE WHEN r.status = 'running' THEN 'pending' ELSE 'complete' END AS phase,
            'import'                                                        AS query_source,
            NULL::text                                                      AS query_url,
            r.request_params                                                AS query_params,
            r.rows_returned                                                 AS result_count,
            NULL::integer                                                   AS retry_after_hint,
            CASE WHEN r.status = 'failed' THEN 500 ELSE 200 END            AS http_status
          FROM app.wigle_import_runs r
          ${where}
          ORDER BY r.started_at DESC, r.id DESC
          LIMIT $${params.length}`,
        params,
      };
    };

    // Execute queries in parallel then merge-sort
    const promises: Promise<{ rows: any[] }>[] = [];
    const includeEvents = sourceFilter !== 'import';
    const includeRuns = sourceFilter !== 'event';

    if (includeEvents) {
      const q = buildEvtQuery();
      promises.push(adminQuery(q.sql, q.params));
    } else {
      promises.push(Promise.resolve({ rows: [] }));
    }

    if (includeRuns) {
      const q = buildRunQuery();
      if (q) {
        promises.push(adminQuery(q.sql, q.params));
      } else {
        promises.push(Promise.resolve({ rows: [] }));
      }
    } else {
      promises.push(Promise.resolve({ rows: [] }));
    }

    const [evtResult, runResult] = await Promise.all(promises);

    // Merge-sort by ts DESC, id DESC
    const all = [...evtResult.rows, ...runResult.rows].sort((a, b) => {
      const tDiff = new Date(b.ts).getTime() - new Date(a.ts).getTime();
      if (tDiff !== 0) {
        return tDiff;
      }
      // Compare ids numerically (strip prefix)
      const aId = Number(String(a.id).replace(/^\w+_/, ''));
      const bId = Number(String(b.id).replace(/^\w+_/, ''));
      return bId - aId;
    });

    const hasMore = all.length > limit;
    const data = all.slice(0, limit).map((r: any) => ({
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
