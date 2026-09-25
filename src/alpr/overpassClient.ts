/**
 * Overpass client: endpoint rotation with in-process cooldown, retry/backoff,
 * ALPR-specific query, and bbox grid chunking with capped concurrency.
 * Public Overpass instances rate-limit per IP and will temp-ban abusive
 * clients — keep MIN_REQUEST_INTERVAL_MS conservative, chunk concurrency = 1.
 *
 * Endpoint cool-downs are process-local only (shared across chunks
 * in this Node process). Daemon ↔ web mutual exclusion remains the Postgres
 * advisory lock — cool-down state is never shared across processes.
 *
 * kumi.systems / private.coffee are last-resort only (used when the primary
 * overpass-api.de mirror is cooling). Abort budget matches the Overpass
 * query timeout so a slow-but-alive mirror is not misclassified as dead.
 */

import { subdivideBBox } from './regions';

const PRIMARY_OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const LAST_RESORT_OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;

const DEFAULT_OVERPASS_ENDPOINTS = [
  PRIMARY_OVERPASS_ENDPOINT,
  ...LAST_RESORT_OVERPASS_ENDPOINTS,
  // overpass.nchc.org.tw removed 2026-09-19: host does not resolve (ENOTFOUND);
  // it burned a retry slot on every chunk with a useless "fetch failed" TypeError.
];

const REQUEST_TIMEOUT_MS = 60_000;
/**
 * Client abort for last-resort mirrors (kumi / private.coffee).
 * Must cover a slow-but-alive mirror: private.coffee returned HTTP 200 for a
 * tiny ALPR bbox in ~47s while a 15s abort classified it as dead and exhausted
 * the pool under primary ECONNREFUSED. 90s leaves ~2× margin over that
 * measured duration (55s was only ~8s of headroom).
 */
const LAST_RESORT_REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 4;
const MIN_REQUEST_INTERVAL_MS = 5_000;
/**
 * Cool-down after a retryable failure on one mirror (in-process only).
 * MUST stay ≤ {@link DEFAULT_MAX_COOLDOWN_WAIT_MS}: selectEndpoint only waits
 * up to that bound, so a longer cool-until can never be waited out mid-fetch
 * and subsequent chunks fail with "refusing to hammer mirrors" even while
 * overpass-api.de is healthy for new tiny queries.
 */
const DEFAULT_ENDPOINT_COOLDOWN_MS = 25_000;
/** DNS failures use the same bound so the wait path can unblock. */
const DEFAULT_DNS_COOLDOWN_MS = 25_000;
/**
 * Max time to wait for the earliest cool endpoint when the whole pool is
 * temporarily unhealthy. Must be ≥ endpoint cool-down TTL or recovery is
 * unreachable within a multi-chunk region fetch.
 */
const DEFAULT_MAX_COOLDOWN_WAIT_MS = 30_000;
const CHUNK_ROWS = 2;
const CHUNK_COLS = 2;
/** Hard cap on concurrent Overpass chunk requests (public mirror IP limits). */
export const CHUNK_CONCURRENCY = 1;
const USER_AGENT = 'ShadowCheck-ALPR-Sync/1.0 (local research use)';

export { LAST_RESORT_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS, PRIMARY_OVERPASS_ENDPOINT };
export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string | undefined>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface OverpassClientRuntimeConfig {
  cooldownMs: number;
  dnsCooldownMs: number;
  maxCooldownWaitMs: number;
  minRequestIntervalMs: number;
  maxAttempts: number;
  requestTimeoutMs: number;
  lastResortTimeoutMs: number;
  backoffBaseMs: number;
  backoffJitterMs: number;
}

const RUNTIME_DEFAULTS: OverpassClientRuntimeConfig = {
  cooldownMs: DEFAULT_ENDPOINT_COOLDOWN_MS,
  dnsCooldownMs: DEFAULT_DNS_COOLDOWN_MS,
  maxCooldownWaitMs: DEFAULT_MAX_COOLDOWN_WAIT_MS,
  minRequestIntervalMs: MIN_REQUEST_INTERVAL_MS,
  maxAttempts: MAX_ATTEMPTS,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  lastResortTimeoutMs: LAST_RESORT_REQUEST_TIMEOUT_MS,
  backoffBaseMs: 1_000,
  backoffJitterMs: 500,
};

