const mockBuilder = {
  getValidationErrors: jest.fn(),
  buildDashboardMetricsQuery: jest.fn(),
  getAppliedCount: jest.fn(),
};
const MockUniversalFilterQueryBuilder = jest.fn(() => mockBuilder);

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/logging/logger', () => ({
  error: jest.fn(),
}));

jest.mock('../../../server/src/services/filterQueryBuilder', () => ({
  UniversalFilterQueryBuilder: MockUniversalFilterQueryBuilder,
}));

const NetworkRepository = require('../../../server/src/repositories/networkRepository');
const dbConfigNetwork = require('../../../server/src/config/database');

describe('NetworkRepository', () => {
  let repository: any;

  beforeEach(() => {
    jest.clearAllMocks();
    MockUniversalFilterQueryBuilder.mockImplementation(() => mockBuilder);
    mockBuilder.getValidationErrors.mockReturnValue([]);
    mockBuilder.buildDashboardMetricsQuery.mockReturnValue({
      sql: 'SELECT dashboard metrics',
      params: ['value'],
    });
    mockBuilder.getAppliedCount.mockReturnValue(3);
    repository = new NetworkRepository();
  });

  it('should fetch all networks', async () => {
    (dbConfigNetwork.query as jest.Mock).mockResolvedValue({
      rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }],
    });

    const result = await repository.getAllNetworks();

    expect(dbConfigNetwork.query).toHaveBeenCalled();
    expect(result.length).toBe(1);
  });

  it('should handle errors in getAllNetworks', async () => {
    (dbConfigNetwork.query as jest.Mock).mockRejectedValue(new Error('db error'));

    const result = await repository.getAllNetworks();

    expect(result).toEqual([]);
  });

  it('should get threatened networks', async () => {
    (dbConfigNetwork.query as jest.Mock).mockResolvedValue({
      rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }],
    });

    const result = await repository.getThreatenedNetworks();

    expect(dbConfigNetwork.query).toHaveBeenCalled();
    expect(result.length).toBe(1);
  });

  it('should fetch networks by type', async () => {
    (dbConfigNetwork.query as jest.Mock).mockResolvedValue({
      rows: [{ bssid: 'AA:BB:CC:DD:EE:FF', type: 'W' }],
    });

    await expect(repository.getNetworksByType('W')).resolves.toHaveLength(1);
    expect(dbConfigNetwork.query).toHaveBeenCalledWith(expect.stringContaining('WHERE type = $1'), [
      'W',
    ]);
  });

  it.each([
    ['getNetworksByType', ['W']],
    ['getThreatenedNetworks', []],
  ])('returns an empty list when %s fails', async (method, args) => {
    (dbConfigNetwork.query as jest.Mock).mockRejectedValueOnce(new Error('query failed'));

    await expect(repository[method](...args)).resolves.toEqual([]);
  });

  it('returns zeroed metrics when filter validation fails', async () => {
    mockBuilder.getValidationErrors.mockReturnValueOnce(['invalid filter']);

    const result = await repository.getDashboardMetrics({ ssid: 'bad' }, { ssid: true });

    expect(result.totalNetworks).toBe(0);
    expect(result.totalObservations).toBe(0);
    expect(result.filtersApplied).toBe(0);
    expect(dbConfigNetwork.query).not.toHaveBeenCalled();
  });

  it('disables an all-radio selection in its effective-filter helper', () => {
    const filters = { radioTypes: ['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'] };

    expect(repository.getEffectiveEnabledFilters(filters, { radioTypes: true })).toEqual({
      radioTypes: false,
    });
    expect(repository.getEffectiveEnabledFilters({}, { ssid: true })).toEqual({ ssid: true });
  });

  it('builds and normalizes dashboard metrics', async () => {
    (dbConfigNetwork.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          total_networks: '10',
          wifi_count: '4',
          ble_count: '2',
          bluetooth_count: '1',
          lte_count: '1',
          nr_count: '1',
          gsm_count: '1',
          total_observations: '20',
          wifi_observations: '8',
          ble_observations: '4',
          bluetooth_observations: '2',
          lte_observations: '2',
          nr_observations: '2',
          gsm_observations: '2',
          threats_critical: '1',
          threats_high: '2',
          threats_medium: '3',
          threats_low: '4',
          enriched_count: '5',
        },
      ],
    });

    const result = await repository.getDashboardMetrics(
      { radioTypes: ['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'] },
      { radioTypes: true }
    );

    expect(MockUniversalFilterQueryBuilder).toHaveBeenCalledWith(
      { radioTypes: ['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'] },
      { radioTypes: true }
    );
    expect(dbConfigNetwork.query).toHaveBeenCalledWith('SELECT dashboard metrics', ['value']);
    expect(result).toEqual(
      expect.objectContaining({
        totalNetworks: 10,
        wifiCount: 4,
        totalObservations: 20,
        threatsCritical: 1,
        activeSurveillance: 2,
        enrichedCount: 5,
        filtersApplied: 3,
      })
    );
  });

  it('normalizes missing dashboard fields to zero', async () => {
    (dbConfigNetwork.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const result = await repository.getDashboardMetrics();

    expect(result.totalNetworks).toBe(0);
    expect(result.gsmObservations).toBe(0);
    expect(result.activeSurveillance).toBe(0);
  });

  it('returns zeroed metrics when the dashboard query fails', async () => {
    (dbConfigNetwork.query as jest.Mock).mockRejectedValueOnce(new Error('metrics failed'));

    const result = await repository.getDashboardMetrics();

    expect(result.totalNetworks).toBe(0);
    expect(result.filtersApplied).toBe(0);
  });

  it('refreshes the network explorer materialized view', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };

    await repository.refreshNetworkExplorerMV(client);

    expect(client.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW app.api_network_explorer_mv'
    );
  });

  describe('getNetworkTypesByBssids', () => {
    it('returns empty array when bssids is empty without querying DB', async () => {
      const result = await NetworkRepository.getNetworkTypesByBssids([]);
      expect(result).toEqual([]);
      expect(dbConfigNetwork.query).not.toHaveBeenCalled();
    });

    it('queries distinct network types for provided BSSIDs', async () => {
      (dbConfigNetwork.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ bssid: 'AA:BB:CC:DD:EE:FF', type: 'W' }],
      });

      const result = await NetworkRepository.getNetworkTypesByBssids(['AA:BB:CC:DD:EE:FF']);

      expect(dbConfigNetwork.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT ON (bssid) bssid, type'),
        [['AA:BB:CC:DD:EE:FF']]
      );
      expect(result).toEqual([{ bssid: 'AA:BB:CC:DD:EE:FF', type: 'W' }]);
    });

    it('delegates through instance method as well', async () => {
      (dbConfigNetwork.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ bssid: 'AA:BB:CC:DD:EE:FF', type: 'W' }],
      });

      const result = await repository.getNetworkTypesByBssids(['AA:BB:CC:DD:EE:FF']);
      expect(result).toEqual([{ bssid: 'AA:BB:CC:DD:EE:FF', type: 'W' }]);
    });
  });
});
