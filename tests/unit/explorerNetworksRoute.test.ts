export {};

jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../server/src/config/container', () => ({
  explorerService: {
    listNetworks: jest.fn(),
    listNetworksV2: jest.fn(),
    getNetworkByBssid: jest.fn(),
  },
  homeLocationService: {
    getCurrentHomeLocation: jest.fn(),
  },
  dataQualityFilters: {
    DATA_QUALITY_FILTERS: {
      temporal_clusters: 'temporal',
      extreme_signals: 'extreme',
      duplicate_coords: 'duplicate',
      all: () => 'all',
    },
  },
}));

// Top-level mock hoisted by Jest so explorerService is intercepted before the
// route module loads. The route calls explorerService.getNetworkByBssid directly.
jest.mock('../../server/src/services/explorerService', () => ({
  getNetworkByBssid: jest.fn(),
  listNetworks: jest.fn(),
  listNetworksV2: jest.fn(),
  checkHomeLocationForFilters: jest.fn(),
  executeExplorerQuery: jest.fn(),
}));

function createRes() {
  let resolveJson: (value: any) => void;
  const done = new Promise((resolve) => {
    resolveJson = resolve;
  });

  const res: any = {
    statusCode: 200,
    body: null,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    set(headers: Record<string, string>) {
      this.headers = { ...this.headers, ...headers };
      return this;
    },
    json(payload: any) {
      this.body = payload;
      resolveJson(payload);
      return this;
    },
  };

  return { res, done };
}

function getExplorerNetworksV2Handler() {
  const router = require('../../server/src/api/routes/v1/explorer/networks');
  const layer = router.stack.find((entry: any) => entry.route?.path === '/explorer/networks-v2');
  if (!layer) {
    throw new Error('Could not find /explorer/networks-v2 route');
  }
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function getExplorerNetworksHandler() {
  const router = require('../../server/src/api/routes/v1/explorer/networks');
  const layer = router.stack.find((entry: any) => entry.route?.path === '/explorer/networks');
  if (!layer) {
    throw new Error('Could not find /explorer/networks route');
  }
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function getNetworkByBssidHandler() {
  const router = require('../../server/src/api/routes/v1/explorer/networks');
  const layer = router.stack.find((entry: any) => entry.route?.path === '/explorer/network/:bssid');
  if (!layer) {
    throw new Error('Could not find /explorer/network/:bssid route');
  }
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('explorer/networks route', () => {
  let container: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    container = require('../../server/src/config/container');
  });

  test.each([
    ['temporal', 'temporal'],
    ['extreme', 'extreme'],
    ['duplicate', 'duplicate'],
    ['all', 'all'],
  ])('maps the %s quality filter', async (qualityFilter, expectedWhere) => {
    container.homeLocationService.getCurrentHomeLocation.mockResolvedValue({
      longitude: -83.7,
      latitude: 43.0,
    });
    container.explorerService.listNetworks.mockResolvedValue({
      total: 1,
      rows: [
        {
          bssid: 'aa:bb:cc:dd:ee:ff',
          ssid: null,
          level: -55,
          frequency: 2412,
          capabilities: '[WPA2-PSK-CCMP][ESS]',
          type: 'W',
        },
      ],
    });

    const handler = getExplorerNetworksHandler();
    const req: any = {
      query: {
        qualityFilter,
        limit: '25',
        offset: '5',
        search: 'needle',
        sort: 'ssid',
        order: 'asc',
      },
    };
    const { res, done } = createRes();

    await handler(req, res, jest.fn());
    await done;

    expect(container.explorerService.listNetworks).toHaveBeenCalledWith(
      expect.objectContaining({
        homeLon: -83.7,
        homeLat: 43.0,
        qualityWhere: expectedWhere,
        limit: 25,
        offset: 5,
        search: 'needle',
        sort: 'ssid',
        order: 'ASC',
      })
    );
    expect(res.body.rows[0]).toEqual(
      expect.objectContaining({
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: '(hidden)',
        signal: -55,
      })
    );
  });

  test('continues without a home location when lookup fails', async () => {
    container.homeLocationService.getCurrentHomeLocation.mockRejectedValue(new Error('failed'));
    container.explorerService.listNetworks.mockResolvedValue({ total: 0, rows: [] });

    const handler = getExplorerNetworksHandler();
    const { res, done } = createRes();

    await handler({ query: {} } as any, res, jest.fn());
    await done;

    expect(container.explorerService.listNetworks).toHaveBeenCalledWith(
      expect.objectContaining({ homeLon: null, homeLat: null })
    );
  });

  test('returns structured query failures', async () => {
    const error: NodeJS.ErrnoException = new Error('database unavailable');
    error.code = 'ECONNREFUSED';
    container.homeLocationService.getCurrentHomeLocation.mockResolvedValue(null);
    container.explorerService.listNetworks.mockRejectedValue(error);

    const handler = getExplorerNetworksHandler();
    const { res, done } = createRes();

    await handler({ query: {} } as any, res, jest.fn());
    await done;

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: 'networks query failed',
      code: 'ECONNREFUSED',
      message: 'database unavailable',
    });
  });
});

// ---------------------------------------------------------------------------
// /explorer/networks-v2
// ---------------------------------------------------------------------------

