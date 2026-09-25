import { subdivideBBox, type BBoxWsen } from '../../../src/alpr/regions';
import {
  CHUNK_CONCURRENCY,
  configureOverpassClientForTests,
  dedupeElementsByOsmId,
  fetchAlprElements,
  fetchAlprElementsSingleChunk,
  getEndpointCoolUntilForTests,
  getOverpassEndpoints,
  getRequestTimeoutMsForEndpoint,
  LAST_RESORT_REQUEST_TIMEOUT_MS,
  PRIMARY_OVERPASS_ENDPOINT,
  REQUEST_TIMEOUT_MS,
  resetOverpassClientStateForTests,
  runWithConcurrency,
  type Bbox,
  type OverpassElement,
} from '../../../src/alpr/overpassClient';

describe('subdivideBBox', () => {
  const parent: BBoxWsen = { west: -84.7, south: 33.5, east: -84.0, north: 34.1 };

  it('splits into a 2x2 grid covering the parent without gaps', () => {
    const chunks = subdivideBBox(parent, 2, 2);
    expect(chunks).toHaveLength(4);

    expect(chunks[0]).toEqual({
      west: -84.7,
      south: 33.5,
      east: -84.35,
      north: 33.8,
    });
    expect(chunks[1]).toEqual({
      west: -84.35,
      south: 33.5,
      east: -84.0,
      north: 33.8,
    });
    expect(chunks[2]).toEqual({
      west: -84.7,
      south: 33.8,
      east: -84.35,
      north: 34.1,
    });
    expect(chunks[3]).toEqual({
      west: -84.35,
      south: 33.8,
      east: -84.0,
      north: 34.1,
    });
  });

  it('supports asymmetric grids and preserves outer corners', () => {
    const chunks = subdivideBBox(parent, 1, 3);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].west).toBe(parent.west);
    expect(chunks[0].south).toBe(parent.south);
    expect(chunks[0].north).toBe(parent.north);
    expect(chunks[2].east).toBe(parent.east);
    expect(chunks[2].north).toBe(parent.north);
  });

  it('rejects non-positive subdivision counts', () => {
    expect(() => subdivideBBox(parent, 0, 2)).toThrow(/rows and cols/);
    expect(() => subdivideBBox(parent, 2, -1)).toThrow(/rows and cols/);
  });
});

describe('runWithConcurrency', () => {
  it('preserves input order and never exceeds the concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = [10, 20, 30, 40, 50];

    const results = await runWithConcurrency(items, 2, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return item * 2;
    });

    expect(results).toEqual([20, 40, 60, 80, 100]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBe(2);
  });

  it('returns an empty array for empty input without invoking the worker', async () => {
    const worker = jest.fn();
    await expect(runWithConcurrency([], 2, worker)).resolves.toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });
});

describe('fetchAlprElements chunk runner', () => {
  const bbox: Bbox = { west: -74.3, south: 40.5, east: -73.65, north: 41.0 };

  it('queries each grid chunk with C≤2 and dedupes boundary osm ids', async () => {
    let inFlight = 0;
    let peak = 0;
    const seenChunks: Bbox[] = [];

    const fetchChunk = jest.fn(async (chunk: Bbox): Promise<OverpassElement[]> => {
      seenChunks.push(chunk);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 15));
      inFlight -= 1;

      // Shared boundary id 999 appears in every chunk response.
      return [
        {
          type: 'node',
          id: 999,
          lat: chunk.south,
          lon: chunk.west,
          tags: { 'surveillance:type': 'ALPR' },
        },
        {
          type: 'node',
          id: chunk.west * 1000 + chunk.south,
          lat: chunk.north,
          lon: chunk.east,
          tags: { 'surveillance:type': 'ALPR' },
        },
      ];
    });

    const elements = await fetchAlprElements(bbox, {
      rows: 2,
      cols: 2,
      concurrency: 4, // request higher; must clamp to CHUNK_CONCURRENCY
      fetchChunk,
    });

    expect(fetchChunk).toHaveBeenCalledTimes(4);
    expect(peak).toBeLessThanOrEqual(CHUNK_CONCURRENCY);
    expect(peak).toBe(1);
    expect(CHUNK_CONCURRENCY).toBe(1);
    expect(seenChunks).toEqual(subdivideBBox(bbox, 2, 2));

    const ids = elements.map((e) => e.id);
    expect(ids.filter((id) => id === 999)).toHaveLength(1);
    expect(ids).toHaveLength(5); // 1 shared + 4 unique
  });
});

