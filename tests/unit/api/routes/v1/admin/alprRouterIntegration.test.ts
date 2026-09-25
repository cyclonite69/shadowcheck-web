import request from 'supertest';
import express from 'express';

const mockDispatchRegionSync = jest.fn();
const mockGetSyncStatus = jest.fn();
const mockGetRegions = jest.fn();

jest.mock('../../../../../../server/src/services/admin/alprSyncService', () => {
  const actual = jest.requireActual('../../../../../../server/src/services/admin/alprSyncService');
  return {
    ...actual,
    alprSyncService: {
      ...actual.alprSyncService,
      dispatchRegionSync: mockDispatchRegionSync,
      getSyncStatus: mockGetSyncStatus,
      getRegions: mockGetRegions,
    },
  };
});

jest.mock('../../../../../../server/src/config/container', () => ({
  adminNetworkTagsService: {
    checkDuplicateObservations: jest.fn(),
    getNetworkSummary: jest.fn(),
  },
  mlScoringService: {},
  backupService: {},
  adminDbStatsService: {},
  adminMaintenanceService: {},
  adminNetworkMediaService: {},
  adminUsersService: {},
  awsService: {},
  backgroundJobsService: {},
  geocodingCacheService: {},
  pgadminService: {},
  settingsAdminService: {},
  adminSiblingService: {},
  adminImportHistoryService: {},
  adminOrphanNetworksService: {},
  v2Service: {},
  miscService: { getDataQualityMetrics: jest.fn() },
  dataQualityFilters: { DATA_QUALITY_FILTERS: { all: () => '' } },
}));

jest.mock('../../../../../../server/src/logging/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

let mockUser: { username: string; role: string } | null = null;

jest.mock('../../../../../../server/src/middleware/authMiddleware', () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    if (!mockUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (mockUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    req.user = mockUser;
    next();
  },
  extractToken: (req: any, _res: any, next: any) => next(),
}));

const adminRouter = require('../../../../../../server/src/api/routes/v1/admin');

const app = express();
app.use(express.json());
app.use('/api', adminRouter);

describe('ALPR Routes Real Router Mounting & Authentication Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  describe('Authentication Gates on /api/v1/admin/alpr/*', () => {
    it('rejects unauthenticated requests to GET /api/v1/admin/alpr/regions with 401', async () => {
      mockUser = null;
      const res = await request(app).get('/api/v1/admin/alpr/regions');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('rejects non-admin requests to GET /api/v1/admin/alpr/regions with 403', async () => {
      mockUser = { username: 'analyst', role: 'user' };
      const res = await request(app).get('/api/v1/admin/alpr/regions');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin privileges required');
    });

    it('rejects unauthenticated requests to POST /api/v1/admin/alpr/sync with 401', async () => {
      mockUser = null;
      const res = await request(app).post('/api/v1/admin/alpr/sync').send({ regionId: 'seattle' });
      expect(res.status).toBe(401);
    });
  });

  describe('Mounted Router Execution on /api/v1/admin/alpr/*', () => {
    beforeEach(() => {
      mockUser = { username: 'admin', role: 'admin' };
    });

    it('successfully routes GET /api/v1/admin/alpr/regions through real admin router', async () => {
      mockGetRegions.mockResolvedValue(
        Array.from({ length: 30 }, (_, i) => ({
          id: i === 0 ? 'seattle' : `region-${i}`,
          name: i === 0 ? 'Seattle' : `Region ${i}`,
          label: i === 0 ? 'Seattle' : `Region ${i}`,
          state: 'XX',
          bbox: [0, 0, 1, 1],
          syncStatus: 'idle',
          lastSyncAt: null,
          lastChunkCount: null,
          lastElementCount: null,
          cooldownUntil: null,
        }))
      );

      const res = await request(app).get('/api/v1/admin/alpr/regions');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.regions)).toBe(true);
      expect(res.body.regions.length).toBe(30);
      expect(res.body.regions.some((r: any) => r.id === 'seattle')).toBe(true);
      expect(res.body.regions[0]).toHaveProperty('syncStatus');
    });

    it('successfully routes POST /api/v1/admin/alpr/sync through real admin router to service', async () => {
      mockDispatchRegionSync.mockReturnValue({
        jobId: 'job-1',
        regionId: 'seattle',
        status: 'dispatched',
      });

      const res = await request(app)
        .post('/api/v1/admin/alpr/sync')
        .send({ regionId: 'seattle', prune: false });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('dispatched');
      expect(mockDispatchRegionSync).toHaveBeenCalledWith('seattle', false);
    });

    it('returns 409 when concurrent ALPR sync is active', async () => {
      mockDispatchRegionSync.mockReturnValue({
        jobId: 'existing-job',
        regionId: 'seattle',
        status: 'already_running',
      });

      const res = await request(app).post('/api/v1/admin/alpr/sync').send({ regionId: 'seattle' });

      expect(res.status).toBe(409);
      expect(res.body.status).toBe('already_running');
    });

    it('rejects old /api/alpr/* non-admin paths with 404', async () => {
      const res = await request(app).get('/api/alpr/regions');
      expect(res.status).toBe(404);
    });
  });
});
