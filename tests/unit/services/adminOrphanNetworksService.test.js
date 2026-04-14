const {
  listOrphanNetworks,
  getOrphanNetworkCounts,
  backfillOrphanNetworkFromWigle,
} = require('../../../server/src/services/adminOrphanNetworksService');
const { adminQuery } = require('../../../server/src/services/adminDbService');
const wigleService = require('../../../server/src/services/wigleService');

jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/services/wigleService');
jest.mock('../../../server/src/logging/logger', () => ({
  warn: jest.fn(),
}));

describe('adminOrphanNetworksService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listOrphanNetworks returns rows', async () => {
    adminQuery.mockResolvedValue({ rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }] });
    const result = await listOrphanNetworks();
    expect(result).toHaveLength(1);
    expect(adminQuery).toHaveBeenCalled();
  });

  test('getOrphanNetworkCounts returns total', async () => {
    adminQuery.mockResolvedValue({ rows: [{ total: 5 }] });
    const result = await getOrphanNetworkCounts();
    expect(result.total).toBe(5);
  });
});
