import logger from '../logging/logger';
import { assertCanRequest, recordRequest, recordConsecutive429 } from './wigleRequestLedger';
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
};

// Single-slot mutex: each request captures the current tail and appends a new slot.
// `finally { releaseSlot() }` guarantees the queue always advances, even on throw.
let queue: Promise<void> = Promise.resolve();
const flightMap = new Map<string, Promise<Response>>();

function isTestEnv() {
  return process.env.NODE_ENV === 'test';
}

function jitter(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function sleep(ms: number) {
  if (isTestEnv()) return;
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
    if (!isNaN(retryAfter)) delay = Math.max(delay, retryAfter * 1000);
  }
  await sleep(delay);
}

async function fetchWigle(options: WigleFetchOptions): Promise<Response> {
  const {
    kind,
    url,
    init,
    timeoutMs = kind === 'search' ? 30_000 : 15_000,
    maxRetries = 3,
    label = 'WiGLE',
    priority = 'background',
  } = options;

  const bodyKey = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body ?? null);
  const requestKey = `${kind}:${hashRecord({ url, body: bodyKey })}`;

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
      if (!isTestEnv()) await sleep(jitter(150, 300));

      // Ensure quota and limits are checked once before retry loop.
      // This protects against a near-boundary request that would pass
      // attempt 0 then be rejected on a subsequent attempt (e.g., SOFT_LIMIT),
      // which should surface the original 429 instead of a later quota rejection.
      assertCanRequest(kind, priority);

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const startedAt = Date.now();

        try {
          // Quota is decremented before fetch success is confirmed. On retry (maxRetries=3),
          // a single logical request can burn up to N quota slots on network failure.
          // This is an intentional conservative policy — prefer over-counting to
          // under-counting to avoid WiGLE burst/ban risk. Do NOT change the logic.
          recordRequest(kind);
          const response = await fetchWithTimeout(url, init, timeoutMs);

          if (response.status === 429) {
            recordConsecutive429();
            if (attempt < maxRetries) {
              await backoff(attempt, response);
              continue;
            }
          }

          logger.info('[WiGLE] Response received', {
            label,
            kind,
            status: response.status,
            latencyMs: Date.now() - startedAt,
            attempt: attempt + 1,
          });
          return response;
        } catch (e: any) {
          if (attempt >= maxRetries) throw e;
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
