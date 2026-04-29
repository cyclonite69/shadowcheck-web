// MOCK EVERYTHING
const mockFetchWigle = jest.fn();
jest.mock('../../../server/src/services/wigleClient', () => ({ fetchWigle: mockFetchWigle }));

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
}));
jest.mock('../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockAdminQuery = jest.fn();
const mockSecretsGet = jest.fn((key: string) => 'test');
jest.mock('../../../server/src/config/container', () => ({
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
} = require('../../../server/src/services/wigleEnrichmentService');

describe('wigleEnrichmentService (Pure Unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    mockAdminQuery.mockResolvedValue({ rows: [] });
    mockSecretsGet.mockImplementation((key: string) => 'test');
  });

  describe('runEnrichmentLoop', () => {
    it('pauses run when WiGLE returns 429', async () => {
      mockGetImportRun.mockResolvedValue({ id: 1, status: 'running' });

      mockAdminQuery
        .mockResolvedValueOnce({ rows: [{ status: 'running' }] }) // Loop start status check
        .mockResolvedValueOnce({ rows: [{ bssid: 'B1', type: 'WIFI' }] }); // getNextEnrichmentBatch

      mockFetchWigle.mockResolvedValueOnce({
        status: 429,
        ok: false,
        text: jest.fn().mockResolvedValue('Too many requests'),
      });

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
});
