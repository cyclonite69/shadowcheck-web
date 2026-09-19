import { subdivideBBox, type BBoxWsen } from '../../../src/alpr/regions';
import {
  CHUNK_CONCURRENCY,
  dedupeElementsByOsmId,
  fetchAlprElements,
  getOverpassEndpoints,
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
