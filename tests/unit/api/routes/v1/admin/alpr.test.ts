import express from 'express';
import request from 'supertest';

const mockDispatchRegionSync = jest.fn();
const mockDispatchCustomBboxSync = jest.fn();
const mockGetSyncStatus = jest.fn();
const mockGetRegions = jest.fn();

jest.mock('../../../../../../server/src/services/admin/alprSyncService', () => ({
  alprSyncService: {
    dispatchRegionSync: mockDispatchRegionSync,
    dispatchCustomBboxSync: mockDispatchCustomBboxSync,
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

    describe('custom bbox sync endpoint handling', () => {
      const geneseeBbox = [-83.95, 42.75, -83.4, 43.25];

      it('dispatches valid custom bbox and returns 202', async () => {
        mockDispatchCustomBboxSync.mockReturnValue({
          jobId: 'custom-job-1',
          regionId: 'custom',
          status: 'dispatched',
        });

        const res = await request(app)
          .post('/v1/admin/alpr/sync')
          .send({ bbox: geneseeBbox, prune: true });

        expect(res.status).toBe(202);
        expect(res.body).toEqual({
          success: true,
          jobId: 'custom-job-1',
          regionId: 'custom',
          status: 'dispatched',
        });
        expect(mockDispatchCustomBboxSync).toHaveBeenCalledWith(
          {
            west: -83.95,
            south: 42.75,
            east: -83.4,
            north: 43.25,
          },
          true
        );
      });

      it('accepts regionId === "custom" with bbox payload', async () => {
        mockDispatchCustomBboxSync.mockReturnValue({
          jobId: 'custom-job-2',
          regionId: 'custom',
          status: 'dispatched',
        });

        const res = await request(app)
          .post('/v1/admin/alpr/sync')
          .send({ regionId: 'custom', bbox: geneseeBbox });

        expect(res.status).toBe(202);
        expect(mockDispatchCustomBboxSync).toHaveBeenCalledWith(
          {
            west: -83.95,
            south: 42.75,
            east: -83.4,
            north: 43.25,
          },
          false
        );
      });

      it('returns 400 when regionId is "custom" but bbox is missing', async () => {
        const res = await request(app).post('/v1/admin/alpr/sync').send({ regionId: 'custom' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          ok: false,
          error: 'bbox is required for custom region sync',
        });
        expect(mockDispatchCustomBboxSync).not.toHaveBeenCalled();
      });

      it('returns 400 when bbox contains non-finite numbers', async () => {
        const res = await request(app)
          .post('/v1/admin/alpr/sync')
          .send({ bbox: ['invalid', 42.75, -83.4, 43.25] });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain("Bounding box coordinate 'west' must be a finite number");
      });

      it('returns 400 when bbox is degenerate', async () => {
        const res = await request(app)
          .post('/v1/admin/alpr/sync')
          .send({ bbox: [-83.95, 42.75, -83.95, 43.25] });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Degenerate bounding box');
      });

      it('returns 400 when bbox area exceeds ceiling', async () => {
        const res = await request(app)
          .post('/v1/admin/alpr/sync')
          .send({ bbox: [-84.6, 41.0, -83.0, 42.5] }); // 1.6 lon * 1.5 lat = 2.40 deg²

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('exceeds maximum allowed ceiling of 2.25 deg²');
      });

      it('returns 400 when bbox latitude span exceeds ceiling', async () => {
        const res = await request(app)
          .post('/v1/admin/alpr/sync')
          .send({ bbox: [-83.9, 41.0, -83.4, 42.6] }); // 1.6 lat > 1.5

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('exceeds maximum allowed span of 1.5°');
      });

      it('returns 400 when bbox longitude span exceeds ceiling', async () => {
        const res = await request(app)
          .post('/v1/admin/alpr/sync')
          .send({ bbox: [-85.0, 42.0, -83.0, 42.5] }); // 2.0 lon > 1.8

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('exceeds maximum allowed span of 1.8°');
      });

      it('returns 409 when custom bbox sync is already in progress', async () => {
        mockDispatchCustomBboxSync.mockReturnValue({
          jobId: 'existing-custom',
          regionId: 'custom',
          status: 'already_running',
        });

        const res = await request(app).post('/v1/admin/alpr/sync').send({ bbox: geneseeBbox });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({
          success: false,
          jobId: 'existing-custom',
          regionId: 'custom',
          status: 'already_running',
        });
      });
    });
  });
});
