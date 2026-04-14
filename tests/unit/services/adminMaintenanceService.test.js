const {
  getDuplicateObservationStats,
  deleteDuplicateObservations,
  getObservationCount,
  refreshColocationView,
  truncateAllData,
} = require('../../../server/src/services/adminMaintenanceService');
const { adminQuery } = require('../../../server/src/services/adminDbService');
const { query } = require('../../../server/src/config/database');

jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/config/database');

describe('adminMaintenanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getDuplicateObservationStats returns stats', async () => {
    query.mockResolvedValue({ rows: [{ total: 10, unique_obs: 5 }] });
    const stats = await getDuplicateObservationStats();
    expect(stats).toEqual({ total: 10, unique_obs: 5 });
    expect(query).toHaveBeenCalled();
  });

  test('deleteDuplicateObservations returns row count', async () => {
    adminQuery.mockResolvedValue({ rowCount: 5 });
    const count = await deleteDuplicateObservations();
    expect(count).toBe(5);
    expect(adminQuery).toHaveBeenCalled();
  });

  test('getObservationCount returns count', async () => {
    query.mockResolvedValue({ rows: [{ total: '100' }] });
    const count = await getObservationCount();
    expect(count).toBe(100);
    expect(query).toHaveBeenCalled();
  });

  test('refreshColocationView executes refresh queries', async () => {
    await refreshColocationView(1234567890);
    expect(adminQuery).toHaveBeenCalledTimes(4);
  });

  test('truncateAllData truncates tables', async () => {
    await truncateAllData();
    expect(adminQuery).toHaveBeenCalledTimes(2);
  });
});