describe('dedupeElementsByOsmId', () => {
  it('keeps the first occurrence of each osm id', () => {
    const elements: OverpassElement[] = [
      { type: 'node', id: 1, lat: 1, lon: 1, tags: { a: '1' } },
      { type: 'node', id: 1, lat: 2, lon: 2, tags: { a: '2' } },
      { type: 'way', id: 2, center: { lat: 3, lon: 3 }, tags: { b: '1' } },
    ];
    const deduped = dedupeElementsByOsmId(elements);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].tags).toEqual({ a: '1' });
    expect(deduped[1].id).toBe(2);
  });
});

describe('getOverpassEndpoints', () => {
  const original = process.env.OVERPASS_ENDPOINT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.OVERPASS_ENDPOINT;
    } else {
      process.env.OVERPASS_ENDPOINT = original;
    }
  });

  it('returns the failover pool when OVERPASS_ENDPOINT is unset', () => {
    delete process.env.OVERPASS_ENDPOINT;
    const endpoints = getOverpassEndpoints();
    expect(endpoints.length).toBeGreaterThanOrEqual(2);
    expect(endpoints[0]).toContain('overpass');
    expect(endpoints.some((url) => url.includes('nchc.org.tw'))).toBe(false);
  });

  it('replaces the failover pool entirely when OVERPASS_ENDPOINT is set', () => {
    process.env.OVERPASS_ENDPOINT = '  http://localhost:8080/api/interpreter  ';
    expect(getOverpassEndpoints()).toEqual(['http://localhost:8080/api/interpreter']);
  });
});

