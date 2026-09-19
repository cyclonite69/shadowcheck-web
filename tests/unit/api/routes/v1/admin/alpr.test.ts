import express from 'express';
import request from 'supertest';

const mockSyncAlprRegion = jest.fn();

jest.mock('../../../../../../server/src/services/admin/alprSyncService', () => ({
  syncAlprRegion: mockSyncAlprRegion,
  ALPR_REGIONS: [
    { id: 'seattle', label: 'Seattle', state: 'WA', bbox: [-122.6, 47.3, -121.9, 47.8] },
    { id: 'denver', label: 'Denver', state: 'CO', bbox: [-105.3, 39.5, -104.6, 40.0] },
  ],
}));

jest.mock('../../../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../../../../server/src/config/database', () => ({
  longRunningPool: {},
}));

const app = express();
app.use(express.json());
app.use('/', require('../../../../../../server/src/api/routes/v1/admin/alpr'));

describe('admin ALPR routes (canonical paths)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /admin/alpr/regions', () => {
    it('returns the list of ALPR regions on /admin/alpr/regions', async () => {
      const res = await request(app).get('/admin/alpr/regions');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.regions).toEqual([
        {
          id: 'seattle',
          name: 'Seattle',
          label: 'Seattle',
          state: 'WA',
          bbox: [-122.6, 47.3, -121.9, 47.8],
        },
        {
          id: 'denver',
          name: 'Denver',
          label: 'Denver',
          state: 'CO',
          bbox: [-105.3, 39.5, -104.6, 40.0],
        },
      ]);
    });
  });

  describe('POST /admin/alpr/sync', () => {
    it('requires the canonical region payload field', async () => {
      const res = await request(app).post('/admin/alpr/sync').send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ok: false,
        error: 'Region identifier is required',
      });
      expect(mockSyncAlprRegion).not.toHaveBeenCalled();
    });

    it('passes explicit region and prune flag', async () => {
      const syncResult = {
        regionId: 'denver',
        regionLabel: 'Denver',
        upsertedCount: 15,
        prunedCount: 2,
        candidateCount: 15,
        durationMs: 800,
      };
      mockSyncAlprRegion.mockResolvedValue(syncResult);

      const res = await request(app)
        .post('/admin/alpr/sync')
        .send({ region: 'denver', prune: true });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toEqual(syncResult);
      expect(mockSyncAlprRegion).toHaveBeenCalledWith(expect.anything(), 'denver', true);
    });

    it('rejects non-boolean prune values', async () => {
      const res = await request(app)
        .post('/admin/alpr/sync')
        .send({ region: 'seattle', prune: 'true' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ok: false,
        error: 'prune must be a boolean',
      });
      expect(mockSyncAlprRegion).not.toHaveBeenCalled();
    });

    it('returns 400 when region id is unknown', async () => {
      mockSyncAlprRegion.mockRejectedValue(new Error("Unknown ALPR region id: 'invalid_region'"));

      const res = await request(app).post('/admin/alpr/sync').send({ region: 'invalid_region' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ok: false,
        error: "Unknown ALPR region id: 'invalid_region'",
      });
    });

    it('returns 409 when sync is already in progress (advisory lock held)', async () => {
      mockSyncAlprRegion.mockRejectedValue(
        new Error('ALPR synchronization is already in progress')
      );

      const res = await request(app).post('/admin/alpr/sync').send({ region: 'seattle' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        ok: false,
        error: 'ALPR synchronization is already in progress',
      });
    });

    it('returns 502 when Overpass API network error occurs', async () => {
      mockSyncAlprRegion.mockRejectedValue(new Error('Overpass fetch failed with ETIMEDOUT'));

      const res = await request(app).post('/admin/alpr/sync').send({ region: 'seattle' });

      expect(res.status).toBe(502);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('ETIMEDOUT');
    });

    it('returns 500 when an unexpected internal error occurs', async () => {
      mockSyncAlprRegion.mockRejectedValue(new Error('Database connection crashed'));

      const res = await request(app).post('/admin/alpr/sync').send({ region: 'seattle' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        ok: false,
        error: 'Database connection crashed',
      });
    });
  });
});
