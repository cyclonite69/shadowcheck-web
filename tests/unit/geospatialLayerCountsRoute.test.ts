import express from 'express';
import request from 'supertest';

const mockGetLayerCounts = jest.fn();

jest.mock('../../server/src/services/layerCountsService', () => ({
  getLayerCounts: mockGetLayerCounts,
}));

jest.mock('../../server/src/middleware/authMiddleware', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../server/src/config/container', () => ({
  secretsManager: {
    getSecret: jest.fn(),
  },
  externalServiceHandler: {
    withRetry: jest.fn(),
  },
}));

jest.mock('../../server/src/api/routes/v1/geospatial/tiles', () => ({
  __esModule: true,
  default: express.Router(),
}));

jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const geospatialRouter = require('../../server/src/api/routes/v1/geospatial');

const app = express();
app.use(express.json());
app.use('/', geospatialRouter);

describe('GET /api/geospatial/layer-counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 and layer counts payload on success', async () => {
    const mockPayload = {
      counts: {
        home: 1,
        fieldObservations: 870846,
        wigleKml: 420764,
        wigleV2: 232007,
        wigleV3: 217667,
        courthouses: 357,
        fieldOffices: 56,
        residentAgencies: 334,
        alpr: 187308,
        shotspotterZones: 11,
        shotspotterSensors: 20280,
      },
      cached: false,
      timestamp: '2026-10-13T09:00:00.000Z',
    };

    mockGetLayerCounts.mockResolvedValueOnce(mockPayload);

    const res = await request(app).get('/api/geospatial/layer-counts');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.counts).toEqual(mockPayload.counts);
    expect(res.body.cached).toBe(false);
    expect(res.body.timestamp).toBe('2026-10-13T09:00:00.000Z');
    expect(mockGetLayerCounts).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when service throws an error', async () => {
    mockGetLayerCounts.mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app).get('/api/geospatial/layer-counts');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Failed to fetch geospatial layer counts');
    expect(res.body.details).toBe('Database error');
  });
});
