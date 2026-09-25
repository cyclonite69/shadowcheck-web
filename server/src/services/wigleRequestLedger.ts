import logger from '../logging/logger';
import { adminQuery } from './adminDbService';
import { getSafeLimitSync } from './wigleLimits';

export {};

type WigleRequestKind = 'search' | 'detail' | 'stats';

const WINDOW_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SOFT_LIMITS: Record<WigleRequestKind, number> = {
  search: 50,
  detail: 200,
  stats: 49,
};

const requestLedger: Record<WigleRequestKind, number[]> = {
  search: [],
  detail: [],
  stats: [],
};

function getSoftLimit(kind: WigleRequestKind) {
  const value = Number(process.env[`WIGLE_SOFT_LIMIT_${kind.toUpperCase()}`]);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SOFT_LIMITS[kind];
}

function getHardLimit(kind: WigleRequestKind) {
  return getSoftLimit(kind) * 2;
}

function prune(kind: WigleRequestKind, now = Date.now()) {
  requestLedger[kind] = requestLedger[kind].filter((timestamp) => now - timestamp < WINDOW_MS);
}

function pruneAll(now = Date.now()) {
  prune('search', now);
  prune('detail', now);
  prune('stats', now);
}

function getCount(kind: WigleRequestKind) {
  prune(kind);
  return requestLedger[kind].length;
}

function getQuotaStatus() {
  pruneAll();

  return {
    windowHours: 24,
    counts: {
      search: getCount('search'),
      detail: getCount('detail'),
      stats: getCount('stats'),
    },
    softLimits: {
      search: getSoftLimit('search'),
      detail: getSoftLimit('detail'),
      stats: getSoftLimit('stats'),
    },
    hardLimits: {
      search: getHardLimit('search'),
      detail: getHardLimit('detail'),
      stats: getHardLimit('stats'),
    },
  };
}

let consecutive429 = 0;
let breakerOpenUntil = 0;

function recordConsecutive429() {
  consecutive429 += 1;
  if (consecutive429 >= 5) {
    breakerOpenUntil = Date.now() + 600000; // 10 mins
    consecutive429 = 0;
  }
}

function assertCanRequest(kind: WigleRequestKind, priority: 'interactive' | 'background') {
  if (Date.now() < breakerOpenUntil && priority === 'background') {
    const error: any = new Error('Global circuit breaker is OPEN for background tasks');
    error.status = 503;
    throw error;
  }

  // No soft limit for 'detail' — WiGLE does not publish one and we have no empirical
  // basis for a number yet. The ledger continues logging all detail requests so we can
  // observe real rate-limit responses over time and set a limit based on evidence.
  if (kind === 'detail') {
    return;
  }

  const count = getCount(kind);
  const softLimit = getSafeLimitSync(kind);

  if (count >= softLimit) {
    const error: any = new Error(`WiGLE ${kind} soft limit reached (${count}/${softLimit}).`);
    error.status = 429;
    error.kind = kind;
    throw error;
  }
}

/**
 * Record an outbound WiGLE request in the quota ledger.
 * Returns the new row id so the caller can pass it to updateLedgerOutcome,
 * eliminating the blind ORDER-BY-LIMIT-1 race on concurrent requests.
 * The row starts with phase='pending'; updateLedgerOutcome sets it to 'complete'.
 */
async function recordRequest(
  kind: WigleRequestKind,
  query_source?: string,
  query_url?: string,
  query_params?: Record<string, string> | null
): Promise<number | null> {
  prune(kind);
  requestLedger[kind].push(Date.now());

  try {
    const { rows } = await adminQuery(
      `INSERT INTO app.wigle_ledger_events (kind, status, phase, query_source, query_url, query_params)
       VALUES ($1, 'success', 'pending', $2, $3, $4)
       RETURNING id`,
      [
        kind,
        query_source ?? null,
        query_url ?? null,
        query_params ? JSON.stringify(query_params) : null,
      ]
    );
    return (rows[0]?.id as number) ?? null;
  } catch (err: any) {
    logger.warn('[WiGLE Ledger] DB write failed — in-memory state is still accurate', {
      kind,
      error: err?.message || String(err),
    });
    return null;
  }
}

