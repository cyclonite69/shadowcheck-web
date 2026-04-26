import logger from '../logging/logger';
import { logWigleAuditEvent } from './wigleAuditLogger';
import { assertCanRequest, recordRequest } from './wigleRequestLedger';
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
  entrypoint?: string;
  paramsHash?: string;
  endpointType?: string;
};

const MIN_INTERVAL_MS: Record<WigleRequestKind, number> = {
  search: 10_000,
  detail: 20_000,
  stats: 30_000,
};

let wigleQueue: Promise<void> = Promise.resolve();
let lastStartedAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTestEnv() {
  return process.env.NODE_ENV === 'test';
}

function jitterMs() {
  if (isTestEnv()) {
    return 0;
  }
  return 500 + Math.floor(Math.random() * 1500);
}

async function reserveSlot(kind: WigleRequestKind) {
  let release!: () => void;
  const previous = wigleQueue;
  wigleQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  if (isTestEnv()) {
    lastStartedAt = Date.now();
    return release;
  }

  const waitMs = Math.max(0, lastStartedAt + MIN_INTERVAL_MS[kind] - Date.now()) + jitterMs();
  if (waitMs > 0) {
    logger.info('[WiGLE] Waiting before outbound request', { kind, waitMs });
    await sleep(waitMs);
  }

  lastStartedAt = Date.now();
  return release;
}

async function fetchWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function safeReadBody(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function backoff(attempt: number) {
  if (isTestEnv()) {
    return;
  }
  const waitMs = Math.min(60_000, 5_000 * 2 ** attempt) + jitterMs();
  await sleep(waitMs);
}

async function fetchWigle(options: WigleFetchOptions): Promise<Response> {
  const {
    kind,
    url,
    init,
    timeoutMs = kind === 'search' ? 30_000 : 15_000,
    maxRetries = 1,
    label = 'WiGLE request',
    entrypoint = 'unspecified',
    paramsHash = hashRecord({ kind, url }),
    endpointType = kind,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    assertCanRequest(kind, entrypoint);
    const release = await reserveSlot(kind);
    const startedAt = Date.now();

    try {
      recordRequest(kind);
      const response = await fetchWithTimeout(url, init, timeoutMs);
      const latencyMs = Date.now() - startedAt;

      logger.info('[WiGLE] Outbound response received', {
        label,
        kind,
        status: response.status,
        latencyMs,
        attempt: attempt + 1,
        entrypoint,
        paramsHash,
      });

      logWigleAuditEvent({
        entrypoint,
        endpointType,
        paramsHash,
        status: response.status,
        latencyMs,
        servedFromCache: false,
        retryCount: attempt,
        kind,
      });

      if ((response.status === 403 || response.status === 429) && attempt < maxRetries) {
        logger.warn('[WiGLE] Refusing to retry blocked/throttled response', {
          label,
          kind,
          status: response.status,
        });
      }

      if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
        const body = await safeReadBody(response);
        logger.warn('[WiGLE] Retrying server-side failure', {
          label,
          kind,
          status: response.status,
          attempt: attempt + 1,
          body: body.slice(0, 200),
        });
        await backoff(attempt);
        continue;
      }

      return response;
    } catch (error: any) {
      const latencyMs = Date.now() - startedAt;
      logger.warn('[WiGLE] Outbound request failed', {
        label,
        kind,
        attempt: attempt + 1,
        latencyMs,
        error: error?.message || String(error),
        entrypoint,
        paramsHash,
      });

      if (attempt >= maxRetries) {
        throw error;
      }

      await backoff(attempt);
    } finally {
      release();
    }
  }

  throw new Error(`${label} failed without returning a response`);
}

function resetWigleClientState() {
  wigleQueue = Promise.resolve();
  lastStartedAt = 0;
}

export { fetchWigle, resetWigleClientState };
