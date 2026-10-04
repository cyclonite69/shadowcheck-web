import logger from '../logging/logger';
import {
  assertCanRequest,
  recordRequest,
  recordConsecutive429,
  updateLedgerOutcome,
} from './wigleRequestLedger';
import { hashRecord } from './wigleRequestUtils';

export {};

type WigleRequestKind = 'search' | 'detail' | 'stats';

type WigleFetchOptions = {
  kind: WigleRequestKind;
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  maxRetries?: number;
  label?: string;
  priority?: 'interactive' | 'background';
  entrypoint?: string;
  paramsHash?: string;
  endpointType?: string;
  query_source?: string;
};

// Single-slot mutex: each request captures the current tail and appends a new slot.
// `finally { releaseSlot() }` guarantees the queue always advances, even on throw.
let queue: Promise<void> = Promise.resolve();
const flightMap = new Map<string, Promise<WigleFetchResult>>();

function isTestEnv() {
  return process.env.NODE_ENV === 'test';
}

function jitter(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function describeEndpoint(url: string, endpointType?: string) {
  if (endpointType) {
    return endpointType;
  }
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, '');
  } catch {
    return 'unknown';
  }
}

function extractParams(url: string): Record<string, string> | null {
  try {
    const parsed = new URL(url);
    return Object.fromEntries(parsed.searchParams.entries());
  } catch {
    return null;
  }
}

async function sleep(ms: number) {
  // Use a real timer-based sleep so tests can control timing with jest fake timers.
  // Returning immediately in test env caused retries to run synchronously and
  // bleed across test cases, producing nondeterministic call counts.
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function backoff(attempt: number, response: Response | null = null) {
  let delay = 1000 * 2 ** attempt + jitter(0, 500);
  if (response?.headers.has('Retry-After')) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
    if (!isNaN(retryAfter)) {
      delay = Math.max(delay, retryAfter * 1000);
    }
  }
  await sleep(delay);
}

function parseRetryAfter(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  const seconds = parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export interface WigleFetchResult {
  response: Response;
  ledgerId: number | null;
}

async function fetchWigle(options: WigleFetchOptions): Promise<WigleFetchResult> {
  const {
    kind,
    url,
    init,
    timeoutMs = kind === 'search' ? 30_000 : 15_000,
    maxRetries = 3,
    label = 'WiGLE',
    priority = 'background',
    endpointType,
    query_source,
  } = options;

  const bodyKey = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body ?? null);
  const requestKey = `${kind}:${hashRecord({ url, body: bodyKey })}`;
  const endpoint = describeEndpoint(url, endpointType);
  const params = extractParams(url);

  if (flightMap.has(requestKey)) {
    logger.debug('[WiGLE] Deduplicating request', { requestKey });
    return flightMap.get(requestKey)!;
  }

  const previous = queue;
  let releaseSlot!: () => void;
  queue = new Promise<void>((res) => {
    releaseSlot = res;
  });

  const request = (async () => {
    await previous.catch(() => {});
    try {
      if (!isTestEnv()) {
        await sleep(jitter(150, 300));
      }

      // Ensure quota and limits are checked once before retry loop.
      // This protects against a near-boundary request that would pass
      // attempt 0 then be rejected on a subsequent attempt (e.g., SOFT_LIMIT),
      // which should surface the original 429 instead of a later quota rejection.
      // Stats: assertCanRequest runs in wigleGateway only (single shared gate for all callers).
      if (kind !== 'stats') {
        assertCanRequest(kind, priority);
      }

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const attemptStartedAt = Date.now();
        let ledgerId: number | null = null;
        let outcomeRecorded = false;
        try {
          if (attempt === 0) {
            logger.info(
              `[WiGLE][${endpoint}][PRE] sending request | url=${url} | params=${JSON.stringify(
                params ?? {}
              )}`
            );
          }

          // Quota is decremented before fetch success is confirmed. On retry (maxRetries=3),
          // a single logical request can burn up to N quota slots on network failure.
          // This is an intentional conservative policy — prefer over-counting to
          // under-counting to avoid WiGLE burst/ban risk. Do NOT change the logic.
          ledgerId = await recordRequest(kind, query_source, url, params);
          const response = await fetchWithTimeout(url, init, timeoutMs);

          if (response.status === 429) {
            recordConsecutive429();
            logger.warn(
              `[WiGLE][${endpoint}][429] rate limited | url=${url} | params=${JSON.stringify(
                params ?? {}
              )}`
            );
            if (attempt < maxRetries) {
              updateLedgerOutcome(kind, ledgerId, {
                status: 'error',
                duration_ms: Date.now() - attemptStartedAt,
                error_message: `HTTP 429, retrying (${attempt + 1}/${maxRetries + 1})`,
                http_status: 429,
                retry_after_hint: parseRetryAfter(response.headers.get('Retry-After')),
              });
              outcomeRecorded = true;
              await backoff(attempt, response);
              continue;
            }
          }

          if (!response.ok) {
            const bodyText = await response
              .clone()
              .text()
              .then((text) => text.substring(0, 500))
              .catch(() => '');
            logger.error(
              `[WiGLE][${endpoint}][${response.status}] request failed | url=${url} | params=${JSON.stringify(
                params ?? {}
              )} | body=${bodyText}`
            );
          } else {
            logger.info(
              `[WiGLE][${endpoint}][${response.status}] request succeeded | url=${url} | params=${JSON.stringify(
                params ?? {}
              )}`
            );
          }
          return { response, ledgerId };
        } catch (e: any) {
          const attemptError: any = e instanceof Error ? e : new Error(String(e));
          if (e && typeof e === 'object' && 'status' in e) {
            attemptError.status = e.status;
          }
          if (ledgerId !== null) {
            attemptError.ledgerId = ledgerId;
          }

          if (attempt >= maxRetries) {
            logger.error(
              `[WiGLE][${endpoint}][ERROR] request failed after retries exhausted | url=${url} | params=${JSON.stringify(
                params ?? {}
              )} | error=${String(attemptError?.message || attemptError).slice(0, 500)}`
            );
            throw attemptError;
          }
          if (ledgerId !== null && !outcomeRecorded) {
            updateLedgerOutcome(kind, ledgerId, {
              status: 'error',
              duration_ms: Date.now() - attemptStartedAt,
              error_message: `${attemptError?.message || String(attemptError)}, retrying (${attempt + 1}/${maxRetries + 1})`,
              http_status: attemptError?.status ?? null,
            });
            outcomeRecorded = true;
          }
          logger.warn(
            `[WiGLE][${endpoint}][RETRY] attempt failed, retrying | url=${url} | params=${JSON.stringify(
              params ?? {}
            )} | error=${String(attemptError?.message || attemptError).slice(0, 500)}`
          );
          await backoff(attempt);
        }
      }

      throw new Error(`${label}: exhausted ${maxRetries} retries`);
    } finally {
      releaseSlot();
    }
  })();

  flightMap.set(requestKey, request);
  // .finally() propagates the original rejection; .then(fn, fn) always resolves
  // the returned promise so no unhandled rejection escapes the map cleanup.
  const cleanup = () => flightMap.delete(requestKey);
  request.then(cleanup, cleanup);
  return request;
}

function resetState() {
  flightMap.clear();
  queue = Promise.resolve();
}

export { fetchWigle, resetState };