function resetCircuitBreaker() {
  consecutive429 = 0;
  breakerOpenUntil = 0;
}

function resetQuotaLedger() {
  requestLedger.search = [];
  requestLedger.detail = [];
  requestLedger.stats = [];
  resetCircuitBreaker();
}

async function hydrateLedger() {
  try {
    // Keep the table lean: prune events older than the 24h window plus 1h grace
    await adminQuery(
      "DELETE FROM app.wigle_ledger_events WHERE requested_at < NOW() - INTERVAL '25 hours'"
    );

    const { rows } = await adminQuery(
      `SELECT kind, (EXTRACT(EPOCH FROM requested_at) * 1000)::bigint AS ts_ms
       FROM app.wigle_ledger_events
       WHERE requested_at > NOW() - INTERVAL '24 hours'
       ORDER BY requested_at ASC`
    );

    for (const row of rows) {
      const kind = row.kind as WigleRequestKind;
      if (requestLedger[kind] !== undefined) {
        requestLedger[kind].push(Number(row.ts_ms));
      }
    }

    logger.info('[WiGLE Ledger] Hydrated from DB', {
      search: requestLedger.search.length,
      detail: requestLedger.detail.length,
      stats: requestLedger.stats.length,
    });
  } catch (err: any) {
    logger.warn('[WiGLE Ledger] Hydration failed — starting with empty ledger', {
      error: err?.message || String(err),
    });
  }
}

if (process.env.NODE_ENV !== 'test') {
  void hydrateLedger();
}

function getCircuitBreakerStatus() {
  return { isOpen: Date.now() < breakerOpenUntil };
}

/**
 * Update a ledger event with its outcome after the HTTP call completes.
 * Accepts the explicit row id returned by recordRequest to avoid the
 * ORDER-BY-LIMIT-1 race. Falls back to the heuristic only if id is null
 * (DB write failed at insert time).
 * Fire-and-forget — never throws.
 */
function updateLedgerOutcome(
  kind: WigleRequestKind,
  id: number | null,
  outcome: {
    status: string;
    duration_ms: number;
    error_message?: string;
    http_status?: number;
    result_count?: number | null;
    retry_after_hint?: number | null;
  }
) {
  if (id !== null) {
    void adminQuery(
      `UPDATE app.wigle_ledger_events
       SET status = $1, phase = 'complete', duration_ms = $2, error_message = $3,
           http_status = $4, result_count = $5, retry_after_hint = $6
       WHERE id = $7`,
      [
        outcome.status,
        outcome.duration_ms,
        outcome.error_message ?? null,
        outcome.http_status ?? null,
        outcome.result_count ?? null,
        outcome.retry_after_hint ?? null,
        id,
      ]
    ).catch((err: any) => {
      logger.warn('[WiGLE Ledger] Outcome update failed', {
        kind,
        error: err?.message || String(err),
      });
    });
  } else {
    void adminQuery(
      `UPDATE app.wigle_ledger_events
       SET status = $1, phase = 'complete', duration_ms = $2, error_message = $3,
           http_status = $4, result_count = $5, retry_after_hint = $6
       WHERE id = (
         SELECT id
         FROM app.wigle_ledger_events
         WHERE kind = $7
           AND phase = 'pending'
         ORDER BY requested_at DESC, id DESC
         LIMIT 1
       )`,
      [
        outcome.status,
        outcome.duration_ms,
        outcome.error_message ?? null,
        outcome.http_status ?? null,
        outcome.result_count ?? null,
        outcome.retry_after_hint ?? null,
        kind,
      ]
    ).catch((err: any) => {
      logger.warn('[WiGLE Ledger] Outcome update failed', {
        kind,
        error: err?.message || String(err),
      });
    });
  }
}

export {
  assertCanRequest,
  getQuotaStatus,
  recordRequest,
  updateLedgerOutcome,
  resetQuotaLedger,
  resetCircuitBreaker,
  recordConsecutive429,
  getCircuitBreakerStatus,
};
