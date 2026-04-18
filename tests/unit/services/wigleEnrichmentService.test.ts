/**
 * WigleEnrichmentService Unit Tests - Exhaustive Non-Loop
 */

export {};

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

jest.mock('../../../server/src/config/container', () => ({
  adminDbService: {
    adminQuery: mockAdminQuery,
  },
  wigleService: mockWigleService,
  secretsManager: mockSecretsManager,
}));
jest.mock('../../../server/src/services/wigleClient', () => ({
  fetchWigle: mockFetchWigle,
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
    mockRunRepository.getImportRun.mockResolvedValue({ status: 'completed' });
  });

  it('getPendingEnrichmentCount exhaustive', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ count: 10 }] });
    expect(await wigleEnrichmentService.getPendingEnrichmentCount()).toBe(10);
    mockAdminQuery.mockResolvedValueOnce({ rows: [] });
    expect(await wigleEnrichmentService.getPendingEnrichmentCount()).toBe(0);
  });

  it('getEnrichmentCatalog exhaustive filters', async () => {
    mockAdminQuery.mockResolvedValue({ rows: [{ count: 1 }] });
    const filters = [
      {},
      { region: 'R' },
      { city: 'C' },
      { ssid: 'S' },
      { bssid: 'B' },
      { region: 'R', city: 'C' },
      { ssid: 'S', bssid: 'B' },
      { region: 'R', city: 'C', ssid: 'S', bssid: 'B' },
      { page: 2 },
      { limit: 10 },
      { page: 3, limit: 5 },
    ];
    for (const filter of filters) {
      await wigleEnrichmentService.getEnrichmentCatalog(filter);
    }
    expect(mockAdminQuery).toHaveBeenCalled();
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
