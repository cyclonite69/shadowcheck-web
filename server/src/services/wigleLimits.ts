/**
 * WiGLE Self-Tuning Rate Limiter
 *
 * Cache is refreshed on a 5-minute setInterval started at module init.
 * getSafeLimitSync() is pure synchronous — safe to call inside a quota gate
 * without yielding to the event loop.
 */

import logger from '../logging/logger';
import { adminQuery } from './adminDbService';

export type WigleRequestKind = 'search' | 'detail' | 'stats';

const FALLBACK_LIMITS: Record<WigleRequestKind, number> = {
  search: 50,
  detail: 200,
  stats: 49,
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const KINDS: WigleRequestKind[] = ['search', 'detail', 'stats'];

let cachedLimits: Partial<Record<WigleRequestKind, number>> = {};
let refreshTimer: ReturnType<typeof setInterval> | null = null;

async function refreshLimits(): Promise<void> {
  for (const kind of KINDS) {
    try {
      const { rows } = await adminQuery('SELECT app.get_wigle_safe_limit($1) AS safe_limit', [
        kind,
      ]);
      const limit: number | null = rows[0]?.safe_limit ?? null;
      if (limit !== null && limit > 0) {
        if (cachedLimits[kind] !== limit) {
          logger.info(`[WiGLE Limits] ${kind} → empirical safe limit: ${limit}`);
        }
        cachedLimits[kind] = limit;
      } else {
        delete cachedLimits[kind];
      }
    } catch (err: any) {
      logger.warn(`[WiGLE Limits] Failed to refresh ${kind} limit`, { error: err?.message });
    }
  }
}

/**
 * Return the current safe limit synchronously from cache.
 * Never hits the DB — safe to call inside assertCanRequest.
 */
export function getSafeLimitSync(kind: WigleRequestKind): number {
  return cachedLimits[kind] ?? FALLBACK_LIMITS[kind];
}

/** Exposed for testing — resets cached state and stops the interval. */
export function resetLimitsCache(): void {
  cachedLimits = {};
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// Start background refresh at module init (not in test env).
// Prime the cache immediately, then refresh every 5 minutes.
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

if (!isTestEnv) {
  void refreshLimits();
  refreshTimer = setInterval(() => void refreshLimits(), REFRESH_INTERVAL_MS);
}
