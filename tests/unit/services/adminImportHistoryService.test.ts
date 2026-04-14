jest.mock('../../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));
jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../../../server/src/logging/logger', () => ({
  warn: jest.fn(),
}));

const adminImportHistoryService = require('../../../server/src/services/adminImportHistoryService');
const { adminQuery: adminQueryImport } = require('../../../server/src/services/adminDbService');
const { query: queryApp } = require('../../../server/src/config/database');

describe('adminImportHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('captureImportMetrics fetches counts', async () => {
    (adminQueryImport as jest.Mock).mockResolvedValue({ rows: [{ value: '10' }] });
    const metrics = await adminImportHistoryService.captureImportMetrics();
    expect(metrics.networks).toBe(10);
  });

  test('createImportHistoryEntry creates entry', async () => {
    (adminQueryImport as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }] });
    const id = await adminImportHistoryService.createImportHistoryEntry('tag', 'file.kml', {});
    expect(id).toBe(1);
  });

  test('getImportCounts fetches counts', async () => {
    (queryApp as jest.Mock).mockResolvedValue({ rows: [{ observations: 5, networks: 5 }] });
    const counts = await adminImportHistoryService.getImportCounts();
    expect(counts.observations).toBe(5);
  });
});
