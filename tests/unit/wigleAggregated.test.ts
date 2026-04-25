export {};

// ─── DB mock (service tests) ──────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../../server/src/config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

// ─── Route-level mocks (integration tests) ────────────────────────────────────
jest.mock('../../server/src/config/container', () => ({
  wigleService: {
    getAggregatedObservations: jest.fn(),
  },
}));

jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../../server/src/utils/asyncHandler', () => ({
  asyncHandler: (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
}));

import request from 'supertest';
import express from 'express';
import { buildAggregatedObservationsQuery } from '../../server/src/repositories/wigleQueriesRepository';
import { getAggregatedObservations } from '../../server/src/services/wigle/database';

const aggregatedRouter = require('../../server/src/api/routes/v1/wigle/aggregated').default;
const app = express();
app.use(express.json());
app.use('/api/wigle', aggregatedRouter);
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(500).json({ error: err.message });
});

const { wigleService } = require('../../server/src/config/container');

// ─────────────────────────────────────────────────────────────────────────────
// 1. buildAggregatedObservationsQuery
// ─────────────────────────────────────────────────────────────────────────────

describe('buildAggregatedObservationsQuery', () => {
  const bbox = { west: -74, south: 40, east: -73, north: 41 };
  const allSources = ['field', 'wigle-v2', 'wigle-v3', 'kml'];

  describe('grid size selection', () => {
    it('z5 → 0.5°', () => {
      const { queryParams } = buildAggregatedObservationsQuery({
        ...bbox,
        zoom: 5,
        sources: allSources,
      });
      expect(queryParams[4]).toBe(0.5);
    });

    it('z9 → 0.2°', () => {
      const { queryParams } = buildAggregatedObservationsQuery({
        ...bbox,
        zoom: 9,
        sources: allSources,
      });
      expect(queryParams[4]).toBe(0.2);
    });

    it('z13 → 0.01°', () => {
      const { queryParams } = buildAggregatedObservationsQuery({
        ...bbox,
        zoom: 13,
        sources: allSources,
      });
      expect(queryParams[4]).toBe(0.01);
    });

    it('z14 → 0.005° (raw point threshold)', () => {
      const { queryParams } = buildAggregatedObservationsQuery({
        ...bbox,
        zoom: 14,
        sources: allSources,
      });
      expect(queryParams[4]).toBe(0.005);
    });
  });

  it('bbox params are bound to $1–$4 in west/south/east/north order', () => {
    const { queryParams } = buildAggregatedObservationsQuery({
      west: -100,
      south: 30,
      east: -90,
      north: 50,
      zoom: 10,
      sources: allSources,
    });
    expect(queryParams.slice(0, 4)).toEqual([-100, 30, -90, 50]);
  });

  it('sources: ["field"] — includes only app.observations branch', () => {
    const { sql } = buildAggregatedObservationsQuery({
      ...bbox,
      zoom: 10,
      sources: ['field'],
    });
    expect(sql).toContain('app.observations');
    expect(sql).not.toContain('wigle_v2_networks_search');
    expect(sql).not.toContain('wigle_v3_observations');
    expect(sql).not.toContain('kml_points');
  });

  it('all four sources included when sources is full array', () => {
    const { sql } = buildAggregatedObservationsQuery({
      ...bbox,
      zoom: 10,
      sources: allSources,
    });
    expect(sql).toContain('app.observations');
    expect(sql).toContain('wigle_v2_networks_search');
    expect(sql).toContain('wigle_v3_observations');
    expect(sql).toContain('kml_points');
  });

  it('sources: ["wigle-v3", "kml"] — excludes field and wigle-v2', () => {
    const { sql } = buildAggregatedObservationsQuery({
      ...bbox,
      zoom: 10,
      sources: ['wigle-v3', 'kml'],
    });
    expect(sql).toContain('wigle_v3_observations');
    expect(sql).toContain('kml_points');
    expect(sql).not.toContain('app.observations');
    expect(sql).not.toContain('wigle_v2_networks_search');
  });

  it('empty sources array — no UNION branches in SQL', () => {
    const { sql } = buildAggregatedObservationsQuery({
      ...bbox,
      zoom: 10,
      sources: [],
    });
    expect(sql).not.toContain('app.observations');
    expect(sql).not.toContain('wigle_v2_networks_search');
    expect(sql).not.toContain('wigle_v3_observations');
    expect(sql).not.toContain('kml_points');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getAggregatedObservations service (mock DB)
// ─────────────────────────────────────────────────────────────────────────────

describe('getAggregatedObservations', () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  it('calls query with correct sql and params, returns typed rows', async () => {
    const expected = [{ lon: -73.5, lat: 40.5, count: 42, avg_signal: -70, source: 'field' }];
    mockQuery.mockResolvedValueOnce({ rows: expected });

    const result = await getAggregatedObservations({
      west: -74,
      south: 40,
      east: -73,
      north: 41,
      zoom: 10,
      sources: ['field'],
    });

    expect(result).toEqual(expected);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('app.observations');
    expect(sql).not.toContain('wigle_v2_networks_search');
    expect(params[0]).toBe(-74); // west → $1
    expect(params[1]).toBe(40); // south → $2
    expect(params[2]).toBe(-73); // east  → $3
    expect(params[3]).toBe(41); // north → $4
  });

  it('returns empty array when query yields no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getAggregatedObservations({
      west: -74,
      south: 40,
      east: -73,
      north: 41,
      zoom: 10,
      sources: ['wigle-v3'],
    });

    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/wigle/observations/aggregated route
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/wigle/observations/aggregated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation — 400 responses', () => {
    it('missing west → 400', async () => {
      const res = await request(app).get(
        '/api/wigle/observations/aggregated?south=40&east=-73&north=41&zoom=10'
      );
      expect(res.status).toBe(400);
    });

    it('missing all bbox params → 400', async () => {
      const res = await request(app).get('/api/wigle/observations/aggregated?zoom=10');
      expect(res.status).toBe(400);
    });

    it('missing zoom → 400', async () => {
      const res = await request(app).get(
        '/api/wigle/observations/aggregated?west=-74&south=40&east=-73&north=41'
      );
      expect(res.status).toBe(400);
    });

    it('zoom > 22 → 400', async () => {
      const res = await request(app).get(
        '/api/wigle/observations/aggregated?west=-74&south=40&east=-73&north=41&zoom=25'
      );
      expect(res.status).toBe(400);
    });

    it('unknown source value → 400', async () => {
      const res = await request(app).get(
        '/api/wigle/observations/aggregated?west=-74&south=40&east=-73&north=41&zoom=10&sources=invalid-layer'
      );
      expect(res.status).toBe(400);
    });

    it('mixed valid and invalid sources → 400', async () => {
      const res = await request(app).get(
        '/api/wigle/observations/aggregated?west=-74&south=40&east=-73&north=41&zoom=10&sources=field,bogus'
      );
      expect(res.status).toBe(400);
    });
  });

  describe('valid requests — 200 responses', () => {
    it('returns GeoJSON FeatureCollection shape', async () => {
      wigleService.getAggregatedObservations.mockResolvedValueOnce([
        { lon: -73.5, lat: 40.5, count: 10, avg_signal: -72, source: 'field' },
      ]);

      const res = await request(app).get(
        '/api/wigle/observations/aggregated?west=-74&south=40&east=-73&north=41&zoom=10'
      );

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
      expect(res.body.features[0]).toMatchObject({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-73.5, 40.5] },
        properties: { count: 10, avg_signal: -72, source: 'field' },
      });
    });

    it('sources=field,kml calls service with only field and kml', async () => {
      wigleService.getAggregatedObservations.mockResolvedValueOnce([]);

      await request(app).get(
        '/api/wigle/observations/aggregated?west=-74&south=40&east=-73&north=41&zoom=10&sources=field,kml'
      );

      expect(wigleService.getAggregatedObservations).toHaveBeenCalledWith(
        expect.objectContaining({ sources: ['field', 'kml'] })
      );
    });

    it('omitting sources param calls service with all four sources', async () => {
      wigleService.getAggregatedObservations.mockResolvedValueOnce([]);

      await request(app).get(
        '/api/wigle/observations/aggregated?west=-74&south=40&east=-73&north=41&zoom=10'
      );

      expect(wigleService.getAggregatedObservations).toHaveBeenCalledWith(
        expect.objectContaining({ sources: ['field', 'wigle-v2', 'wigle-v3', 'kml'] })
      );
    });

    it('returns empty FeatureCollection when service yields no rows', async () => {
      wigleService.getAggregatedObservations.mockResolvedValueOnce([]);

      const res = await request(app).get(
        '/api/wigle/observations/aggregated?west=-74&south=40&east=-73&north=41&zoom=10'
      );

      expect(res.status).toBe(200);
      expect(res.body.features).toEqual([]);
    });
  });
});
