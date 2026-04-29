import request from 'supertest';
import express from 'express';

// Mock container
const mockContainer = {
  wigleService: {
    importWigleV2SearchResult: jest.fn(),
  },
  wigleImportRunService: {
    validateImportQuery: jest.fn(),
    startImportRun: jest.fn(),
    resumeImportRun: jest.fn(),
    resumeLatestImportRun: jest.fn(),
    listImportRuns: jest.fn(),
    getImportCompletenessReport: jest.fn(),
    getImportRun: jest.fn(),
    getLatestResumableImportRun: jest.fn(),
    pauseImportRun: jest.fn(),
    cancelImportRun: jest.fn(),
    bulkDeleteGlobalCancelledCluster: jest.fn(),
  },
};

// Mock dependencies
jest.mock('../../../../server/src/config/container', () => mockContainer);

jest.mock('../../../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn((key) => {
      if (key === 'wigle_api_name') return 'test_user';
      if (key === 'wigle_api_token') return 'test_token';
      return null;
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

// Mock database config (used for saved-ssid-terms)
jest.mock('../../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

// Import router after mocks
const searchRouter = require('../../../../server/src/api/routes/v1/wigle/search').default;

const app = express();
app.use(express.json());
app.use('/api/v1/wigle', searchRouter);

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('WiGLE Search API v1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('../../../../server/src/services/wigleSearchCache').resetSearchCache();
    require('../../../../server/src/services/wigleRequestLedger').resetQuotaLedger();
    const secretsManager = require('../../../../server/src/services/secretsManager').default;
    secretsManager.get.mockImplementation((key: string) => {
      if (key === 'wigle_api_name') return 'test_user';
      if (key === 'wigle_api_token') return 'test_token';
      return null;
    });
  });

  describe('ALL /search-api', () => {
    it('should return results from WiGLE API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          totalResults: 100,
          results: [{ netid: '00:11:22:33:44:55', ssid: 'TestNet' }],
        }),
      });

      const res = await request(app).get('/api/v1/wigle/search-api?ssid=TestNet');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].ssid).toBe('TestNet');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should import results when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          totalResults: 100,
          results: [{ netid: '00:11:22:33:44:55', ssid: 'TestNet' }],
        }),
      });

      mockContainer.wigleService.importWigleV2SearchResult.mockResolvedValue(1);

      const res = await request(app).post('/api/v1/wigle/search-api?import=true').send({
        ssid: 'TestNet',
      });

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(true);
      expect(res.body.importedCount).toBe(1);
      expect(mockContainer.wigleService.importWigleV2SearchResult).toHaveBeenCalled();
    });

    it('should return 503 if API credentials are missing', async () => {
      const secretsManager = require('../../../../server/src/services/secretsManager').default;
      secretsManager.get.mockReturnValue(null);

      const res = await request(app).get('/api/v1/wigle/search-api?ssid=TestNet');

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('WiGLE API credentials not configured');
    });
  });

  describe('POST /search-api/import-all', () => {
    it('should start an import run', async () => {
      mockContainer.wigleImportRunService.validateImportQuery.mockReturnValue(null);
      mockContainer.wigleImportRunService.startImportRun.mockResolvedValue({
        id: 123,
        status: 'running',
        apiTotalResults: 100,
        rowsReturned: 0,
        rowsInserted: 0,
        pagesFetched: 0,
        totalPages: 10,
      });

      const res = await request(app).post('/api/v1/wigle/search-api/import-all').send({
        ssid: 'TestNet',
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.run.id).toBe(123);
      expect(mockContainer.wigleImportRunService.startImportRun).toHaveBeenCalled();
    });
  });

  describe('GET /search-api/import-runs', () => {
    it('should list import runs', async () => {
      mockContainer.wigleImportRunService.listImportRuns.mockResolvedValue([
        { id: 1, status: 'completed' },
      ]);

      const res = await request(app).get('/api/v1/wigle/search-api/import-runs');

      expect(res.status).toBe(200);
      expect(res.body.runs).toHaveLength(1);
      expect(mockContainer.wigleImportRunService.listImportRuns).toHaveBeenCalled();
    });
  });

  describe('GET /search-api/saved-ssid-terms', () => {
    it('should list saved SSID terms', async () => {
      const db = require('../../../../server/src/config/database');
      db.query.mockResolvedValue({
        rows: [{ id: 1, term: 'test-term' }],
      });

      const res = await request(app).get('/api/v1/wigle/search-api/saved-ssid-terms');

      expect(res.status).toBe(200);
      expect(res.body.terms).toHaveLength(1);
      expect(res.body.terms[0].term).toBe('test-term');
    });
  });

  describe('POST /search-api/saved-ssid-terms', () => {
    it('should save a new SSID term', async () => {
      const db = require('../../../../server/src/config/database');
      db.query.mockResolvedValue({
        rows: [{ id: 1, term: 'new-term', last_used_at: new Date().toISOString() }],
      });

      const res = await request(app).post('/api/v1/wigle/search-api/saved-ssid-terms').send({
        term: 'new-term',
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.term.term).toBe('new-term');
    });

    it('should reject short terms', async () => {
      const res = await request(app).post('/api/v1/wigle/search-api/saved-ssid-terms').send({
        term: 'ab',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Term too short');
    });
  });

  describe('GET /search-api/import-runs/:id', () => {
    it('should get a single import run', async () => {
      mockContainer.wigleImportRunService.getImportRun.mockResolvedValue({
        id: 123,
        status: 'completed',
      });

      const res = await request(app).get('/api/v1/wigle/search-api/import-runs/123');

      expect(res.status).toBe(200);
      expect(res.body.run.id).toBe(123);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app).get('/api/v1/wigle/search-api/import-runs/abc');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid run id');
    });
  });
});
