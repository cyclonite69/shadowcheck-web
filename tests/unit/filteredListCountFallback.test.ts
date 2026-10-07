import { createListHandler } from '../../server/src/api/routes/v2/filtered/handlers/list';

describe('filtered list count timeout fallback', () => {
  it('returns list rows and indicates an unavailable total when the count times out', async () => {
    const networkRow = {
      bssid: 'AA:BB:CC:DD:EE:FF',
      threat: { score: '0', level: 'NONE' },
    };
    const handler = createListHandler({
      filterQueryBuilder: {
        UniversalFilterQueryBuilder: class {
          buildNetworkListQuery() {
            return {
              sql: 'list query',
              params: [],
              appliedFilters: [],
              ignoredFilters: [],
              warnings: [],
            };
          }

          buildNetworkCountQuery() {
            return { sql: 'count query', params: [] };
          }
        },
        validateFilterPayload: () => ({ errors: [] }),
      },
      v2Service: {
        executeV2Query: jest.fn(),
        fetchMissingSiblingRows: jest.fn(),
        withFilteredNetworkRequest: async (work: (executor: any) => Promise<unknown>) =>
          work({
            executeV2Query: jest.fn().mockResolvedValue({ rows: [networkRow] }),
            executeOptionalCount: jest.fn().mockResolvedValue(null),
            fetchMissingSiblingRows: jest.fn().mockResolvedValue([]),
          }),
      },
      filteredAnalyticsService: {
        getFilteredAnalytics: jest.fn(),
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
      },
      validators: {
        limit: () => 1,
        offset: () => 0,
      },
    } as any);
    const res = { json: jest.fn() };

    await handler(
      {
        query: { filters: '{}', enabled: '{}', includeTotal: '1' },
      } as any,
      res as any
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ bssid: networkRow.bssid })],
        pagination: expect.objectContaining({
          total: null,
          totalUnavailable: true,
          hasMore: true,
        }),
      })
    );
  });
});
