/**
 * WigleEnrichmentService Unit Tests - Exhaustive Non-Loop
 */

export {};

const mockAdminQuery = jest.fn();
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
const mockWithRetry = jest.fn((fn) => fn());
const mockRunRepository = {
  createImportRun: jest.fn(),
  getImportRun: jest.fn(),
  markRunControlStatus: jest.fn(),
  markRunFailure: jest.fn(),
  completeRun: jest.fn(),
};

jest.mock('../../server/src/services/adminDbService', () => ({ adminQuery: mockAdminQuery }));
jest.mock('../../server/src/services/wigleService', () => mockWigleService);
jest.mock('../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: mockSecretsManager,
}));
jest.mock('../../server/src/logging/logger', () => mockLogger);
jest.mock('../../server/src/services/externalServiceHandler', () => ({ withRetry: mockWithRetry }));
jest.mock('../../server/src/services/wigleImport/runRepository', () => mockRunRepository);

// Mock global fetch
global.fetch = jest.fn();

const wigleEnrichmentService = require('../../server/src/services/wigleEnrichmentService');

describe('WigleEnrichmentService Exhaustive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: stop any loop immediately
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
    for (const f of filters) {
      await wigleEnrichmentService.getEnrichmentCatalog(f);
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
    for (const c of cases) {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: c.status,
        json: async () => c.data,
      });
      const res = await wigleEnrichmentService.validateWigleApiCredit();
      expect(res.hasCredit).toBe(c.has);
    }
    mockSecretsManager.get.mockReturnValue(null);
    expect((await wigleEnrichmentService.validateWigleApiCredit()).hasCredit).toBe(false);

    mockSecretsManager.get.mockReturnValue('v');
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    expect((await wigleEnrichmentService.validateWigleApiCredit()).hasCredit).toBe(true);
  });

  it('Enrichment Control exhaustive', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] });
    mockRunRepository.createImportRun.mockResolvedValue({ id: 1 });
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
