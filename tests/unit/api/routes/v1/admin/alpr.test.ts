import express from 'express';
import request from 'supertest';

const mockDispatchRegionSync = jest.fn();
const mockGetSyncStatus = jest.fn();
const mockGetRegions = jest.fn();

jest.mock('../../../../../../server/src/services/admin/alprSyncService', () => ({
  alprSyncService: {
    dispatchRegionSync: mockDispatchRegionSync,
    getSyncStatus: mockGetSyncStatus,
    getRegions: mockGetRegions,
  },
}));

jest.mock('../../../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/', require('../../../../../../server/src/api/routes/v1/admin/alpr'));

describe('admin ALPR routes (canonical paths)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /v1/admin/alpr/regions', () => {
    it('returns regions with durable sync outcome fields', async () => {
      mockGetRegions.mockResolvedValue([
        {
          id: 'seattle',
          name: 'Seattle',
          label: 'Seattle',
          state: 'WA',
          bbox: [-122.6, 47.3, -121.9, 47.8],
          syncStatus: 'success',
          lastSyncAt: '2026-09-19T15:09:36.825Z',
          lastChunkCount: 4,
          lastElementCount: 724,
          cooldownUntil: '2026-09-19T16:09:36.825Z',
        },
        {
          id: 'denver',
          name: 'Denver',
          label: 'Denver',
          state: 'CO',
          bbox: [-105.3, 39.5, -104.6, 40.0],
          syncStatus: 'idle',
          lastSyncAt: null,
          lastChunkCount: null,
          lastElementCount: null,
          cooldownUntil: null,
        },
      ]);

      const res = await request(app).get('/v1/admin/alpr/regions');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.regions).toHaveLength(2);
      expect(res.body.regions[0]).toMatchObject({
        id: 'seattle',
        syncStatus: 'success',
        lastElementCount: 724,
      });
      expect(mockGetRegions).toHaveBeenCalled();
    });
  });

  describe('POST /v1/admin/alpr/sync', () => {
    it('requires the canonical region payload field', async () => {
      const res = await request(app).post('/v1/admin/alpr/sync').send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ok: false,
        error: 'regionId is required',
      });
      expect(mockDispatchRegionSync).not.toHaveBeenCalled();
    });

    it('passes explicit region and prune flag', async () => {
      const _syncResult = {
        regionId: 'denver',
        regionLabel: 'Denver',
        upsertedCount: 15,
        prunedCount: 2,
        candidateCount: 15,
        durationMs: 800,
      };
      mockDispatchRegionSync.mockReturnValue({
        jobId: 'job-1',
        regionId: 'denver',
        status: 'dispatched',
      });

      const res = await request(app)
        .post('/v1/admin/alpr/sync')
        .send({ regionId: 'denver', prune: true });

      expect(res.status).toBe(202);
      expect(res.body).toEqual({
        success: true,
        jobId: 'job-1',
        regionId: 'denver',
        status: 'dispatched',
      });
      expect(mockDispatchRegionSync).toHaveBeenCalledWith('denver', true);
    });

    it('rejects non-boolean prune values', async () => {
      const res = await request(app)
        .post('/v1/admin/alpr/sync')
        .send({ regionId: 'seattle', prune: 'true' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ok: false,
        error: 'prune must be a boolean',
      });
      expect(mockDispatchRegionSync).not.toHaveBeenCalled();
    });

    it('returns 400 when region id is unknown', async () => {
      mockDispatchRegionSync.mockImplementation(() => {
        throw new Error("Unknown ALPR region id: 'invalid_region'");
      });

      const res = await request(app)
        .post('/v1/admin/alpr/sync')
        .send({ regionId: 'invalid_region' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: "Unknown ALPR region id: 'invalid_region'",
      });
    });

    it('returns 409 when sync is already in progress (advisory lock held)', async () => {
      mockDispatchRegionSync.mockReturnValue({
        jobId: 'existing-job',
        regionId: 'seattle',
        status: 'already_running',
      });

      const res = await request(app).post('/v1/admin/alpr/sync').send({ regionId: 'seattle' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false,
        jobId: 'existing-job',
        regionId: 'seattle',
        status: 'already_running',
      });
    });

    it('returns active and recent jobs from the status endpoint', async () => {
      mockGetSyncStatus.mockReturnValue([]);
      const res = await request(app).get('/v1/admin/alpr/sync/status?regionId=seattle');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, jobs: [] });
      expect(mockGetSyncStatus).toHaveBeenCalledWith('seattle');
    });
  });
});