describe('fetchAlprElementsSingleChunk endpoint cooldown', () => {
  const bbox: Bbox = { west: -98.0, south: 30.0, east: -97.9, north: 30.1 };
  const originalEnv = process.env.OVERPASS_ENDPOINT;
  const originalFetch = global.fetch;

  function jsonOk(elements: OverpassElement[] = []): Response {
    return {
      ok: true,
      status: 200,
      json: async () => ({ elements }),
      headers: new Headers(),
    } as Response;
  }

  function httpError(status: number, retryAfter?: string): Response {
    const headers = new Headers();
    if (retryAfter) {
      headers.set('retry-after', retryAfter);
    }
    return {
      ok: false,
      status,
      json: async () => ({}),
      headers,
    } as Response;
  }

  beforeEach(() => {
    resetOverpassClientStateForTests();
    configureOverpassClientForTests({
      minRequestIntervalMs: 0,
      backoffBaseMs: 0,
      backoffJitterMs: 0,
      cooldownMs: 60_000,
      dnsCooldownMs: 120_000,
      maxCooldownWaitMs: 30_000,
      maxAttempts: 4,
      requestTimeoutMs: 60_000,
    });
    delete process.env.OVERPASS_ENDPOINT;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resetOverpassClientStateForTests();
    if (originalEnv === undefined) {
      delete process.env.OVERPASS_ENDPOINT;
    } else {
      process.env.OVERPASS_ENDPOINT = originalEnv;
    }
  });

  function installFetchRouter(
    handler: (url: string, callIndex: number, init?: RequestInit) => Promise<Response> | Response
  ): { urls: string[]; calls: number } {
    const state = { urls: [] as string[], calls: 0 };
    const pool = getOverpassEndpoints();
    expect(pool.length).toBeGreaterThanOrEqual(3);

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const callIndex = state.calls;
      state.calls += 1;
      state.urls.push(url);
      return handler(url, callIndex, init);
    }) as unknown as typeof fetch;

    return state;
  }

  it('rotates away from a 504 endpoint and does not immediately re-hit it', async () => {
    const pool = getOverpassEndpoints();
    const state = installFetchRouter(async (url) => {
      if (url === pool[0]) {
        return httpError(504);
      }
      return jsonOk([{ type: 'node', id: 1, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
    });

    const elements = await fetchAlprElementsSingleChunk(bbox);

    expect(elements).toHaveLength(1);
    expect(state.urls[0]).toBe(pool[0]);
    expect(state.urls[1]).toBe(pool[1]);
    expect(state.urls.filter((u) => u === pool[0])).toHaveLength(1);
    expect(getEndpointCoolUntilForTests().has(pool[0])).toBe(true);
    expect(getEndpointCoolUntilForTests().has(pool[1])).toBe(false);
  });

  it('rotates after a client timeout (AbortError) and preserves timeout wording', async () => {
    const pool = getOverpassEndpoints();
    configureOverpassClientForTests({ requestTimeoutMs: 20 });

    const state = installFetchRouter(async (url, _callIndex, init) => {
      if (url === pool[0]) {
        await new Promise<void>((_resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('mock should have been aborted'));
          }, 200);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            const err = new Error('This operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }
      return jsonOk([{ type: 'node', id: 2, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
    });

    const elements = await fetchAlprElementsSingleChunk(bbox);
    expect(elements).toHaveLength(1);
    expect(state.urls[0]).toBe(pool[0]);
    expect(state.urls[1]).toBe(pool[1]);
    expect(state.urls.filter((u) => u === pool[0])).toHaveLength(1);
    expect(getEndpointCoolUntilForTests().has(pool[0])).toBe(true);
  });

  it('moves to another endpoint on DNS ENOTFOUND then refuses to re-hammer while cool', async () => {
    const pool = getOverpassEndpoints();
    const state = installFetchRouter(async (url) => {
      if (url === pool[0]) {
        const cause = new Error('getaddrinfo ENOTFOUND mirror-a.test') as NodeJS.ErrnoException;
        cause.code = 'ENOTFOUND';
        const err = new TypeError('fetch failed');
        (err as Error & { cause?: unknown }).cause = cause;
        throw err;
      }
      if (url === pool[1]) {
        const cause = new Error('connect ECONNREFUSED') as NodeJS.ErrnoException;
        cause.code = 'ECONNREFUSED';
        const err = new TypeError('fetch failed');
        (err as Error & { cause?: unknown }).cause = cause;
        throw err;
      }
      if (url === pool[2]) {
        const cause = new Error('read ECONNRESET') as NodeJS.ErrnoException;
        cause.code = 'ECONNRESET';
        const err = new TypeError('fetch failed');
        (err as Error & { cause?: unknown }).cause = cause;
        throw err;
      }
      throw new Error(`unexpected url ${url}`);
    });

    configureOverpassClientForTests({
      cooldownMs: 60_000,
      dnsCooldownMs: 120_000,
      maxCooldownWaitMs: 5,
      maxAttempts: 4,
    });

    try {
      await fetchAlprElementsSingleChunk(bbox);
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const err = error as Error & { cause?: unknown };
      expect(err.message).toMatch(/cooling|fetch failed|exhausted|refusing to hammer/i);
      // cause may be absent when selectEndpoint throws after the bounded wait
      // with no prior lastError attached on the final refuse path.
    }

    // All three mirrors fail; cool-until is capped to maxCooldownWaitMs (5ms), so
    // a later attempt can re-hit primary after the bounded wait — still fails.
    expect(state.urls[0]).toBe(pool[0]);
    expect(state.urls[1]).toBe(pool[1]);
    expect(state.urls[2]).toBe(pool[2]);
    expect(state.urls.length).toBeGreaterThanOrEqual(3);
    expect(getEndpointCoolUntilForTests().has(pool[0])).toBe(true);
  });

  it('stops retrying once a fallback endpoint succeeds', async () => {
    const pool = getOverpassEndpoints();
    let bCalls = 0;
    const state = installFetchRouter(async (url) => {
      if (url === pool[0]) {
        return httpError(504);
      }
      if (url === pool[1]) {
        bCalls += 1;
        return jsonOk([{ type: 'node', id: 3, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
      }
      throw new Error('must not reach third mirror after success');
    });

    await fetchAlprElementsSingleChunk(bbox);
    expect(bCalls).toBe(1);
    expect(state.urls).toEqual([pool[0], pool[1]]);
  });

  it('waits for the earliest cool endpoint when the pool is temporarily all-cooling', async () => {
    const pool = getOverpassEndpoints();
    configureOverpassClientForTests({
      cooldownMs: 40,
      dnsCooldownMs: 40,
      maxCooldownWaitMs: 500,
      maxAttempts: 4,
    });

    const state = installFetchRouter(async (_url, callIndex) => {
      if (callIndex < 3) {
        return httpError(504);
      }
      return jsonOk([{ type: 'node', id: 4, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
    });

    const started = Date.now();
    const elements = await fetchAlprElementsSingleChunk(bbox);
    const elapsed = Date.now() - started;

    expect(elements).toHaveLength(1);
    expect(state.urls).toHaveLength(4);
    expect(state.urls[3]).toBe(pool[0]);
    expect(elapsed).toBeGreaterThanOrEqual(30);
  });

  it('throws a useful error when all endpoints stay cooling beyond the wait bound', async () => {
    const pool = getOverpassEndpoints();
    configureOverpassClientForTests({
      cooldownMs: 60_000,
      maxCooldownWaitMs: 10,
      maxAttempts: 4,
    });

    installFetchRouter(async () => httpError(504));

    try {
      await fetchAlprElementsSingleChunk(bbox);
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const msg = (error as Error).message;
      expect(msg).toMatch(/cooling down|exhausted/);
      expect(msg).toMatch(/HTTP 504|overpass|mirror/i);
      expect((error as Error & { cause?: unknown }).cause).toBeDefined();
    }

    const cool = getEndpointCoolUntilForTests();
    expect(cool.has(pool[0])).toBe(true);
    expect(cool.has(pool[1])).toBe(true);
    expect(cool.has(pool[2])).toBe(true);
  });

  it('shares cool-down across subsequent chunk fetches in-process', async () => {
    const pool = getOverpassEndpoints();
    configureOverpassClientForTests({
      cooldownMs: 60_000,
      maxCooldownWaitMs: 30_000,
      maxAttempts: 4,
    });

    const state = installFetchRouter(async (url) => {
      if (url === pool[0]) {
        return httpError(504);
      }
      return jsonOk([{ type: 'node', id: 5, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
    });

    await fetchAlprElementsSingleChunk(bbox);
    const afterFirst = state.urls.length;
    expect(state.urls[0]).toBe(pool[0]);
    expect(getEndpointCoolUntilForTests().has(pool[0])).toBe(true);

    await fetchAlprElementsSingleChunk({ ...bbox, east: bbox.east + 0.01 });
    const secondPass = state.urls.slice(afterFirst);
    expect(secondPass.length).toBeGreaterThan(0);
    expect(secondPass.every((u) => u !== pool[0])).toBe(true);
  });

  it('demotes last-resort mirrors until overpass-api.de is cooling', async () => {
    resetOverpassClientStateForTests();
    configureOverpassClientForTests({
      minRequestIntervalMs: 0,
      backoffBaseMs: 0,
      backoffJitterMs: 0,
      cooldownMs: 60_000,
      maxAttempts: 4,
    });
    const pool = getOverpassEndpoints();
    expect(pool[0]).toBe(PRIMARY_OVERPASS_ENDPOINT);

    // Primary eligible and succeeding — must never touch kumi/private.
    const state = installFetchRouter(async (url) => {
      if (url.includes('kumi.systems') || url.includes('private.coffee')) {
        throw new Error(`last-resort ${url} must not be contacted while primary is eligible`);
      }
      return jsonOk([{ type: 'node', id: 10, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
    });

    await fetchAlprElementsSingleChunk(bbox);
    expect(state.urls).toEqual([PRIMARY_OVERPASS_ENDPOINT]);
  });

  it('uses last-resort only after primary cool-down, with 90s abort budget', async () => {
    resetOverpassClientStateForTests();
    configureOverpassClientForTests({
      minRequestIntervalMs: 0,
      backoffBaseMs: 0,
      backoffJitterMs: 0,
      cooldownMs: 60_000,
      lastResortTimeoutMs: LAST_RESORT_REQUEST_TIMEOUT_MS,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      maxAttempts: 4,
    });

    const pool = getOverpassEndpoints();
    expect(getRequestTimeoutMsForEndpoint(pool[0])).toBe(REQUEST_TIMEOUT_MS);
    expect(getRequestTimeoutMsForEndpoint(pool[1])).toBe(LAST_RESORT_REQUEST_TIMEOUT_MS);
    expect(getRequestTimeoutMsForEndpoint(pool[2])).toBe(LAST_RESORT_REQUEST_TIMEOUT_MS);
    expect(LAST_RESORT_REQUEST_TIMEOUT_MS).toBe(90_000);

    // Short last-resort abort for the live abort assertion (still demoted path).
    configureOverpassClientForTests({ lastResortTimeoutMs: 40 });

    const state = installFetchRouter(async (url, _i, init) => {
      if (url === pool[0]) {
        return httpError(504);
      }
      if (url === pool[1]) {
        await new Promise<void>((_resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('kumi should have been aborted by last-resort timeout'));
          }, 500);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            const err = new Error('This operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }
      return jsonOk([{ type: 'node', id: 11, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
    });

    const started = Date.now();
    const elements = await fetchAlprElementsSingleChunk(bbox);
    const elapsed = Date.now() - started;

    expect(elements).toHaveLength(1);
    expect(state.urls[0]).toBe(pool[0]);
    expect(state.urls[1]).toBe(pool[1]);
    expect(state.urls[2]).toBe(pool[2]);
    expect(state.urls.filter((u) => u === pool[0])).toHaveLength(1);
    // Last-resort abort should fire near 40ms, not the 60s primary budget.
    expect(elapsed).toBeLessThan(400);
  });

  it('re-eligibilizes a cooled endpoint after its cool-until TTL elapses', async () => {
    const pool = getOverpassEndpoints();
    configureOverpassClientForTests({
      cooldownMs: 80,
      dnsCooldownMs: 80,
      maxCooldownWaitMs: 200,
      maxAttempts: 4,
    });

    let primaryHits = 0;
    const state = installFetchRouter(async (url) => {
      if (url === pool[0]) {
        primaryHits += 1;
        // First contact fails; after TTL elapses the next contact succeeds.
        if (primaryHits === 1) {
          return httpError(504);
        }
        return jsonOk([{ type: 'node', id: 42, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
      }
      return jsonOk([{ type: 'node', id: 43, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
    });

    await fetchAlprElementsSingleChunk(bbox);
    expect(getEndpointCoolUntilForTests().has(pool[0])).toBe(true);
    const coolUntil = getEndpointCoolUntilForTests().get(pool[0])!;
    expect(coolUntil).toBeGreaterThan(Date.now());

    // Wall-clock past cool-until — endpoint must be eligible again (not merely
    // "skipped on the next immediate attempt").
    const waitMs = Math.max(0, coolUntil - Date.now()) + 15;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    expect(Date.now()).toBeGreaterThanOrEqual(coolUntil);

    const afterCool = state.urls.length;
    await fetchAlprElementsSingleChunk({ ...bbox, east: bbox.east + 0.02 });
    const secondPass = state.urls.slice(afterCool);
    expect(secondPass[0]).toBe(pool[0]);
    expect(primaryHits).toBe(2);
  });

  it('caps cool-until so the bounded wait path can unblock within maxCooldownWaitMs', async () => {
    const pool = getOverpassEndpoints();
    configureOverpassClientForTests({
      cooldownMs: 10_000,
      maxCooldownWaitMs: 60,
      maxAttempts: 4,
    });

    const state = installFetchRouter(async (_url, callIndex) => {
      if (callIndex === 0) {
        return httpError(504);
      }
      return jsonOk([{ type: 'node', id: 99, lat: 30.05, lon: -97.95, tags: { a: '1' } }]);
    });

    const started = Date.now();
    const elements = await fetchAlprElementsSingleChunk(bbox);
    const elapsed = Date.now() - started;

    expect(elements).toHaveLength(1);
    // Primary cooled, last-resort may be skipped in favor of waiting — either way
    // we must recover without the "refusing to hammer" throw.
    expect(elapsed).toBeLessThan(500);
    const coolUntil = getEndpointCoolUntilForTests().get(pool[0]);
    if (coolUntil) {
      // Cap: remaining cool after mark must be ≤ maxCooldownWaitMs (+ small skew).
      expect(coolUntil - started).toBeLessThanOrEqual(80);
    }
    expect(state.urls.length).toBeGreaterThanOrEqual(2);
  });

  it('never exceeds CHUNK_CONCURRENCY=1 for live chunk fan-out', async () => {
    expect(CHUNK_CONCURRENCY).toBe(1);
    let inFlight = 0;
    let peak = 0;
    const fetchChunk = jest.fn(async (): Promise<OverpassElement[]> => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 25));
      inFlight -= 1;
      return [];
    });

    await fetchAlprElements(bbox, { rows: 2, cols: 2, concurrency: 8, fetchChunk });
    expect(peak).toBe(1);
    expect(fetchChunk).toHaveBeenCalledTimes(4);
  });
});
