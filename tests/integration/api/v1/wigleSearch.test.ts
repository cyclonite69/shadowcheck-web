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
    deleteImportRun: jest.fn(),
    getLatestResumableImportRun: jest.fn(),
    pauseImportRun: jest.fn(),
    cancelImportRun: jest.fn(),
    bulkDeleteGlobalCancelledCluster: jest.fn(),
  },
  wigleBluetoothImportService: {
    validateBtImportQuery: jest.fn(),
    startBluetoothImportRun: jest.fn(),
    resumeBluetoothImportRun: jest.fn(),
  },
};

// Mock dependencies
jest.mock('../../../../server/src/config/container', () => mockContainer);

jest.mock('../../../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn((key) => {
      if (key === 'wigle_api_name') {
        return 'test_user';
      }
      if (key === 'wigle_api_token') {
        return 'test_token';
      }
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
app.use('/api/wigle', searchRouter);

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
      if (key === 'wigle_api_name') {
        return 'test_user';
      }
      if (key === 'wigle_api_token') {
        return 'test_token';
      }
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

      const res = await request(app).get('/api/wigle/search-api?ssid=TestNet');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].ssid).toBe('TestNet');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should import results when requested', async () => {
      const db = require('../../../../server/src/config/database');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          totalResults: 100,
          results: [{ netid: '00:11:22:33:44:55', ssid: 'TestNet' }],
        }),
      });

      mockContainer.wigleService.importWigleV2SearchResult.mockResolvedValue(1);
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/wigle/search-api?import=true').send({
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

      const res = await request(app).get('/api/wigle/search-api?ssid=TestNet');

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('WiGLE API credentials not configured');
    });

    it('should normalize padded lowercase country "  us  " to "US" at route level', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          totalResults: 10,
          results: [],
        }),
      });

      const res = await request(app).get('/api/wigle/search-api?ssid=fbi&country=%20%20us%20%20');

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('country=US');
      expect(calledUrl).toContain('ssidlike=fbi');
    });

    it('should keep omitted country absent in URLSearchParams', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          totalResults: 10,
          results: [],
        }),
      });

      const res = await request(app).get('/api/wigle/search-api?ssid=fbi');

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).not.toContain('country=');
      expect(calledUrl).toContain('ssidlike=fbi');
    });

    it('should keep existing "US" country code unchanged', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          totalResults: 10,
          results: [],
        }),
      });

      const res = await request(app).get('/api/wigle/search-api?ssid=fbi&country=US');

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('country=US');
    });

    it('should capitalize lowercase valid country codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          totalResults: 10,
          results: [],
        }),
      });

      const res = await request(app).get('/api/wigle/search-api?ssid=fbi&country=us');

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('country=US');
    });

    it('should return 400 Bad Request for country names like "United States" under the ISO contract', async () => {
      const res = await request(app).get('/api/wigle/search-api?ssid=fbi&country=United%20States');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('failed validation');
    });

    it('should return 400 Bad Request for invalid country codes like "USA"', async () => {
      const res = await request(app).get('/api/wigle/search-api?ssid=fbi&country=USA');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('failed validation');
    });

    it('should leave unrelated search fields unchanged', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          totalResults: 10,
          results: [],
        }),
      });

      const res = await request(app).get(
        '/api/wigle/search-api?ssid=fbi&region=IL&city=Chicago&country=us'
      );

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('ssidlike=fbi');
      expect(calledUrl).toContain('region=IL');
      expect(calledUrl).toContain('city=Chicago');
      expect(calledUrl).toContain('country=US');
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

      const res = await request(app).post('/api/wigle/search-api/import-all').send({
        ssid: 'TestNet',
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.run.id).toBe(123);
      expect(mockContainer.wigleImportRunService.startImportRun).toHaveBeenCalled();
    });

    it('validates import queries before starting', async () => {
      mockContainer.wigleImportRunService.validateImportQuery.mockReturnValue('invalid query');

      const res = await request(app).post('/api/wigle/search-api/import-all').send({
        ssid: 'TestNet',
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ ok: false, error: 'invalid query' });
      expect(mockContainer.wigleImportRunService.startImportRun).not.toHaveBeenCalled();
    });

    it('resumes a specific import run', async () => {
      mockContainer.wigleImportRunService.validateImportQuery.mockReturnValue(null);
      mockContainer.wigleImportRunService.resumeImportRun.mockResolvedValue({
        id: 44,
        status: 'running',
      });

      const res = await request(app).post('/api/wigle/search-api/import-all').send({ runId: '44' });

      expect(res.status).toBe(200);
      expect(mockContainer.wigleImportRunService.resumeImportRun).toHaveBeenCalledWith(44);
    });

    it('resumes the latest matching import run', async () => {
      mockContainer.wigleImportRunService.validateImportQuery.mockReturnValue(null);
      mockContainer.wigleImportRunService.resumeLatestImportRun.mockResolvedValue({
        id: 45,
        status: 'running',
      });

      const res = await request(app)
        .post('/api/wigle/search-api/import-all')
        .send({ resumeLatest: true, state: 'NY' });

      expect(res.status).toBe(200);
      expect(mockContainer.wigleImportRunService.resumeLatestImportRun).toHaveBeenCalledWith({
        resumeLatest: true,
        state: 'NY',
      });
    });

    it('returns structured forbidden errors', async () => {
      mockContainer.wigleImportRunService.validateImportQuery.mockReturnValue(null);
      mockContainer.wigleImportRunService.startImportRun.mockRejectedValue(
        Object.assign(new Error('quota exhausted'), { status: 403, code: 'QUOTA' })
      );

      const res = await request(app).post('/api/wigle/search-api/import-all').send({
        ssid: 'TestNet',
      });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ ok: false, error: 'quota exhausted', code: 'QUOTA' });
    });
  });

  describe('GET /search-api/import-runs', () => {
    it('should list import runs', async () => {
      mockContainer.wigleImportRunService.listImportRuns.mockResolvedValue({
        data: [{ id: 1, status: 'completed' }],
        total: 1,
      });

      const res = await request(app).get('/api/wigle/search-api/import-runs');

      expect(res.status).toBe(200);
      expect(res.body.runs).toHaveLength(1);
      expect(mockContainer.wigleImportRunService.listImportRuns).toHaveBeenCalled();
    });

    it('passes pagination, filters, and sorting to the service', async () => {
      mockContainer.wigleImportRunService.listImportRuns.mockResolvedValue({
        data: [{ id: 2 }, { id: 3 }],
        total: 10,
      });

      const res = await request(app).get('/api/wigle/search-api/import-runs').query({
        page: '2',
        limit: '2',
        status: 'failed',
        state: 'ny',
        searchTerm: 'fleet',
        incompleteOnly: 'true',
        sortBy: 'status,started_at',
        sortDir: 'asc,desc',
      });

      expect(res.status).toBe(200);
      expect(mockContainer.wigleImportRunService.listImportRuns).toHaveBeenCalledWith({
        limit: 2,
        offset: 2,
        status: 'failed',
        state: 'ny',
        searchTerm: 'fleet',
        incompleteOnly: true,
        sortBy: 'status,started_at',
        sortDir: 'asc,desc',
      });
      expect(res.body.hasMore).toBe(true);
    });
  });

  describe('GET /search-api/import-runs/completeness/summary', () => {
    it('returns a filtered completeness report', async () => {
      mockContainer.wigleImportRunService.getImportCompletenessReport.mockResolvedValue({
        storedCount: 12,
      });

      const res = await request(app)
        .get('/api/wigle/search-api/import-runs/completeness/summary')
        .query({ searchTerm: 'fleet', state: 'ny' });

      expect(res.status).toBe(200);
      expect(mockContainer.wigleImportRunService.getImportCompletenessReport).toHaveBeenCalledWith({
        searchTerm: 'fleet',
        state: 'NY',
      });
      expect(res.body.report).toEqual({ storedCount: 12 });
    });
  });

  describe('GET /search-api/saved-ssid-terms', () => {
    it('should list saved SSID terms', async () => {
      const db = require('../../../../server/src/config/database');
      db.query.mockResolvedValue({
        rows: [{ id: 1, term: 'test-term' }],
      });

      const res = await request(app).get('/api/wigle/search-api/saved-ssid-terms');

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

      const res = await request(app).post('/api/wigle/search-api/saved-ssid-terms').send({
        term: 'new-term',
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.term.term).toBe('new-term');
    });

    it('should reject short terms', async () => {
      const res = await request(app).post('/api/wigle/search-api/saved-ssid-terms').send({
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

      const res = await request(app).get('/api/wigle/search-api/import-runs/123');

      expect(res.status).toBe(200);
      expect(res.body.run.id).toBe(123);
    });

    it('should return 400 for invalid id', async () => {
      const res = await request(app).get('/api/wigle/search-api/import-runs/abc');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid run id');
    });
  });

  describe('DELETE /search-api/import-runs/:id', () => {
    it('deletes a completed import run', async () => {
      mockContainer.wigleImportRunService.deleteImportRun.mockResolvedValue(true);

      const res = await request(app).delete('/api/wigle/search-api/import-runs/123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, deleted: 123 });
    });

    it('rejects invalid ids and missing runs', async () => {
      const invalid = await request(app).delete('/api/wigle/search-api/import-runs/bad');
      expect(invalid.status).toBe(400);

      mockContainer.wigleImportRunService.deleteImportRun.mockResolvedValue(false);
      const missing = await request(app).delete('/api/wigle/search-api/import-runs/123');
      expect(missing.status).toBe(404);
    });
  });

  describe('import run lifecycle routes', () => {
    beforeEach(() => {
      mockContainer.wigleImportRunService.validateImportQuery.mockReturnValue(null);
    });

    it('resumes the latest matching run', async () => {
      mockContainer.wigleImportRunService.resumeLatestImportRun.mockResolvedValue({
        id: 9,
        status: 'running',
      });

      const res = await request(app)
        .post('/api/wigle/search-api/import-runs/resume-latest')
        .send({ state: 'CA' });

      expect(res.status).toBe(200);
      expect(mockContainer.wigleImportRunService.resumeLatestImportRun).toHaveBeenCalledWith({
        state: 'CA',
      });
    });

    it('validates latest resume queries and reports forbidden responses', async () => {
      mockContainer.wigleImportRunService.validateImportQuery.mockReturnValueOnce('invalid');
      const invalid = await request(app).post('/api/wigle/search-api/import-runs/resume-latest');
      expect(invalid.status).toBe(400);

      mockContainer.wigleImportRunService.resumeLatestImportRun.mockRejectedValue(
        Object.assign(new Error('quota exhausted'), { status: 403, code: 'QUOTA' })
      );
      const forbidden = await request(app).post('/api/wigle/search-api/import-runs/resume-latest');
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.code).toBe('QUOTA');
    });

    it('returns the latest resumable run', async () => {
      mockContainer.wigleImportRunService.getLatestResumableImportRun.mockResolvedValue({
        id: 10,
      });

      const res = await request(app)
        .get('/api/wigle/search-api/import-runs/resumable/latest')
        .query({ state: 'TX' });

      expect(res.status).toBe(200);
      expect(res.body.run).toEqual({ id: 10 });
    });

    it('resumes, pauses, and cancels a run by id', async () => {
      mockContainer.wigleImportRunService.resumeImportRun.mockResolvedValue({
        id: 11,
        status: 'running',
      });
      mockContainer.wigleImportRunService.pauseImportRun.mockResolvedValue({
        id: 11,
        status: 'paused',
      });
      mockContainer.wigleImportRunService.cancelImportRun.mockResolvedValue({
        id: 11,
        status: 'cancelled',
      });

      const resumed = await request(app).post('/api/wigle/search-api/import-runs/11/resume');
      const paused = await request(app).post('/api/wigle/search-api/import-runs/11/pause');
      const cancelled = await request(app).post('/api/wigle/search-api/import-runs/11/cancel');

      expect(resumed.status).toBe(200);
      expect(paused.body.run.status).toBe('paused');
      expect(cancelled.body.run.status).toBe('cancelled');
    });

    it.each(['resume', 'pause', 'cancel'])('rejects invalid ids for %s', async (action) => {
      const res = await request(app).post(`/api/wigle/search-api/import-runs/bad/${action}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid run id');
    });
  });

  describe('DELETE /search-api/saved-ssid-terms/:id', () => {
    it('deletes an existing saved term', async () => {
      const db = require('../../../../server/src/config/database');
      db.query.mockResolvedValue({ rowCount: 1 });

      const res = await request(app).delete('/api/wigle/search-api/saved-ssid-terms/5');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, deleted: 5 });
    });

    it('rejects invalid ids and returns 404 for missing terms', async () => {
      const invalid = await request(app).delete('/api/wigle/search-api/saved-ssid-terms/bad');
      expect(invalid.status).toBe(400);

      const db = require('../../../../server/src/config/database');
      db.query.mockResolvedValue({ rowCount: 0 });
      const missing = await request(app).delete('/api/wigle/search-api/saved-ssid-terms/5');
      expect(missing.status).toBe(404);
    });
  });

  describe('POST /search-api/bt-import-start', () => {
    it('starts a validated Bluetooth import', async () => {
      mockContainer.wigleBluetoothImportService.validateBtImportQuery.mockReturnValue(null);
      mockContainer.wigleBluetoothImportService.startBluetoothImportRun.mockResolvedValue({
        id: 21,
        status: 'running',
      });

      const res = await request(app)
        .post('/api/wigle/search-api/bt-import-start')
        .send({ namelike: 'sensor' });

      expect(res.status).toBe(200);
      expect(
        mockContainer.wigleBluetoothImportService.startBluetoothImportRun
      ).toHaveBeenCalledWith({
        namelike: 'sensor',
      });
    });

    it('resumes a Bluetooth import and validates run ids', async () => {
      mockContainer.wigleBluetoothImportService.resumeBluetoothImportRun.mockResolvedValue({
        id: 22,
        status: 'running',
      });

      const resumed = await request(app)
        .post('/api/wigle/search-api/bt-import-start')
        .send({ runId: '22' });
      const invalid = await request(app)
        .post('/api/wigle/search-api/bt-import-start')
        .send({ runId: 'bad' });

      expect(resumed.status).toBe(200);
      expect(
        mockContainer.wigleBluetoothImportService.resumeBluetoothImportRun
      ).toHaveBeenCalledWith(22);
      expect(invalid.status).toBe(400);
    });

    it('returns validation and forbidden errors', async () => {
      mockContainer.wigleBluetoothImportService.validateBtImportQuery.mockReturnValueOnce(
        'invalid bluetooth query'
      );
      const invalid = await request(app).post('/api/wigle/search-api/bt-import-start');
      expect(invalid.status).toBe(400);

      mockContainer.wigleBluetoothImportService.validateBtImportQuery.mockReturnValue(null);
      mockContainer.wigleBluetoothImportService.startBluetoothImportRun.mockRejectedValue(
        Object.assign(new Error('quota exhausted'), { status: 403, code: 'QUOTA' })
      );
      const forbidden = await request(app).post('/api/wigle/search-api/bt-import-start');
      expect(forbidden.status).toBe(403);
    });
  });

  describe('DELETE /search-api/import-runs/cluster-cleanup', () => {
    it('requires explicit confirmation before cleanup', async () => {
      const res = await request(app).delete('/api/wigle/search-api/import-runs/cluster-cleanup');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('confirm: true');
      expect(
        mockContainer.wigleImportRunService.bulkDeleteGlobalCancelledCluster
      ).not.toHaveBeenCalled();
    });

    it('deletes the cancelled global cluster after confirmation', async () => {
      mockContainer.wigleImportRunService.bulkDeleteGlobalCancelledCluster.mockResolvedValue(14);

      const res = await request(app)
        .delete('/api/wigle/search-api/import-runs/cluster-cleanup')
        .send({ confirm: true });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, deleted: 14 });
      expect(
        mockContainer.wigleImportRunService.bulkDeleteGlobalCancelledCluster
      ).toHaveBeenCalledTimes(1);
    });
  });
});
