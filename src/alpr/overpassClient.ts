/**
 * Overpass client: endpoint rotation, retry/backoff, ALPR-specific query,
 * and bbox grid chunking with capped concurrency.
 * Public Overpass instances rate-limit per IP and will temp-ban abusive
 * clients — keep MIN_REQUEST_INTERVAL_MS conservative, chunk concurrency ≤ 2.
 */

import { subdivideBBox } from './regions';

const DEFAULT_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  // overpass.nchc.org.tw removed 2026-09-19: host does not resolve (ENOTFOUND);
  // it burned a retry slot on every chunk with a useless "fetch failed" TypeError.
];

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 4;
const MIN_REQUEST_INTERVAL_MS = 5_000;
const CHUNK_ROWS = 2;
const CHUNK_COLS = 2;
/** Hard cap on concurrent Overpass chunk requests (public mirror IP limits). */
export const CHUNK_CONCURRENCY = 2;
const USER_AGENT = 'ShadowCheck-ALPR-Sync/1.0 (local research use)';

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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestAt = 0;
/** Serializes throttle so concurrent chunk workers cannot skip the inter-request gap. */
let throttleTail: Promise<void> = Promise.resolve();

async function throttle(): Promise<void> {
  const run = async (): Promise<void> => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
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
  cause?: { code?: string };
  code?: string;
  errors?: Array<{ code?: string; cause?: { code?: string } }>;
}

function extractCode(err: NestedSocketError): string | undefined {
  if (err.cause?.code) return err.cause.code;
  if (err.code) return err.code;
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    const inner = err.errors[0];
    return inner?.code ?? inner?.cause?.code;
  }
  return undefined;
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const err = error as HttpError & { cause?: { code?: string }; code?: string };
  if (err.name === 'AbortError') return true;
  if (typeof err.status === 'number') {
    return [429, 500, 502, 503, 504].includes(err.status);
  }
  const code = extractCode(err);
  if (code && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(code)) {
    return true;
  }
  const msg = err.message.toLowerCase();
  return msg.includes('timeout') || msg.includes('econnrefused');
}

async function requestOnce(endpoint: string, query: string): Promise<OverpassResponse> {
  await throttle();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

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

/**
 * Fetch one bbox chunk with endpoint rotation / exponential backoff.
 * Does not further subdivide.
 */
export async function fetchAlprElementsSingleChunk(bbox: Bbox): Promise<OverpassElement[]> {
  const query = buildAlprQuery(bbox);
  const endpoints = getOverpassEndpoints();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const endpoint = endpoints[attempt % endpoints.length];
    try {
      const payload = await requestOnce(endpoint, query);
      return payload.elements ?? [];
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      const httpError = error as HttpError;
      const backoffMs =
        httpError.retryAfterMs ?? Math.min(30_000, 1_000 * 2 ** attempt) + Math.random() * 500;
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Overpass request failed after all retries');
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
