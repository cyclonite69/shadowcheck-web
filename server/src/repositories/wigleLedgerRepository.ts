/**
 * WiGLE Ledger Repository
 * Data access layer for unified WiGLE ledger events and import runs.
 */

export type QueryExecutor = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;

export interface LedgerEventRow {
  id: string;
  source: 'event';
  kind: string;
  status: string;
  ts: string;
  rows_returned: null;
  rows_inserted: null;
  pages_fetched: null;
  duration_ms: number | null;
  error: string | null;
  phase: string | null;
  query_source: string | null;
  query_url: string | null;
  query_params: Record<string, any> | null;
  result_count: number | null;
  retry_after_hint: number | null;
  http_status: number | null;
}

export interface WigleImportRunRow {
  id: string;
  source: 'import';
  kind: string;
  status: string;
  ts: string;
  rows_returned: number | null;
  rows_inserted: number | null;
  pages_fetched: number | null;
  duration_ms: number | null;
  error: string | null;
  phase: string;
  query_source: 'import';
  query_url: null;
  query_params: Record<string, any> | null;
  result_count: number | null;
  retry_after_hint: null;
  http_status: number;
}

export type UnifiedLedgerDbRow = LedgerEventRow | WigleImportRunRow;

export interface FetchUnifiedLedgerParams {
  limit: number;
  before?: string;
  beforeId?: string;
  statusFilter?: string;
  sourceFilter?: string;
}

export interface UnifiedLedgerResult {
  rows: UnifiedLedgerDbRow[];
  hasMore: boolean;
}

interface QueryLedgerEventsParams {
  limit: number;
  before?: string;
  beforeEvtId?: number | null;
  statusFilter?: string;
}

interface QueryImportRunsParams {
  limit: number;
  before?: string;
  beforeRunId?: number | null;
  statusFilter?: string;
}

/**
 * Builds and executes the query for app.wigle_ledger_events.
 */
async function getLedgerEvents(
  queryExecutor: QueryExecutor,
  params: QueryLedgerEventsParams
): Promise<LedgerEventRow[]> {
  const queryParams: unknown[] = [];
  const conditions: string[] = [];

  if (params.before) {
    queryParams.push(params.before);
    if (params.beforeEvtId !== null && params.beforeEvtId !== undefined) {
      queryParams.push(params.beforeEvtId);
      conditions.push(
        '(e.requested_at < $1::timestamptz OR (e.requested_at = $1::timestamptz AND e.id < $2))'
      );
    } else {
      conditions.push('e.requested_at < $1::timestamptz');
    }
  }

  if (params.statusFilter && params.statusFilter !== 'all') {
    queryParams.push(params.statusFilter);
    conditions.push(`e.status = $${queryParams.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  queryParams.push(params.limit + 1);

  const sql = `
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
    LIMIT $${queryParams.length}`;

  const result = await queryExecutor(sql, queryParams);
  return result.rows || [];
}

/**
 * Builds and executes the query for app.wigle_import_runs.
 * Short-circuits with an empty array if the status filter cannot match any import run status.
 */
async function getImportRuns(
  queryExecutor: QueryExecutor,
  params: QueryImportRunsParams
): Promise<WigleImportRunRow[]> {
  const queryParams: unknown[] = [];
  const conditions: string[] = [];

  if (params.before) {
    queryParams.push(params.before);
    if (params.beforeRunId !== null && params.beforeRunId !== undefined) {
      queryParams.push(params.beforeRunId);
      conditions.push(
        '(r.started_at < $1::timestamptz OR (r.started_at = $1::timestamptz AND r.id < $2))'
      );
    } else {
      conditions.push('r.started_at < $1::timestamptz');
    }
  }

  if (params.statusFilter && params.statusFilter !== 'all') {
    const statusMap: Record<string, string[]> = {
      success: ['completed', 'running'],
      error: ['failed'],
      skipped: ['paused', 'cancelled'],
      rate_limited: [],
    };
    const matching = statusMap[params.statusFilter] ?? [];
    if (matching.length === 0) {
      return [];
    }
    queryParams.push(matching);
    conditions.push(`r.status = ANY($${queryParams.length}::text[])`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  queryParams.push(params.limit + 1);

  const sql = `
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
    LIMIT $${queryParams.length}`;

  const result = await queryExecutor(sql, queryParams);
  return result.rows || [];
}

/**
 * Orchestrates parallel fetch of ledger events and import runs, applying
 * cursor tiebreaker parsing, merge-sorting by (ts DESC, id DESC), and slice(0, limit).
 * Follows repository required-executor convention (matching surveillanceDetectionRepository.ts).
 */
async function getUnifiedLedger(
  queryExecutor: QueryExecutor,
  params: FetchUnifiedLedgerParams
): Promise<UnifiedLedgerResult> {
  const { limit, before, beforeId, statusFilter = 'all', sourceFilter = 'all' } = params;

  let beforeEvtId: number | null = null;
  let beforeRunId: number | null = null;
  if (beforeId) {
    if (beforeId.startsWith('evt_')) {
      beforeEvtId = Number(beforeId.slice(4));
    } else if (beforeId.startsWith('run_')) {
      beforeRunId = Number(beforeId.slice(4));
    }
  }

  const includeEvents = sourceFilter !== 'import';
  const includeRuns = sourceFilter !== 'event';

  const [evtRows, runRows] = await Promise.all([
    includeEvents
      ? getLedgerEvents(queryExecutor, { limit, before, beforeEvtId, statusFilter })
      : Promise.resolve([]),
    includeRuns
      ? getImportRuns(queryExecutor, { limit, before, beforeRunId, statusFilter })
      : Promise.resolve([]),
  ]);

  const all: UnifiedLedgerDbRow[] = [...evtRows, ...runRows].sort((a, b) => {
    const tDiff = new Date(b.ts).getTime() - new Date(a.ts).getTime();
    if (tDiff !== 0) {
      return tDiff;
    }
    const aId = Number(String(a.id).replace(/^\w+_/, ''));
    const bId = Number(String(b.id).replace(/^\w+_/, ''));
    return bId - aId;
  });

  const hasMore = all.length > limit;
  return {
    rows: all.slice(0, limit),
    hasMore,
  };
}

module.exports = {
  getUnifiedLedger,
};

export { getUnifiedLedger };
