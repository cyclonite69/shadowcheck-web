import request from 'supertest';
import express from 'express';

// Mock the container with all services used by admin sub-routes
jest.mock('../../../../server/src/config/container', () => ({
  adminNetworkTagsService: {
    checkDuplicateObservations: jest.fn(),
    getNetworkSummary: jest.fn(),
  },
  mlScoringService: {
    scoreAllNetworks: jest.fn(),
  },
  backupService: {
    runPostgresBackup: jest.fn(),
    listS3Backups: jest.fn(),
    deleteS3Backup: jest.fn(),
  },
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
  miscService: {
    getDataQualityMetrics: jest.fn(),
  },
  dataQualityFilters: {
    DATA_QUALITY_FILTERS: {
      temporal_clusters: '',
      extreme_signals: '',
      duplicate_coords: '',
      all: () => '',
    },
  },
}));

// Mock auth middleware
jest.mock('../../../../server/src/middleware/authMiddleware', () => ({
  requireAdmin: (req: any, res: any, next: any) => next(),
  extractToken: (req: any, res: any, next: any) => next(),
}));

const container = require('../../../../server/src/config/container');
const adminRouter = require('../../../../server/src/api/routes/v1/admin');

const app = express();
app.use(express.json());
app.use('/api/v1', adminRouter);

describe('Admin API Integration Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    container.adminNetworkTagsService.checkDuplicateObservations.mockResolvedValue({
      total_observations: 5,
    });
    container.adminNetworkTagsService.getNetworkSummary.mockResolvedValue({
      bssid: 'AA:BB:CC:DD:EE:FF',
      name: 'Test Network',
    });
  });

  describe('GET /api/v1/observations/check-duplicates/:bssid', () => {
    it('should return 400 if BSSID is invalid', async () => {
      // Use a BSSID with characters that fail the validation regex
      const res = await request(app).get(
        '/api/v1/observations/check-duplicates/invalid!bssid?time=' + new Date().toISOString()
      );
      expect(res.status).toBe(400);
    });

    it('should return 200 and duplicate data for valid BSSID', async () => {
      const res = await request(app).get(
        '/api/v1/observations/check-duplicates/AA:BB:CC:DD:EE:FF?time=' + new Date().toISOString()
      );
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.total_observations).toBe(5);
    });
  });

  describe('GET /api/v1/admin/network-summary/:bssid', () => {
    it('should return 200 and network summary', async () => {
      const res = await request(app).get('/api/v1/admin/network-summary/AA:BB:CC:DD:EE:FF');
      expect(res.status).toBe(200);
      expect(res.body.network.bssid).toBe('AA:BB:CC:DD:EE:FF');
    });
  });
});
