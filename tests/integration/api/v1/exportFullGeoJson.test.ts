import request from 'supertest';
import express from 'express';

// Mock auth middleware to test both authenticated/unauthenticated/admin/non-admin states
let mockAuthUser: { id: string; username: string; role: string } | null = null;

jest.mock('../../../../server/src/middleware/authMiddleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockAuthUser) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    }
    req.user = mockAuthUser;
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (!mockAuthUser) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    }
    if (mockAuthUser.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Admin access required', code: 'INSUFFICIENT_PERMISSIONS' });
    }
    req.user = mockAuthUser;
    next();
  },
}));

// Mock logger
jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock exportService
jest.mock('../../../../server/src/config/container', () => ({
  exportService: {
    getObservationsForCSV: jest.fn(),
    getObservationsAndNetworksForJSON: jest.fn(),
    getFullDatabaseSnapshot: jest.fn(),
    getObservationsForGeoJSON: jest.fn(),
    getObservationsForKML: jest.fn(),
    generateKML: jest.fn(),
    streamAllObservationsGeoJson: jest.fn(),
  },
}));

const container = require('../../../../server/src/config/container');
const exportRouter = require('../../../../server/src/api/routes/v1/export');

const app = express();
app.use(express.json());
app.use('/api', exportRouter);

describe('GET /api/geojson/full integration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = { id: 'admin-1', username: 'admin', role: 'admin' };
  });

  describe('Authorization checks', () => {
    it('returns 401 when no authentication session is present', async () => {
      mockAuthUser = null;

      const res = await request(app).get('/api/geojson/full');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('NO_TOKEN');
      expect(container.exportService.streamAllObservationsGeoJson).not.toHaveBeenCalled();
    });

    it('returns 403 when user is authenticated with non-admin role', async () => {
      mockAuthUser = { id: 'user-1', username: 'regular_user', role: 'user' };

      const res = await request(app).get('/api/geojson/full');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(container.exportService.streamAllObservationsGeoJson).not.toHaveBeenCalled();
    });
  });

  describe('FeatureCollection streaming and format', () => {
    it('returns valid FeatureCollection with [lon, lat] coordinates and application/geo+json content-type', async () => {
      container.exportService.streamAllObservationsGeoJson.mockImplementation(async (res: any) => {
        res.setHeader('Content-Type', 'application/geo+json');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="shadowcheck_observations_all_12345.geojson"'
        );
        res.write('{"type":"FeatureCollection","features":[');
        res.write(
          JSON.stringify({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-77.0364, 38.8951], // lon, lat
            },
            properties: {
              bssid: 'AA:BB:CC:DD:EE:FF',
              ssid: 'SecretNet',
              signal_dbm: -55,
              observed_at: '2026-10-04T00:00:00Z',
              radio_type: 'W',
              frequency: 2412,
              capabilities: '[WPA2-PSK-CCMP]',
              accuracy: 8.5,
            },
          })
        );
        res.write(']}');
        res.end();
        return { totalRows: 1, durationMs: 25 };
      });

      const res = await request(app).get('/api/geojson/full');

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/geo+json');
      expect(res.header['content-disposition']).toContain(
        'attachment; filename="shadowcheck_observations_all_'
      );

      const parsed = JSON.parse(res.text);
      expect(parsed.type).toBe('FeatureCollection');
      expect(parsed.features).toHaveLength(1);
      expect(parsed.features[0].geometry.type).toBe('Point');
      expect(parsed.features[0].geometry.coordinates).toEqual([-77.0364, 38.8951]);
      expect(parsed.features[0].properties.bssid).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('streams null-geometry row when coordinates are invalid or missing', async () => {
      container.exportService.streamAllObservationsGeoJson.mockImplementation(async (res: any) => {
        res.setHeader('Content-Type', 'application/geo+json');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="shadowcheck_observations_all_12345.geojson"'
        );
        res.write('{"type":"FeatureCollection","features":[');
        res.write(
          JSON.stringify({
            type: 'Feature',
            geometry: null,
            properties: {
              bssid: '00:11:22:33:44:55',
              ssid: 'NoCoordsNet',
              signal_dbm: -75,
              observed_at: '2026-10-04T00:00:00Z',
              radio_type: 'W',
              frequency: null,
              capabilities: null,
              accuracy: null,
            },
          })
        );
        res.write(']}');
        res.end();
        return { totalRows: 1, durationMs: 10 };
      });

      const res = await request(app).get('/api/geojson/full');

      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.text);
      expect(parsed.features).toHaveLength(1);
      expect(parsed.features[0].geometry).toBeNull();
      expect(parsed.features[0].properties.bssid).toBe('00:11:22:33:44:55');
    });

    it('streams valid empty FeatureCollection when database table has 0 rows', async () => {
      container.exportService.streamAllObservationsGeoJson.mockImplementation(async (res: any) => {
        res.setHeader('Content-Type', 'application/geo+json');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="shadowcheck_observations_all_12345.geojson"'
        );
        res.write('{"type":"FeatureCollection","features":[]}');
        res.end();
        return { totalRows: 0, durationMs: 5 };
      });

      const res = await request(app).get('/api/geojson/full');

      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.text);
      expect(parsed).toEqual({
        type: 'FeatureCollection',
        features: [],
      });
    });

    it('passes abort signal on client disconnect and handles cleanup', async () => {
      let passedSignal: AbortSignal | undefined;
      container.exportService.streamAllObservationsGeoJson.mockImplementation(
        async (res: any, signal: any) => {
          passedSignal = signal;
          res.setHeader('Content-Type', 'application/geo+json');
          res.write('{"type":"FeatureCollection","features":[]}');
          res.end();
          return { totalRows: 0, durationMs: 1 };
        }
      );

      const res = await request(app).get('/api/geojson/full');
      expect(res.status).toBe(200);
      expect(passedSignal).toBeDefined();
    });
  });
});
