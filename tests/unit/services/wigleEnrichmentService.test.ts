// MOCK EVERYTHING
const mockFetchWigle = jest.fn();
jest.mock('../../../server/src/services/wigleClient', () => ({ fetchWigle: mockFetchWigle }));

const mockFetchAndImportDetail = jest.fn();
jest.mock('../../../server/src/services/wigleEnrichmentFetcher', () => ({
  fetchAndImportDetail: (...args: any[]) => mockFetchAndImportDetail(...args),
}));

const mockCreateImportRun = jest.fn();
const mockGetImportRun = jest.fn();
const mockMarkRunControlStatus = jest.fn();
const mockCompleteRun = jest.fn();
const mockMarkRunFailure = jest.fn();
jest.mock('../../../server/src/services/wigleImport/runRepository', () => ({
  createImportRun: mockCreateImportRun,
  getImportRun: mockGetImportRun,
  markRunControlStatus: mockMarkRunControlStatus,
  completeRun: mockCompleteRun,
  markRunFailure: mockMarkRunFailure,
}));

jest.mock('../../../server/src/services/wigleRequestLedger', () => ({
  recordRequest: jest.fn().mockResolvedValue({}),
  assertCanRequest: jest.fn(),
}));
jest.mock('../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockAdminQuery = jest.fn();
const mockSecretsGet = jest.fn((_key: string) => 'test');
const mockWigleGatewayFetch = jest.fn();
jest.mock('../../../server/src/services/wigle/wigleGateway', () => ({
  wigleGatewayFetch: (...args: any[]) => mockWigleGatewayFetch(...args),
}));
jest.mock('../../../server/src/services/wigleRequestUtils', () => ({
  getEncodedWigleAuth: jest.fn(() => 'bW9jazptb2Nr'),
}));
jest.mock('../../../server/src/config/container', () => ({
  __esModule: true,
  adminDbService: { adminQuery: mockAdminQuery },
  wigleService: {
    importWigleV3NetworkDetail: jest.fn(),
    importWigleV3Observation: jest.fn(),
  },
  secretsManager: { get: mockSecretsGet },
}));

// MUST require after mocks
const {
  runEnrichmentLoop,
  startBatchEnrichment,
  resumeEnrichment,
  validateWigleApiCredit,
} = require('../../../server/src/services/wigleEnrichmentService');

describe('wigleEnrichmentService (Pure Unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    mockAdminQuery.mockResolvedValue({ rows: [] });
    mockSecretsGet.mockImplementation((_key: string) => 'test');
  });

  describe('runEnrichmentLoop', () => {
    it('pauses run when WiGLE returns 429', async () => {
      mockGetImportRun.mockResolvedValue({ id: 1, status: 'running' });

      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ status: 'running' }] }) // Loop start status check
        .mockResolvedValueOnce({ rows: [{ bssid: 'B1', type: 'WIFI' }] }); // getNextEnrichmentBatch

      mockFetchAndImportDetail.mockRejectedValueOnce(
        Object.assign(new Error('Too many requests'), { status: 429 })
      );

      await runEnrichmentLoop(1);

      expect(mockMarkRunControlStatus).toHaveBeenCalledWith(1, 'paused');
    });

    it('completes run when batch is empty', async () => {
      mockGetImportRun.mockResolvedValue({ id: 1, status: 'running' });

      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ status: 'running' }] }) // status check
        .mockResolvedValueOnce({ rows: [] }); // empty batch

      await runEnrichmentLoop(1);

      expect(mockCompleteRun).toHaveBeenCalledWith(1);
    });
  });

  describe('startBatchEnrichment', () => {
    it('creates full-catalog enrichment runs with direct source/version/search metadata', async () => {
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ count: 12 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      mockCreateImportRun.mockResolvedValue({ id: 99 });
      mockGetImportRun.mockResolvedValue({ id: 99, status: 'completed' });

      await startBatchEnrichment();

      expect(mockCreateImportRun).toHaveBeenCalledWith(
        {
          version: 'v3',
          source: 'v3_batch',
          searchTerm: 'Full Catalog Enrichment',
          resultsPerPage: 1,
          pendingItems: 12,
        },
        {
          source: 'v3_batch',
          api_version: 'v3',
          search_term: 'Full Catalog Enrichment',
        }
      );
    });

    it('creates manual enrichment runs with direct source/version/search metadata', async () => {
      mockAdminQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
      mockCreateImportRun.mockResolvedValue({ id: 100 });
      mockGetImportRun.mockResolvedValue({ id: 100, status: 'completed' });

      await startBatchEnrichment(['AA:BB:CC:DD:EE:FF', '11:22:33:44:55:66']);

      expect(mockCreateImportRun).toHaveBeenCalledWith(
        {
          version: 'v3',
          source: 'v3_manual',
          searchTerm: 'Targeted Enrichment (2 items)',
          resultsPerPage: 1,
          pendingItems: 2,
        },
        {
          source: 'v3_manual',
          api_version: 'v3',
          search_term: 'Targeted Enrichment (2 items)',
        }
      );
    });

    it('throws when no networks are pending (full-catalog)', async () => {
      mockAdminQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      await expect(startBatchEnrichment()).rejects.toThrow('No networks found in v2 catalog');
    });

    it('throws when no pending networks exist (empty-array falls back to full-catalog)', async () => {
      // [] → isManual=false → getPendingEnrichmentCount() → 0 → throws catalog error
      mockAdminQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      await expect(startBatchEnrichment([])).rejects.toThrow('No networks found in v2 catalog');
    });

    it('throws 400 when more than 100 targeted BSSIDs are submitted', async () => {
      const tooMany = Array.from(
        { length: 101 },
        (_, i) => `AA:BB:CC:DD:EE:${String(i).padStart(2, '0')}`
      );
      const err: any = await startBatchEnrichment(tooMany).catch((e: any) => e);
      expect(err.status).toBe(400);
      expect(err.message).toContain('100');
    });

    it('throws 409 when an enrichment run is already active', async () => {
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ count: 5 }] }) // getPendingEnrichmentCount
        .mockResolvedValueOnce({ rows: [{ id: 77 }] }); // getActiveEnrichmentRunId
      const err: any = await startBatchEnrichment().catch((e: any) => e);
      expect(err.status).toBe(409);
      expect(err.message).toContain('77');
    });
  });

  describe('resumeEnrichment', () => {
    it('throws 409 when a different run is already active', async () => {
      // getActiveEnrichmentRunId returns a conflicting run id
      mockAdminQuery.mockResolvedValueOnce({ rows: [{ id: 55 }] });
      const err: any = await resumeEnrichment(10).catch((e: any) => e);
      expect(err.status).toBe(409);
      expect(err.message).toContain('55');
    });

    it('R1: throws 404 when run is not found and does not call loop', async () => {
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [] }) // no conflict
        .mockResolvedValueOnce({ rows: [] }); // run query returns nothing
      const err: any = await resumeEnrichment(999).catch((e: any) => e);
      expect(err.status).toBe(404);
      expect(err.message).toMatch(/not found/i);
      expect(mockGetImportRun).not.toHaveBeenCalled();
    });

    it('R2: rejects run whose source is not v3_manual/v3_batch and does not call resetRunForResume or loop', async () => {
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [] }) // no conflict
        .mockResolvedValueOnce({ rows: [{ id: 423, source: 'wigle_bt', status: 'paused' }] }); // run is wigle_bt
      const err: any = await resumeEnrichment(423).catch((e: any) => e);
      expect(err.status).toBe(400);
      expect(err.message).toMatch(/Cannot resume non-enrichment import run/i);
      expect(mockAdminQuery).toHaveBeenCalledTimes(2); // no 3rd call to resetRunForResume
      expect(mockGetImportRun).not.toHaveBeenCalled();
    });

    it('R3: rejects run with status completed or running and starts nothing', async () => {
      // completed
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [] }) // no conflict
        .mockResolvedValueOnce({ rows: [{ id: 426, source: 'v3_batch', status: 'completed' }] });
      const errComp: any = await resumeEnrichment(426).catch((e: any) => e);
      expect(errComp.status).toBe(400);
      expect(errComp.message).toMatch(/already completed/i);

      // running
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [] }) // no conflict
        .mockResolvedValueOnce({ rows: [{ id: 427, source: 'v3_batch', status: 'running' }] });
      const errRun: any = await resumeEnrichment(427).catch((e: any) => e);
      expect(errRun.status).toBe(400);
      expect(errRun.message).toMatch(/already running/i);

      expect(mockGetImportRun).not.toHaveBeenCalled();
    });

    it('R4: rejects targeted run (v3_manual) with no persisted target list with clear message to start a new run', async () => {
      // A paused 427-shaped row fixture
      const paused427Fixture = {
        id: 427,
        source: 'v3_manual',
        status: 'paused',
        search_term: 'Targeted Enrichment (12 items)',
        request_params: {
          source: 'v3_manual',
          version: 'v3',
          searchTerm: 'Targeted Enrichment (12 items)',
          pendingItems: 12,
          resultsPerPage: 1,
        },
      };
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [] }) // no conflict
        .mockResolvedValueOnce({ rows: [paused427Fixture] }); // load run

      const err: any = await resumeEnrichment(427).catch((e: any) => e);
      expect(err.status).toBe(400);
      expect(err.message).toContain('start a new run');
      expect(mockAdminQuery).toHaveBeenCalledTimes(2); // resetRunForResume NOT called
      expect(mockGetImportRun).not.toHaveBeenCalled();
    });

    it('R5: resumes full-backlog run (v3_batch) in paused state and calls runEnrichmentLoop with no list', async () => {
      const pausedBatchRun = {
        id: 500,
        source: 'v3_batch',
        status: 'paused',
        search_term: 'Full Catalog Enrichment',
        request_params: { source: 'v3_batch', version: 'v3' },
      };
      const resumedRow = { id: 500, source: 'v3_batch', status: 'running' };
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [] }) // no conflict
        .mockResolvedValueOnce({ rows: [pausedBatchRun] }) // load run
        .mockResolvedValueOnce({ rows: [resumedRow] }); // resetRunForResume
      mockGetImportRun.mockResolvedValue({ id: 500, status: 'completed' }); // loop exits immediately
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ status: 'completed' }] }) // getRunStatus inside loop
        .mockResolvedValueOnce({ rows: [] }); // getNextEnrichmentBatch

      const result = await resumeEnrichment(500);
      expect(result).toEqual(resumedRow);
    });

    it('R5: resumes full-backlog run (v3_batch) in failed state (per JSDoc)', async () => {
      const failedBatchRun = {
        id: 501,
        source: 'v3_batch',
        status: 'failed',
        search_term: 'Full Catalog Enrichment',
        request_params: { source: 'v3_batch', version: 'v3' },
      };
      const resumedRow = { id: 501, source: 'v3_batch', status: 'running' };
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [] }) // no conflict
        .mockResolvedValueOnce({ rows: [failedBatchRun] }) // load run
        .mockResolvedValueOnce({ rows: [resumedRow] }); // resetRunForResume
      mockGetImportRun.mockResolvedValue({ id: 501, status: 'completed' }); // loop exits immediately
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ status: 'completed' }] }) // getRunStatus inside loop
        .mockResolvedValueOnce({ rows: [] }); // getNextEnrichmentBatch

      const result = await resumeEnrichment(501);
      expect(result).toEqual(resumedRow);
    });
  });

  describe('validateWigleApiCredit', () => {
    it('returns hasCredit: false when credentials are missing', async () => {
      mockSecretsGet.mockReturnValue('' as any);
      const result = await validateWigleApiCredit();
      expect(result.hasCredit).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('returns hasCredit: false when gateway returns 401', async () => {
      mockSecretsGet.mockImplementation(() => 'test-key');
      mockWigleGatewayFetch.mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' });
      const result = await validateWigleApiCredit();
      expect(result.hasCredit).toBe(false);
      expect(result.message).toContain('Invalid WiGLE API key');
    });

    it('returns hasCredit: false when 0 quota remaining', async () => {
      mockSecretsGet.mockImplementation(() => 'test-key');
      mockWigleGatewayFetch.mockResolvedValue({
        ok: true,
        response: { status: 200, json: async () => ({ estimatedApiQuotaRemaining: 0 }) },
      });
      const result = await validateWigleApiCredit();
      expect(result.hasCredit).toBe(false);
      expect(result.message).toContain('No API credit');
    });

    it('returns hasCredit: true with remaining count when quota is available', async () => {
      mockSecretsGet.mockImplementation(() => 'test-key');
      mockWigleGatewayFetch.mockResolvedValue({
        ok: true,
        response: { status: 200, json: async () => ({ estimatedApiQuotaRemaining: 250 }) },
      });
      const result = await validateWigleApiCredit();
      expect(result.hasCredit).toBe(true);
      expect(result.message).toContain('250');
    });

    it('returns hasCredit: true when the credit check itself throws (fail-open)', async () => {
      mockSecretsGet.mockImplementation(() => 'test-key');
      mockWigleGatewayFetch.mockRejectedValue(new Error('network error'));
      const result = await validateWigleApiCredit();
      expect(result.hasCredit).toBe(true);
      expect(result.message).toContain('unavailable');
    });
  });
});
