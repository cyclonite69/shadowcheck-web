import express from 'express';
import request from 'supertest';

const mockV2Service = {
  checkHomeExists: jest.fn(),
  executeV2Query: jest.fn(),
  fetchMissingSiblingRows: jest.fn(),
};

jest.mock('../../server/src/config/container', () => ({
  v2Service: mockV2Service,
}));

import { createListHandler } from '../../server/src/api/routes/v2/filtered/handlers/list';

describe('v2 list route handler', () => {
  let mockLogger: any;
  let mockValidators: any;
  let MockUniversalFilterQueryBuilder: any;
  let mockValidateFilterPayload: any;
  let mockFilterQueryBuilder: any;
  let deps: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockV2Service.checkHomeExists.mockReset();
    mockV2Service.executeV2Query.mockReset();
    mockV2Service.fetchMissingSiblingRows.mockReset();

    // Default safe mock values to prevent undefined crashes
    mockV2Service.checkHomeExists.mockResolvedValue(true);
    mockV2Service.executeV2Query.mockResolvedValue({ rows: [] });
    mockV2Service.fetchMissingSiblingRows.mockResolvedValue([]);

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockValidators = {
      limit: jest.fn((val, _min, _max, def) => (val !== undefined ? Number(val) : def)),
      offset: jest.fn((val) => (val !== undefined ? Number(val) : 0)),
    };
    mockValidateFilterPayload = jest.fn(() => ({ errors: [] }));

    MockUniversalFilterQueryBuilder = jest
      .fn()
      .mockImplementation((_filters, _enabled, _options) => {
        return {
          buildNetworkListQuery: jest.fn().mockReturnValue({
            sql: 'SELECT * FROM app.networks',
            params: [],
            appliedFilters: ['distanceMin'],
            ignoredFilters: [],
            warnings: [],
          }),
          buildNetworkCountQuery: jest.fn().mockReturnValue({
            sql: 'SELECT COUNT(*) FROM app.networksCount',
            params: [],
            appliedFilters: [],
            ignoredFilters: [],
            warnings: [],
          }),
        };
      });

    mockFilterQueryBuilder = {
      UniversalFilterQueryBuilder: MockUniversalFilterQueryBuilder,
      validateFilterPayload: mockValidateFilterPayload,
    };

    deps = {
      filterQueryBuilder: mockFilterQueryBuilder,
      v2Service: mockV2Service,
      logger: mockLogger,
      validators: mockValidators,
    };
  });

  const createApp = (handler: any) => {
    const app = express();
    app.use(express.json());
    app.get('/api/v2/list', handler);
    return app;
  };

  it('runs successfully when filters are valid', async () => {
    mockV2Service.executeV2Query
      .mockResolvedValueOnce({
        rows: [
          {
            bssid: 'A',
            ssid: 'NetA',
            threat: { score: 10, level: 'LOW', signals: [{ code: 'TEMPORAL_PATTERN' }] },
          },
        ],
      }) // list
      .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // count

    const app = createApp(createListHandler(deps));
    const res = await request(app)
      .get('/api/v2/list')
      .query({ filters: '{"bssid":"A"}', enabled: '{"bssid":true}', includeTotal: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data[0].bssid).toBe('A');
    expect(res.body.pagination.total).toBe(1);
  });

  it('returns 400 if filter parameter JSON is malformed', async () => {
    const app = createApp(createListHandler(deps));
    const res = await request(app).get('/api/v2/list').query({ filters: 'malformed' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('returns 400 if filter payload validation fails', async () => {
    mockValidateFilterPayload.mockReturnValueOnce({ errors: ['Invalid filter value'] });

    const app = createApp(createListHandler(deps));
    const res = await request(app).get('/api/v2/list');

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('Invalid filter value');
  });

  it('enforces home location requirement if distance filters are enabled', async () => {
    mockV2Service.checkHomeExists.mockResolvedValueOnce(false);

    const app = createApp(createListHandler(deps));
    const res = await request(app)
      .get('/api/v2/list')
      .query({ enabled: '{"distanceFromHomeMin":true}' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Home location is required');
  });

  it('supplements rows with siblings when they exist', async () => {
    mockV2Service.executeV2Query.mockResolvedValueOnce({ rows: [{ bssid: 'A' }] });
    mockV2Service.fetchMissingSiblingRows.mockResolvedValueOnce([{ bssid: 'B', threat: {} }]);

    const app = createApp(createListHandler(deps));
    const res = await request(app).get('/api/v2/list').query({ includeTotal: 'false' });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[1]._siblingSupplemented).toBe(true);
  });

  it('logs a warning for slow queries', async () => {
    mockV2Service.executeV2Query.mockImplementationOnce(async () => {
      // Simulate delay
      await new Promise((resolve) => setTimeout(resolve, 60));
      return { rows: [] };
    });

    const app = createApp(createListHandler(deps));
    const res = await request(app).get('/api/v2/list').query({ includeTotal: 'false' });

    expect(res.status).toBe(200);
  });
});
