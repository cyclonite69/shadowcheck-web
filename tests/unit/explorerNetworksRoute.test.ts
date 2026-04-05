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
});
