/**
 * WigleEnrichmentService Unit Tests - Exhaustive Non-Loop
 */

const mockAdminQuery = jest.fn();
const mockFetchWigle = jest.fn();
const mockWigleService = {
  importWigleV3NetworkDetail: jest.fn(),
  importWigleV3Observation: jest.fn(),
};
const mockSecretsManager = {
  get: jest.fn(),
};
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const mockRunRepository = {
  createImportRun: jest.fn(),
  getImportRun: jest.fn(),
  markRunControlStatus: jest.fn(),
  markRunFailure: jest.fn(),
  completeRun: jest.fn(),
};

// Mock the container before importing the service
jest.mock('../../../server/src/config/container', () => ({
  adminDbService: {
    adminQuery: (...args: any[]) => mockAdminQuery(...args),
  },
  wigleService: mockWigleService,
  secretsManager: mockSecretsManager,
}));

jest.mock('../../../server/src/services/wigleClient', () => ({
  fetchWigle: (...args: any[]) => mockFetchWigle(...args),
}));

jest.mock('../../../server/src/logging/logger', () => mockLogger);

jest.mock('../../../server/src/services/wigleImport/runRepository', () => mockRunRepository);

const wigleEnrichmentService = require('../../../server/src/services/wigleEnrichmentService');

describe('WigleEnrichmentService Exhaustive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WIGLE_ALLOW_BULK = 'I_UNDERSTAND';
    require('../../../server/src/services/wigleRequestLedger').resetQuotaLedger();
    mockAdminQuery.mockResolvedValue({ rows: [{ status: 'completed' }] });
  });

  it('getPendingEnrichmentCount exhaustive', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ count: 10 }] });
    const count = await wigleEnrichmentService.getPendingEnrichmentCount();
    expect(count).toBe(10);
    expect(mockAdminQuery).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT bssid)'), []);
  });

  it('getEnrichmentCatalog exhaustive filters', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'A' }, { bssid: 'B' }] });
    const catalog = await wigleEnrichmentService.getEnrichmentCatalog({ limit: 2 });
    expect(catalog.data).toHaveLength(2);
    expect(mockAdminQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT 2'), [2]);
  });

  it('validateWigleApiCredit exhaustive', async () => {
    mockSecretsManager.get.mockReturnValue('v');
    const cases = [
      { status: 200, data: { estimatedApiQuotaRemaining: 100 }, has: true },
      { status: 200, data: { estimatedApiQuotaRemaining: 5 }, has: true },
      { status: 200, data: { estimatedApiQuotaRemaining: 0 }, has: false },
      { status: 401, data: {}, has: false },
    ];
    for (const testCase of cases) {
      mockFetchWigle.mockResolvedValueOnce({
        status: testCase.status,
        json: () => Promise.resolve(testCase.data),
      });
      const result = await wigleEnrichmentService.validateWigleApiCredit();
      expect(result.hasCredit).toBe(testCase.has);
    }

    mockSecretsManager.get.mockReturnValue(null);
    expect((await wigleEnrichmentService.validateWigleApiCredit()).hasCredit).toBe(false);

    mockSecretsManager.get.mockReturnValue('v');
    mockFetchWigle.mockRejectedValueOnce(new Error('fail'));
    expect((await wigleEnrichmentService.validateWigleApiCredit()).hasCredit).toBe(true);
  });

  it('Enrichment Control exhaustive', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] });
    mockRunRepository.createImportRun.mockResolvedValue({ id: 1 });
    // Prevent the enrichment loop from actually running into destructuring errors
    mockAdminQuery.mockResolvedValue({ rows: [{ status: 'completed' }] });
    
    await wigleEnrichmentService.startBatchEnrichment();

    mockRunRepository.createImportRun.mockResolvedValue({ id: 2 });
    await wigleEnrichmentService.startBatchEnrichment(['A', 'B']);

    mockAdminQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });
    await expect(wigleEnrichmentService.startBatchEnrichment()).rejects.toThrow();

    mockAdminQuery.mockResolvedValueOnce({ rows: [{ id: 3, status: 'running' }] });
    expect((await wigleEnrichmentService.resumeEnrichment(3)).id).toBe(3);

    mockAdminQuery.mockResolvedValueOnce({ rows: [] });
    await expect(wigleEnrichmentService.resumeEnrichment(4)).rejects.toThrow();
  });
});