const runtimeConfig: OverpassClientRuntimeConfig = { ...RUNTIME_DEFAULTS };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestAt = 0;
/** Serializes throttle so concurrent chunk workers cannot skip the inter-request gap. */
let throttleTail: Promise<void> = Promise.resolve();

/**
 * In-process cool-until timestamps (epoch ms) per endpoint URL.
 * Not shared with other processes; concurrent chunks in this process share it.
 */
const endpointCoolUntilMs = new Map<string, number>();

async function throttle(): Promise<void> {
  const run = async (): Promise<void> => {
    const elapsed = Date.now() - lastRequestAt;
    const minInterval = runtimeConfig.minRequestIntervalMs;
    if (elapsed < minInterval) {
      await sleep(minInterval - elapsed);
    }
    lastRequestAt = Date.now();
  };
  const wait = throttleTail.then(run, run);
  throttleTail = wait.catch(() => {});
  await wait;
}

/**
 * Resolve the Overpass endpoint pool.
 * `OVERPASS_ENDPOINT` (when set and non-empty) replaces the failover array entirely.
 */
export function getOverpassEndpoints(): string[] {
  const override = process.env.OVERPASS_ENDPOINT?.trim();
  if (override) return [override];
  return [...DEFAULT_OVERPASS_ENDPOINTS];
}

/**
 * Test hook: override timing knobs so retry/cooldown logic can be asserted
 * without multi-second sleeps.
 */
export function configureOverpassClientForTests(
  partial: Partial<OverpassClientRuntimeConfig>
): void {
  Object.assign(runtimeConfig, partial);
}

/**
 * Test hook: clear in-process cool-downs, throttle state, and restore defaults.
 */
export function resetOverpassClientStateForTests(): void {
  endpointCoolUntilMs.clear();
  lastRequestAt = 0;
  throttleTail = Promise.resolve();
  Object.assign(runtimeConfig, RUNTIME_DEFAULTS);
}

/** Test/observability: cool-until map snapshot (epoch ms). */
export function getEndpointCoolUntilForTests(): ReadonlyMap<string, number> {
  return new Map(endpointCoolUntilMs);
}

/**
 * Run async work over `items` with at most `concurrency` in-flight tasks.
 * Results preserve input order.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function pump(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => pump()));
  return results;
}

/**
 * Keep first occurrence of each OSM element id (chunk-boundary duplicates).
 * Matches `app.alpr_cameras.osm_id` primary key / upsert conflict target.
 */
export function dedupeElementsByOsmId(elements: OverpassElement[]): OverpassElement[] {
  const seen = new Map<number, OverpassElement>();
  for (const element of elements) {
    if (!seen.has(element.id)) {
      seen.set(element.id, element);
    }
  }
  return [...seen.values()];
}

/**
 * Deliberately narrow. Bare operator=* or camera=yes match nearly every
 * tagged business/CCTV node in OSM and were the actual cause of chunk
 * timeouts in an earlier version — not network flakiness.
 * surveillance:type regex (case-insensitive) matches the tagging
 * convention observed in the FLOCK/DeFlock snapshot
 * (surveillance:type=ALPR) and nothing else.
 */
function buildAlprQuery(bbox: Bbox): string {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const filter = '["surveillance:type"~"alpr|license.?plate",i]';
  return `
    [out:json][timeout:55];
    (
      node${filter}(${bboxStr});
      way${filter}(${bboxStr});
      relation${filter}(${bboxStr});
    );
    out body center qt;
  `.trim();
}

interface HttpError extends Error {
  status?: number;
  retryAfterMs?: number;
}

