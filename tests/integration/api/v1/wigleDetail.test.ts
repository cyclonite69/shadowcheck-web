import request from 'supertest';
import express from 'express';

const mockFetchOrImportDetail = jest.fn();
const mockImportDetailFromJson = jest.fn();

// Mock container
const mockContainer = {
  wigleService: {
    getWigleDetail: jest.fn(),
    getRecentWigleDetailImport: jest.fn(),
    importWigleV3NetworkDetail: jest.fn(),
    importWigleV3Observation: jest.fn(),
    getWigleObservations: jest.fn(),
  },
};

// Mock services
const mockWigleEnrichmentService = {
  getPendingEnrichmentCount: jest.fn(),
  getEnrichmentCatalog: jest.fn(),
  startBatchEnrichment: jest.fn(),
  resumeEnrichment: jest.fn(),
};

// Mock dependencies
jest.mock('../../../../server/src/config/container', () => mockContainer);
jest.mock(
  '../../../../server/src/services/wigleEnrichmentService',
  () => mockWigleEnrichmentService
);

jest.mock('../../../../server/src/services/wigleDetailService', () => ({
  fetchOrImportDetail: (...args: any[]) => mockFetchOrImportDetail(...args),
  importDetailFromJson: (...args: any[]) => mockImportDetailFromJson(...args),
}));

jest.mock('../../../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn((key) => {
      if (key === 'wigle_api_name') return 'test_user';
      if (key === 'wigle_api_token') return 'test_token';
      return null;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'wigle_api_name') return 'test_user';
      if (key === 'wigle_api_token') return 'test_token';
      // Integration router tests shouldn't depend on DB secrets.
      return 'test';
    }),
  },
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../../server/src/middleware/authMiddleware', () => ({
  requireAdmin: (req: any, res: any, next: any) => next(),
}));

// Mock express-fileupload if needed, but we can just mock the request object in supertest if it supports it
// Or we can mock the router's dependency on it if it had one, but it seems it uses req.files directly.

// Import router after mocks
const detailRouter = require('../../../../server/src/api/routes/v1/wigle/detail').default;
const enrichmentRouter = require('../../../../server/src/api/routes/v1/wigle/enrichment').default;

const app = express();
app.use(express.json());
app.use('/api/v1/wigle', detailRouter);
app.use('/api/v1/wigle', enrichmentRouter);

describe('WiGLE Detail API v1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /detail/:netid', () => {
    it('should return cached results if available and not importing', async () => {
      mockFetchOrImportDetail.mockResolvedValueOnce({
        ok: true,
        data: { networkId: '00:11:22:33:44:55' },
        imported: false,
        cached: true,
        importedObservations: 0,
        totalObservations: 0,
        attemptedObservations: 0,
        failedObservations: 0,
      });

      const res = await request(app).post('/api/v1/wigle/detail/00:11:22:33:44:55').send({
        import: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.cached).toBe(true);
      expect(res.body.data.networkId).toBe('00:11:22:33:44:55');
      expect(mockFetchOrImportDetail).toHaveBeenCalledWith('00:11:22:33:44:55', 'wifi', false);
    });

    it('should fetch from WiGLE API and import if requested', async () => {
      mockFetchOrImportDetail.mockResolvedValueOnce({
        ok: true,
        data: { networkId: '00:11:22:33:44:55' },
        imported: true,
        cached: false,
        importedObservations: 1,
        totalObservations: 1,
        attemptedObservations: 1,
        failedObservations: 0,
      });

      const res = await request(app).post('/api/v1/wigle/detail/00:11:22:33:44:55').send({
        import: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.imported).toBe(true);
      expect(mockFetchOrImportDetail).toHaveBeenCalledWith('00:11:22:33:44:55', 'wifi', true);
    });
  });

  describe('Enrichment Routes', () => {
    it('GET /enrichment/stats should return pending count', async () => {
      mockWigleEnrichmentService.getPendingEnrichmentCount.mockResolvedValue(42);

      const res = await request(app).get('/api/v1/wigle/enrichment/stats');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.pendingCount).toBe(42);
    });

    it('POST /enrichment/start should start enrichment', async () => {
      mockWigleEnrichmentService.startBatchEnrichment.mockResolvedValue({
        id: 1,
        status: 'running',
      });

      const res = await request(app)
        .post('/api/v1/wigle/enrichment/start')
        .send({
          bssids: ['00:11:22:33:44:55'],
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.run.id).toBe(1);
    });
  });
});
