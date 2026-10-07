const query = jest.fn();
const transactionQuery = jest.fn();
const transactionRelease = jest.fn();
const poolConnect = jest.fn();
const buildThreatSeverityCountsQuery = jest.fn();
const Builder = jest.fn(() => ({ buildThreatSeverityCountsQuery }));

jest.mock('../../../server/src/config/database', () => ({
  pool: { connect: poolConnect },
  query,
  CONFIG: {},
}));

jest.mock('../../../server/src/logging/logger', () => ({
  logQuery: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../server/src/services/filterQueryBuilder/universalFilterQueryBuilder', () => ({
  UniversalFilterQueryBuilder: Builder,
}));

const fragments = {
  joinNetworkLocations: jest.fn(() => 'LOCATION JOIN'),
  selectLocationCoords: jest.fn(() => 'location_cols'),
  joinNetworkTagsLateral: jest.fn(() => 'TAGS JOIN'),
  joinRadioManufacturers: jest.fn(() => 'RM JOIN'),
  selectManufacturerFields: jest.fn(() => 'manufacturer_fields'),
  selectGeocodedFields: jest.fn(() => 'geocoded_fields'),
  selectThreatTagFields: jest.fn(() => 'tag_fields'),
  selectSiblingSummaryFields: jest.fn(() => 'sibling_fields'),
};

jest.mock('../../../server/src/services/filterQueryBuilder/SqlFragmentLibrary', () => ({
  SqlFragmentLibrary: fragments,
}));

const repository = require('../../../server/src/repositories/v2Repository');

