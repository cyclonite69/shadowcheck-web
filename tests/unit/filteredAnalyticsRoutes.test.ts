describe('filtered analytics routes are service-backed', () => {
  const invokeGetRoute = async (
    router: any,
    path: string,
    query: Record<string, string> = {}
  ): Promise<{ status: number; body: any }> => {
    const layer = router.stack.find(
      (entry: any) => entry.route?.path === path && entry.route?.methods?.get
    );
    if (!layer) {
      throw new Error(`GET route not found: ${path}`);
    }

    const handler = layer.route.stack[0].handle;
    return await new Promise((resolve, reject) => {
      const req: any = { query };
      let statusCode = 200;
      let body: any;
      const res: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: any) {
          body = payload;
          resolve({ status: statusCode, body });
          return this;
        },
      };

      try {
        const maybePromise = handler(req, res, (err: unknown) => {
          if (err) reject(err);
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('v2 /api/v2/networks/filtered/analytics delegates to getFilteredAnalytics', async () => {
    const getFilteredAnalytics = jest.fn().mockResolvedValue({
      data: {
        networkTypes: [{ type: 'W', count: 1 }],
        signalStrength: [],
        security: [],
        threatDistribution: [],
        temporalActivity: [],
        radioTypeOverTime: [],
        threatTrends: [],
        topNetworks: [],
      },
      queryDurationMs: 12,
    });

    jest.doMock('../../server/src/config/container', () => ({
      filterQueryBuilder: {
        UniversalFilterQueryBuilder: class UniversalFilterQueryBuilder {},
        validateFilterPayload: () => ({ errors: [] }),
      },
      filteredAnalyticsService: { getFilteredAnalytics },
      v2Service: {
        executeV2Query: jest.fn(),
        checkHomeExists: jest.fn().mockResolvedValue(true),
      },
    }));

    const router = require('../../server/src/api/routes/v2/filtered');
    const res = await invokeGetRoute(router, '/analytics', { filters: '{}', enabled: '{}' });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(getFilteredAnalytics).toHaveBeenCalledWith({}, {}, 'geospatial');
    expect(res.body?.data?.networkTypes).toEqual([{ type: 'W', count: 1 }]);
  });

  test('v1 /analytics-public/filtered delegates to getFilteredAnalytics', async () => {
    const getFilteredAnalytics = jest.fn().mockResolvedValue({
      data: {
        networkTypes: [{ type: 'W', count: 2 }],
        signalStrength: [],
        security: [],
        threatDistribution: [],
        temporalActivity: [],
        radioTypeOverTime: [],
        threatTrends: [],
        topNetworks: [],
      },
      queryDurationMs: 8,
    });

    jest.doMock('../../server/src/config/container', () => ({
      filterQueryBuilder: {
        validateFilterPayload: () => ({ errors: [] }),
      },
      filteredAnalyticsService: { getFilteredAnalytics },
      v2Service: {
        checkHomeExists: jest.fn().mockResolvedValue(true),
      },
    }));

    const router = require('../../server/src/api/routes/v1/analytics-public');
    const res = await invokeGetRoute(router, '/filtered', { filters: '{}', enabled: '{}' });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(getFilteredAnalytics).toHaveBeenCalledWith({}, {}, 'geospatial');
    expect(res.body?.data?.networkTypes).toEqual([{ type: 'W', count: 2 }]);
  });
});