describe('explorer/networks-v2 route', () => {
  let container: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    container = require('../../server/src/config/container');
  });

  test('returns geocoded enrichment fields in the response row', async () => {
    const handler = getExplorerNetworksV2Handler();
    const req: any = {
      query: {
        limit: '1',
        page: '1',
        search: '',
        sort: 'last_seen',
        order: 'desc',
      },
    };
    const { res, done } = createRes();

    container.explorerService.listNetworksV2.mockResolvedValue({
      total: 1,
      rows: [
        {
          bssid: 'aa:bb:cc:dd:ee:ff',
          ssid: 'TestNet',
          observed_at: '2026-04-05T07:00:00Z',
          signal: -63,
          lat: 43.0234,
          lon: -83.6968,
          observations: 42,
          first_seen: '2026-04-01T00:00:00Z',
          last_seen: '2026-04-05T07:00:00Z',
          is_5ghz: true,
          is_6ghz: false,
          is_hidden: false,
          type: 'W',
          frequency: 5180,
          capabilities: '[WPA2-PSK-CCMP][ESS]',
          security: 'WPA2-P',
          distance_from_home_km: 1.23,
          accuracy_meters: 8,
          manufacturer: 'Acme Corp',
          manufacturer_address: '123 Vendor Way',
          geocoded_address: '123 Main St',
          geocoded_city: 'Flint',
          geocoded_state: 'MI',
          geocoded_postal_code: '48502',
          geocoded_country: 'US',
          geocoded_poi_name: 'Coffee Shop',
          geocoded_poi_category: 'cafe',
          geocoded_feature_type: 'address',
          geocoded_provider: 'mapbox',
          geocoded_confidence: 0.87,
          min_altitude_m: 34.3,
          max_altitude_m: 35.1,
          altitude_span_m: 0.8,
          max_distance_meters: 120.5,
          last_altitude_m: 34.9,
          is_sentinel: false,
          threat: { score: 0.2, level: 'LOW' },
        },
      ],
    });

    await handler(req, res, jest.fn());
    await done;

    expect(res.statusCode).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0]).toEqual(
      expect.objectContaining({
        bssid: 'AA:BB:CC:DD:EE:FF',
        geocoded_address: '123 Main St',
        geocoded_city: 'Flint',
        geocoded_state: 'MI',
        geocoded_postal_code: '48502',
        geocoded_country: 'US',
        geocoded_poi_name: 'Coffee Shop',
        geocoded_poi_category: 'cafe',
        geocoded_feature_type: 'address',
        geocoded_provider: 'mapbox',
        geocoded_confidence: 0.87,
      })
    );
    expect(res.headers['X-Total-Count']).toBe('1');
  });

  test('passes service failures to next', async () => {
    container.explorerService.listNetworksV2.mockRejectedValue(new Error('failed'));
    const handler = getExplorerNetworksV2Handler();
    const next = jest.fn();
    const { res } = createRes();

    await handler({ query: {} } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'failed' }));
  });
});

// ---------------------------------------------------------------------------
// GET /explorer/network/:bssid — alias first_seen → first_observed_at
// ---------------------------------------------------------------------------

describe('GET /explorer/network/:bssid route', () => {
  let container: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    container = require('../../server/src/config/container');
  });

  test('aliases first_seen/last_seen → first_observed_at/last_observed_at in response', async () => {
    container.explorerService.getNetworkByBssid.mockResolvedValue({
      bssid: 'AA:BB:CC:DD:EE:FF',
      ssid: 'TestNet',
      first_seen: '2025-03-01T00:00:00Z',
      last_seen: '2025-03-08T00:00:00Z',
      observations: 5,
    });

    const handler = getNetworkByBssidHandler();
    const req: any = { params: { bssid: 'AA:BB:CC:DD:EE:FF' } };
    const { res, done } = createRes();

    await handler(req, res, jest.fn());
    await done;

    expect(res.statusCode).toBe(200);
    // Original MV field names preserved
    expect(res.body.first_seen).toBe('2025-03-01T00:00:00Z');
    expect(res.body.last_seen).toBe('2025-03-08T00:00:00Z');
    // Aliased fields present for mapApiRowToNetwork compatibility
    expect(res.body.first_observed_at).toBe('2025-03-01T00:00:00Z');
    expect(res.body.last_observed_at).toBe('2025-03-08T00:00:00Z');
  });

  test('preserves existing first_observed_at when service already returns it', async () => {
    container.explorerService.getNetworkByBssid.mockResolvedValue({
      bssid: 'AA:BB:CC:DD:EE:FF',
      ssid: 'TestNet',
      first_observed_at: '2025-06-01T00:00:00Z',
      last_observed_at: '2025-06-15T00:00:00Z',
      first_seen: '2025-01-01T00:00:00Z',
      last_seen: '2025-01-31T00:00:00Z',
    });

    const handler = getNetworkByBssidHandler();
    const req: any = { params: { bssid: 'AA:BB:CC:DD:EE:FF' } };
    const { res, done } = createRes();

    await handler(req, res, jest.fn());
    await done;

    // first_observed_at already present — must not be overwritten by first_seen
    expect(res.body.first_observed_at).toBe('2025-06-01T00:00:00Z');
    expect(res.body.last_observed_at).toBe('2025-06-15T00:00:00Z');
  });

  test('returns 404 when network not found', async () => {
    container.explorerService.getNetworkByBssid.mockResolvedValue(null);

    const handler = getNetworkByBssidHandler();
    const req: any = { params: { bssid: 'DE:AD:BE:EF:00:00' } };
    const { res, done } = createRes();

    await handler(req, res, jest.fn());
    await done;

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Network not found' });
  });

  test('requires a BSSID', async () => {
    const handler = getNetworkByBssidHandler();
    const { res, done } = createRes();

    await handler({ params: { bssid: '' } } as any, res, jest.fn());
    await done;

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'bssid is required' });
  });

  test('passes detail lookup failures to next', async () => {
    container.explorerService.getNetworkByBssid.mockRejectedValue(new Error('failed'));
    const handler = getNetworkByBssidHandler();
    const next = jest.fn();
    const { res } = createRes();

    await handler({ params: { bssid: 'AA:BB:CC:DD:EE:FF' } } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'failed' }));
  });
});
