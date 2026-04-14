jest.mock('../../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));
jest.mock('../../../server/src/logging/logger', () => ({
  error: jest.fn(),
}));

const { getDetailedDatabaseStats } = require('../../../server/src/services/adminDbStatsService');
const { adminQuery } = require('../../../server/src/services/adminDbService');

describe('adminDbStatsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getDetailedDatabaseStats returns stats', async () => {
    (adminQuery as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ total_size: '100MB' }] }) // sizeResult
      .mockResolvedValueOnce({ rows: [] }) // tableStats
      .mockResolvedValueOnce({ rows: [] }) // mvStats
      .mockResolvedValueOnce({ rows: [] }); // unusedIndexes

    const stats = await getDetailedDatabaseStats();
    expect(stats.total_db_size).toBe('100MB');
    expect(adminQuery).toHaveBeenCalledTimes(4);
  });
});
