const { getDataQualityMetrics } = require('../../../server/src/services/miscService');
const { pool } = require('../../../server/src/config/database');

jest.mock('../../../server/src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('miscService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getDataQualityMetrics should query database with provided clause', async () => {
    const mockData = {
      rows: [
        {
          total_observations: 100,
          unique_networks: 5,
          earliest_time: '2025-01-01',
          latest_time: '2025-01-02',
        },
      ],
    };
    pool.query.mockResolvedValue(mockData);

    const whereClause = 'AND level > -80';
    const result = await getDataQualityMetrics(whereClause);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining(whereClause));
    expect(result).toEqual(mockData.rows[0]);
  });
});