/**
 * Extracts the transport error code from an Error, including the case where
 * Node's fetch wraps multiple socket failures into an AggregateError — in
 * that case err.cause?.code and err.code are both undefined; the code lives
 * on errors[0].code.
 */
interface NestedSocketError extends Error {
  cause?: unknown;
  code?: string;
  errors?: Array<{ code?: string; cause?: { code?: string } }>;
}

function extractCode(err: NestedSocketError): string | undefined {
  const cause = err.cause as { code?: string } | undefined;
  if (cause?.code) return cause.code;
  if (err.code) return err.code;
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    const inner = err.errors[0];
    return inner?.code ?? inner?.cause?.code;
  }
  return undefined;
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const err = error as HttpError & NestedSocketError;
  if (err.name === 'AbortError') return true;
  if (typeof err.status === 'number') {
    return [429, 500, 502, 503, 504].includes(err.status);
  }
  const code = extractCode(err);
  if (code && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(code)) {
    return true;
  }
  const msg = err.message.toLowerCase();
  return msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('enotfound');
}

function cooldownMsForError(error: unknown): number {
  const httpError = error as HttpError;
  let coolMs = runtimeConfig.cooldownMs;
  if (typeof httpError.retryAfterMs === 'number' && httpError.retryAfterMs > 0) {
    coolMs = Math.max(runtimeConfig.cooldownMs, httpError.retryAfterMs);
  } else {
    const code = extractCode(error as NestedSocketError);
    if (code === 'ENOTFOUND') coolMs = runtimeConfig.dnsCooldownMs;
  }
  // Never cool longer than the wait bound — otherwise selectEndpoint throws
  // "refusing to hammer" instead of waiting out the TTL.
  return Math.min(coolMs, runtimeConfig.maxCooldownWaitMs);
}

function markEndpointUnhealthy(endpoint: string, error: unknown, now = Date.now()): void {
  endpointCoolUntilMs.set(endpoint, now + cooldownMsForError(error));
}

function clearEndpointCooldown(endpoint: string): void {
  endpointCoolUntilMs.delete(endpoint);
}

interface EndpointPick {
  endpoint: string;
  /** Time slept waiting for a cool-down to expire (0 if immediately eligible). */
  waitedMs: number;
}

function isLastResortEndpoint(endpoint: string): boolean {
  return (LAST_RESORT_OVERPASS_ENDPOINTS as readonly string[]).includes(endpoint);
}

/** Request abort budget for a given mirror (primary 60s, last-resort 90s). */
export function getRequestTimeoutMsForEndpoint(endpoint: string): number {
  return isLastResortEndpoint(endpoint)
    ? runtimeConfig.lastResortTimeoutMs
    : runtimeConfig.requestTimeoutMs;
}

function isEndpointEligible(endpoint: string, now: number): boolean {
  return now >= (endpointCoolUntilMs.get(endpoint) ?? 0);
}

/**
 * Prefer primary mirrors while eligible. Last-resort mirrors (kumi /
 * private.coffee) are only selected when every primary URL in the active
 * pool is cooling (or the pool has no primary, e.g. OVERPASS_ENDPOINT override).
 */
function pickPreferredEligible(
  endpoints: readonly string[],
  startIndex: number,
  now: number
): string | null {
  const hasPrimary = endpoints.some((ep) => !isLastResortEndpoint(ep));
  const primaryCooling =
    hasPrimary &&
    endpoints.filter((ep) => !isLastResortEndpoint(ep)).every((ep) => !isEndpointEligible(ep, now));

  for (let i = 0; i < endpoints.length; i += 1) {
    const endpoint = endpoints[(startIndex + i) % endpoints.length];
    if (!isEndpointEligible(endpoint, now)) continue;
    if (isLastResortEndpoint(endpoint)) {
      if (!hasPrimary || primaryCooling) return endpoint;
      continue;
    }
    return endpoint;
  }
  return null;
}

/**
 * Pick the next eligible endpoint starting at `startIndex`, skipping URLs
 * still inside their in-process cool-down. Last-resort mirrors are demoted
 * until the primary is cooling. When every endpoint is cooling, waits up to
 * maxCooldownWaitMs for the earliest to become eligible.
 */