describe('v2Repository coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    poolConnect.mockResolvedValue({ query: transactionQuery, release: transactionRelease });
    transactionQuery.mockResolvedValue({ rows: [] });
    Builder.mockImplementation(() => ({ buildThreatSeverityCountsQuery }));
    buildThreatSeverityCountsQuery.mockReturnValue({ sql: 'severity sql', params: ['x'] });
    fragments.joinNetworkLocations.mockReturnValue('LOCATION JOIN');
    fragments.selectLocationCoords.mockReturnValue('location_cols');
    fragments.joinNetworkTagsLateral.mockReturnValue('TAGS JOIN');
    fragments.joinRadioManufacturers.mockReturnValue('RM JOIN');
    fragments.selectManufacturerFields.mockReturnValue('manufacturer_fields');
    fragments.selectGeocodedFields.mockReturnValue('geocoded_fields');
    fragments.selectThreatTagFields.mockReturnValue('tag_fields');
    fragments.selectSiblingSummaryFields.mockReturnValue('sibling_fields');
  });

  it('aggregates severity aliases and ignores unknown severities', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { severity: 'CRITICAL', unique_networks: '2', total_observations: '5' },
        { severity: 'MED', unique_networks: '3', total_observations: '8' },
        { severity: 'medium', unique_networks: '1', total_observations: '2' },
        { severity: 'unknown', unique_networks: '9', total_observations: '9' },
      ],
    });

    const result = await repository.getThreatSeverityCounts({ tag: true }, { tag: true });

    expect(Builder).toHaveBeenCalledWith({ tag: true }, { tag: true });
    expect(result.critical).toEqual({ unique_networks: 2, total_observations: 5 });
    expect(result.medium).toEqual({ unique_networks: 4, total_observations: 10 });
  });

  it('checks whether a home marker exists', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });
    await expect(repository.checkHomeExists()).resolves.toBe(true);
    query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(repository.checkHomeExists()).resolves.toBe(false);
  });

  it('short-circuits sibling and network batch lookups for empty input', async () => {
    await expect(repository.fetchMissingSiblingRows([])).resolves.toEqual([]);
    await expect(repository.getNetworksByBssids([])).resolves.toEqual([]);
    await expect(repository.checkNetworksExist([])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns no sibling rows when every linked BSSID is already matched', async () => {
    query.mockResolvedValueOnce({ rows: [{ sibling_bssid: 'AA:BB:CC:DD:EE:FF' }] });

    await expect(repository.fetchMissingSiblingRows(['aa:bb:cc:dd:ee:ff'])).resolves.toEqual([]);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('queries full rows for missing manual siblings', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ sibling_bssid: '11:22:33:44:55:66' }] })
      .mockResolvedValueOnce({ rows: [{ bssid: '11:22:33:44:55:66' }] });

    await expect(
      repository.fetchMissingSiblingRows(['aa:bb:cc:dd:ee:ff'], 'centroid')
    ).resolves.toEqual([{ bssid: '11:22:33:44:55:66' }]);

    expect(fragments.joinNetworkLocations).toHaveBeenCalledWith('ne', 'centroid');
    expect(query.mock.calls[1][1]).toEqual([['11:22:33:44:55:66']]);
  });

  it('uses a transaction with stage-specific timeouts and degrades count-only timeout', async () => {
    transactionQuery.mockImplementation(async (sql: string) => {
      if (sql === 'count sql') {
        const error = new Error('canceling statement due to statement timeout') as Error & {
          code?: string;
        };
        error.code = '57014';
        throw error;
      }
      return { rows: [] };
    });

    const result = await repository.withFilteredNetworkRequest(async (executor: any) => {
      await executor.executeV2Query('list sql', [], 40000);
      return executor.executeOptionalCount('count sql', []);
    });

    expect(result).toBeNull();
    expect(transactionQuery).toHaveBeenCalledWith('BEGIN READ ONLY');
    expect(transactionQuery).toHaveBeenCalledWith(
      "SELECT set_config('statement_timeout', $1, true)",
      ['40000ms']
    );
    expect(transactionQuery).toHaveBeenCalledWith('SAVEPOINT filtered_count');
    expect(transactionQuery).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT filtered_count');
    expect(transactionQuery).toHaveBeenCalledWith('RELEASE SAVEPOINT filtered_count');
    expect(transactionQuery).toHaveBeenCalledWith('COMMIT');
    expect(transactionRelease).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the transaction after a list timeout', async () => {
    transactionQuery.mockImplementation(async (sql: string) => {
      if (sql === 'list sql') {
        const error = new Error('canceling statement due to statement timeout') as Error & {
          code?: string;
        };
        error.code = '57014';
        throw error;
      }
      return { rows: [] };
    });

    await expect(
      repository.withFilteredNetworkRequest((executor: any) =>
        executor.executeV2Query('list sql', [], 40000)
      )
    ).rejects.toMatchObject({ code: '57014' });

    expect(transactionQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(transactionRelease).toHaveBeenCalledTimes(1);
  });

  it('discards a client when transaction rollback fails', async () => {
    const rollbackError = new Error('rollback failed');
    transactionQuery.mockImplementation(async (sql: string) => {
      if (sql === 'list sql') {
        const error = new Error('canceling statement due to statement timeout') as Error & {
          code?: string;
        };
        error.code = '57014';
        throw error;
      }
      if (sql === 'ROLLBACK') {
        throw rollbackError;
      }
      return { rows: [] };
    });

    await expect(
      repository.withFilteredNetworkRequest((executor: any) =>
        executor.executeV2Query('list sql', [], 40000)
      )
    ).rejects.toMatchObject({ code: '57014' });

    expect(transactionRelease).toHaveBeenCalledWith(rollbackError);
  });

  it('releases a connection acquired after the request deadline', async () => {
    const lateClient = { query: transactionQuery, release: transactionRelease };
    poolConnect.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(lateClient), 30))
    );

    await expect(
      repository.withFilteredNetworkRequest(async () => undefined, Date.now() - 49990)
    ).rejects.toMatchObject({ code: '57014' });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(transactionRelease).toHaveBeenCalledTimes(1);
    expect(transactionQuery).not.toHaveBeenCalled();
  });

  it('preserves the requested page and transaction when the optional sibling supplement times out', async () => {
    transactionQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT DISTINCT')) {
        const error = new Error('canceling statement due to statement timeout') as Error & {
          code?: string;
        };
        error.code = '57014';
        throw error;
      }
      if (sql === 'count sql') {
        return { rows: [{ total: '1' }] };
      }
      return { rows: [] };
    });

    const result = await repository.withFilteredNetworkRequest(async (executor: any) => {
      const siblings = await executor.fetchMissingSiblingRows(
        ['AA:BB:CC:DD:EE:FF'],
        'latest_observation'
      );
      const count = await executor.executeOptionalCount('count sql', []);
      return { siblings, count };
    });

    expect(result).toEqual({ siblings: [], count: { rows: [{ total: '1' }] } });
    expect(transactionQuery).toHaveBeenCalledWith('SAVEPOINT filtered_sibling');
    expect(transactionQuery).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT filtered_sibling');
    expect(transactionQuery).toHaveBeenCalledWith('RELEASE SAVEPOINT filtered_sibling');
    expect(transactionQuery).toHaveBeenCalledWith('SAVEPOINT filtered_count');
    expect(transactionQuery).toHaveBeenCalledWith('COMMIT');
    expect(transactionRelease).toHaveBeenCalledTimes(1);
  });

  it('normalizes BSSIDs and returns explorer batch rows', async () => {
    query.mockResolvedValueOnce({ rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }] });

    await expect(
      repository.getNetworksByBssids(['aa:bb:cc:dd:ee:ff'], 'weighted')
    ).resolves.toEqual([{ bssid: 'AA:BB:CC:DD:EE:FF' }]);

    expect(fragments.selectSiblingSummaryFields).toHaveBeenCalledWith('ne');
    expect(query.mock.calls[0][1]).toEqual([['AA:BB:CC:DD:EE:FF']]);
  });

  it('returns uppercase BSSIDs that exist in the canonical table', async () => {
    query.mockResolvedValueOnce({ rows: [{ bssid: 'aa:bb:cc:dd:ee:ff' }] });

    await expect(repository.checkNetworksExist(['aa:bb:cc:dd:ee:ff'])).resolves.toEqual([
      'AA:BB:CC:DD:EE:FF',
    ]);
  });
});
