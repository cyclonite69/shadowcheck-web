/**
 * Route module smoke tests.
 *
 * Intent:
 * - Prove each refactored route module can be `require()`'d and mounted as Express middleware.
 * - Validate a small set of stable, contract-level behaviors without a live DB.
 *
 * This is deliberately minimal and avoids asserting legacy endpoint behaviors that frequently drift.
 */

import type { Express } from 'express';

export {};

const express = require('express');
const request = require('supertest');

// Mock secretsManager BEFORE importing routes
jest.mock('../../server/src/services/secretsManager', () => ({
  getSecret: jest.fn(async (key: string) => {
    if (key === 'mapbox_token') {
      return 'pk.test-token';
    }
    return null;
  }),
  get: jest.fn((key: string) => {
    if (key === 'google_maps_api_key') {
      return null;
    }
    return null;
  }),
  has: jest.fn((key: string) => key === 'mapbox_token'),
  smReachable: true,
  smLastError: null,
}));

// Mock the DI container so requiring route modules never touches real infra.
jest.mock('../../server/src/config/container', () => ({
  networkService: {
    getFilteredNetworks: jest.fn(async (params: any) => ({
      ok: true,
      networks: [],
      total: 0,
      offset: params?.offset ?? 0,
      limit: params?.limit ?? 0,
      totalPages: 0,
    })),
  },
  networkTagService: {
    getTaggedNetworks: jest.fn(async () => ({ rows: [], totalCount: 0 })),
    checkNetworkExists: jest.fn(async () => true),
    deleteNetworkTag: jest.fn(async () => true),
    insertNetworkTag: jest.fn(async () => ({ bssid: 'AA:BB:CC:DD:EE:FF' })),
    deleteNetworkTagReturning: jest.fn(async () => 1),
    upsertThreatTag: jest.fn(async () => ({ bssid: 'AA:BB:CC:DD:EE:FF' })),
  },
  secretsManager: {
    getSecret: jest.fn(async (key: string) => (key === 'mapbox_token' ? 'pk.test-token' : null)),
    get: jest.fn(() => null),
    has: jest.fn((key: string) => key === 'mapbox_token'),
    smReachable: true,
    smLastError: null,
  },
  externalServiceHandler: {
    withRetry: (fn: any) => fn(),
  },
}));

jest.mock('../../server/src/middleware/cacheMiddleware', () => ({
  cacheMiddleware: () => (req: any, res: any, next: any) => next(),
}));

// Mock database BEFORE importing routes
jest.mock('../../server/src/config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    connect: jest.fn(),
    end: jest.fn(),
  },
  CONFIG: {
    MIN_VALID_TIMESTAMP: 946684800000,
    MIN_OBSERVATIONS: 2,
    MAX_PAGE_SIZE: 5000,
    DEFAULT_PAGE_SIZE: 100,
  },
}));

const resolveDefault = (m: any) => m?.default || m;

describe('Route modules - smoke', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('route modules are mountable Express middleware', () => {
    const networksRoutes = resolveDefault(require('../../server/src/api/routes/v1/networks'));
    const geospatialRoutes = resolveDefault(require('../../server/src/api/routes/v1/geospatial'));

    const app: Express = express();
    app.use(express.json());
    app.use('/api', networksRoutes);
    app.use(geospatialRoutes);

    expect(typeof networksRoutes).toBe('function');
    expect(typeof geospatialRoutes).toBe('function');
  });

  test('GET /api/networks enforces required limit/offset', async () => {
    const networksRoutes = resolveDefault(require('../../server/src/api/routes/v1/networks'));
    const app: Express = express();
    app.use(express.json());
    app.use('/api', networksRoutes);
    app.use((err: any, req: any, res: any, _next: any) => {
      res.status(500).json({ error: err?.message || String(err) });
    });

    const res = await request(app).get('/api/networks');
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.body.error).toContain('Missing limit parameter');
  });

  test('GET /api/mapbox-token returns token from secrets', async () => {
    const geospatialRoutes = resolveDefault(require('../../server/src/api/routes/v1/geospatial'));
    const app: Express = express();
    app.use(express.json());
    app.use(geospatialRoutes);

    const res = await request(app).get('/api/mapbox-token');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.token).toBe('pk.test-token');
  });
});
