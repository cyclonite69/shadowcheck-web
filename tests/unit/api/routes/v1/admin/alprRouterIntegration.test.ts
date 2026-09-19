import request from 'supertest';
import express from 'express';

const mockSyncAlprRegion = jest.fn();

jest.mock('../../../../../../server/src/services/admin/alprSyncService', () => {
  const actual = jest.requireActual('../../../../../../server/src/services/admin/alprSyncService');
  return {
    ...actual,
    syncAlprRegion: mockSyncAlprRegion,
  };
});

jest.mock('../../../../../../server/src/config/database', () => {
  const actual = jest.requireActual('../../../../../../server/src/config/database');
  return {
    ...actual,
    longRunningPool: {},
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

  describe('Authentication Gates on /api/admin/alpr/*', () => {
    it('rejects unauthenticated requests to GET /api/admin/alpr/regions with 401', async () => {
      mockUser = null;
      const res = await request(app).get('/api/admin/alpr/regions');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('rejects non-admin requests to GET /api/admin/alpr/regions with 403', async () => {
      mockUser = { username: 'analyst', role: 'user' };
      const res = await request(app).get('/api/admin/alpr/regions');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin privileges required');
    });

    it('rejects unauthenticated requests to POST /api/admin/alpr/sync with 401', async () => {
      mockUser = null;
      const res = await request(app).post('/api/admin/alpr/sync').send({ region: 'seattle' });
      expect(res.status).toBe(401);
    });
  });

  describe('Mounted Router Execution on /api/admin/alpr/*', () => {
    beforeEach(() => {
      mockUser = { username: 'admin', role: 'admin' };
    });

    it('successfully routes GET /api/admin/alpr/regions through real admin router', async () => {
      const res = await request(app).get('/api/admin/alpr/regions');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.regions)).toBe(true);
      expect(res.body.regions.length).toBe(30);
      expect(res.body.regions.some((r: any) => r.id === 'seattle')).toBe(true);
    });

    it('successfully routes POST /api/admin/alpr/sync through real admin router to service', async () => {
      const mockResult = {
        regionId: 'seattle',
        regionLabel: 'Seattle',
        upsertedCount: 120,
        prunedCount: 0,
        candidateCount: 120,
        durationMs: 450,
      };
      mockSyncAlprRegion.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/admin/alpr/sync')
        .send({ region: 'seattle', prune: false });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.upserts).toBe(120);
      expect(res.body.result).toEqual(mockResult);
      expect(mockSyncAlprRegion).toHaveBeenCalledWith(expect.anything(), 'seattle', false);
    });

    it('returns 409 when concurrent ALPR sync is active', async () => {
      mockSyncAlprRegion.mockRejectedValue(
        new Error('ALPR synchronization is already in progress')
      );

      const res = await request(app).post('/api/admin/alpr/sync').send({ region: 'seattle' });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('ALPR synchronization is already in progress');
    });

    it('rejects old /api/alpr/* non-admin paths with 404', async () => {
      const res = await request(app).get('/api/alpr/regions');
      expect(res.status).toBe(404);
    });
  });
});