async function selectEndpoint(
  endpoints: readonly string[],
  startIndex: number,
  now = Date.now()
): Promise<EndpointPick> {
  const immediate = pickPreferredEligible(endpoints, startIndex, now);
  if (immediate) {
    return { endpoint: immediate, waitedMs: 0 };
  }

  let earliest = Infinity;
  for (const endpoint of endpoints) {
    earliest = Math.min(earliest, endpointCoolUntilMs.get(endpoint) ?? 0);
  }
  const waitMs = Math.max(0, earliest - now);
  if (waitMs > runtimeConfig.maxCooldownWaitMs) {
    const err = new Error(
      `All Overpass endpoints are cooling down for at least ${waitMs}ms ` +
        `(max wait ${runtimeConfig.maxCooldownWaitMs}ms); refusing to hammer mirrors`
    );
    throw err;
  }

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  const afterWait = Date.now();
  const after = pickPreferredEligible(endpoints, startIndex, afterWait);
  if (after) {
    return { endpoint: after, waitedMs: waitMs };
  }

  throw new Error(
    'All Overpass endpoints remained cooling after bounded wait; refusing to hammer mirrors'
  );
}

function wrapAbortAsTimeout(endpoint: string, cause: unknown, timeoutMs: number): Error {
  const err = new Error(`Overpass ${endpoint} timed out after ${timeoutMs}ms`) as Error & {
    cause?: unknown;
  };
  err.name = 'AbortError';
  err.cause = cause;
  return err;
}

function preserveFetchCause(endpoint: string, error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(`Overpass ${endpoint} fetch failed: ${String(error)}`);
  }
  if (error.name === 'AbortError') {
    return wrapAbortAsTimeout(endpoint, error, getRequestTimeoutMsForEndpoint(endpoint));
  }
  // Node fetch TypeError("fetch failed") — keep message but ensure endpoint is visible.
  if (error.message === 'fetch failed' || error.message.toLowerCase().includes('fetch failed')) {
    const nested = error as NestedSocketError;
    const wrapped = new Error(`Overpass ${endpoint} fetch failed`) as NestedSocketError;
    wrapped.cause = nested.cause ?? error;
    const code = extractCode(nested);
    if (code) wrapped.code = code;
    if (Array.isArray(nested.errors)) {
      wrapped.errors = nested.errors;
    }
    return wrapped;
  }
  return error;
}

async function requestOnce(endpoint: string, query: string): Promise<OverpassResponse> {
  await throttle();
  const timeoutMs = getRequestTimeoutMsForEndpoint(endpoint);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        signal: controller.signal,
      });
    } catch (error) {
      throw preserveFetchCause(endpoint, error);
    }

    if (!response.ok) {
      const err: HttpError = new Error(`Overpass ${endpoint} returned HTTP ${response.status}`);
      err.status = response.status;
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter ? Number(retryAfter) : NaN;
        if (!Number.isNaN(seconds)) err.retryAfterMs = seconds * 1000;
      }
      throw err;
    }

    return (await response.json()) as OverpassResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatExhaustedError(lastError: unknown, endpoints: readonly string[]): Error {
  const coolSummary = endpoints
    .map((ep) => {
      const until = endpointCoolUntilMs.get(ep);
      return until ? `${ep} (cool until ${new Date(until).toISOString()})` : `${ep} (eligible)`;
    })
    .join('; ');

  if (lastError instanceof Error) {
    const prior = lastError as NestedSocketError & HttpError;
    const exhausted = new Error(
      `${lastError.message} (exhausted ${runtimeConfig.maxAttempts} attempts across endpoints: ${coolSummary})`
    ) as NestedSocketError & HttpError;
    exhausted.cause = prior.cause ?? lastError;
    if (typeof prior.status === 'number') exhausted.status = prior.status;
    return exhausted;
  }
  return new Error(`Overpass request failed after all retries (endpoints: ${coolSummary})`);
}

