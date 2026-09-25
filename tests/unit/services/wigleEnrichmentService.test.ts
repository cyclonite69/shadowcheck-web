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

    it('throws when run is not found', async () => {
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [] }) // no conflict
        .mockResolvedValueOnce({ rows: [] }); // resetRunForResume returns nothing
      await expect(resumeEnrichment(10)).rejects.toThrow('Run not found');
    });

    it('returns the resumed run row and fires the loop', async () => {
      const mockRow = { id: 10, status: 'running' };
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [] }) // no conflict
        .mockResolvedValueOnce({ rows: [mockRow] }); // resetRunForResume
      mockGetImportRun.mockResolvedValue({ id: 10, status: 'completed' }); // loop exits immediately
      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ status: 'completed' }] }) // getRunStatus inside loop
        .mockResolvedValueOnce({ rows: [] }); // getNextEnrichmentBatch

      const result = await resumeEnrichment(10);
      expect(result).toEqual(mockRow);
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