/**
 * Fetch one bbox chunk with cooldown-aware endpoint selection and backoff.
 * Does not further subdivide.
 */
export async function fetchAlprElementsSingleChunk(bbox: Bbox): Promise<OverpassElement[]> {
  const query = buildAlprQuery(bbox);
  const endpoints = getOverpassEndpoints();
  if (endpoints.length === 0) {
    throw new Error('No Overpass endpoints configured');
  }

  let lastError: unknown;
  let nextIndex = 0;

  for (let attempt = 0; attempt < runtimeConfig.maxAttempts; attempt += 1) {
    let pick: EndpointPick;
    try {
      pick = await selectEndpoint(endpoints, nextIndex);
    } catch (selectionError) {
      if (lastError instanceof Error) {
        const combined = selectionError as Error & { cause?: unknown };
        combined.cause = lastError;
        throw combined;
      }
      throw selectionError;
    }

    const { endpoint, waitedMs } = pick;
    nextIndex = (endpoints.indexOf(endpoint) + 1) % endpoints.length;

    try {
      const payload = await requestOnce(endpoint, query);
      clearEndpointCooldown(endpoint);
      return payload.elements ?? [];
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      markEndpointUnhealthy(endpoint, error);

      const httpError = error as HttpError;
      // If we already waited for a cool-down, skip extra backoff to avoid stacking delays.
      if (waitedMs > 0) continue;

      const backoffMs =
        httpError.retryAfterMs ??
        Math.min(30_000, runtimeConfig.backoffBaseMs * 2 ** attempt) +
          Math.random() * runtimeConfig.backoffJitterMs;
      if (backoffMs > 0) await sleep(backoffMs);
    }
  }

  throw formatExhaustedError(lastError, endpoints);
}

export interface FetchAlprElementsOptions {
  /** Override grid rows (default 2). */
  rows?: number;
  /** Override grid cols (default 2). */
  cols?: number;
  /** Cap concurrent chunk requests (clamped to ≤ {@link CHUNK_CONCURRENCY}). */
  concurrency?: number;
  /** Injectable chunk fetcher (tests); defaults to live Overpass single-chunk fetch. */
  fetchChunk?: (bbox: Bbox) => Promise<OverpassElement[]>;
}

/**
 * Fetch ALPR elements for a region by subdividing into a grid and querying
 * chunks with concurrency ≤ {@link CHUNK_CONCURRENCY}. Boundary duplicates
 * are removed by osm id before return.
 */
export async function fetchAlprElements(
  bbox: Bbox,
  options: FetchAlprElementsOptions = {}
): Promise<OverpassElement[]> {
  const rows = options.rows ?? CHUNK_ROWS;
  const cols = options.cols ?? CHUNK_COLS;
  const concurrency = Math.min(
    CHUNK_CONCURRENCY,
    Math.max(1, options.concurrency ?? CHUNK_CONCURRENCY)
  );
  const fetchChunk = options.fetchChunk ?? fetchAlprElementsSingleChunk;
  const chunks = subdivideBBox(bbox, rows, cols);
  const chunkResults = await runWithConcurrency(chunks, concurrency, (chunk) => fetchChunk(chunk));
  return dedupeElementsByOsmId(chunkResults.flat());
}

export function elementsToRecords(
  elements: OverpassElement[]
): Array<{ osmId: number; lat: number; lon: number; sourceProperties: Record<string, unknown> }> {
  const records: Array<{
    osmId: number;
    lat: number;
    lon: number;
    sourceProperties: Record<string, unknown>;
  }> = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    if (Object.keys(tags).length === 0) continue;
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined) continue;

    const sourceProperties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(tags)) {
      if (value !== undefined && value !== null && value !== '') {
        sourceProperties[key] = value;
      }
    }

    records.push({
      osmId: Number(element.id),
      lat: Number(lat),
      lon: Number(lon),
      sourceProperties,
    });
  }

  return records;
}
