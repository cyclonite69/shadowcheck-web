import * as https from 'https';
import { Pool } from 'pg';

const mockQuery = jest.fn();
const mockEnd = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd,
  })),
}));

jest.mock('https');

import {
  shouldSkipPoi,
  parseContext,
  reverseGeocode,
  storeResult,
  main,
} from '../../../scripts/geocoding/reverse-geocode-observations-sample';

describe('reverse-geocode-observations-sample', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null | undefined): never => {
        throw new Error(`Process.exit called with: ${code}`);
      });
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
    process.env.MAPBOX_TOKEN = 'test-token';

    // Re-establish Pool mock implementation because of jest config resetMocks: true
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query: mockQuery,
      end: mockEnd,
    }));
    mockQuery.mockResolvedValue({ rows: [] });
    mockEnd.mockResolvedValue(undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  const mockHttpsGet = (responseBody: string, statusCode = 200, error?: Error) => {
    return jest.spyOn(https, 'get').mockImplementation((url: any, cb?: any) => {
      const resMock: any = {
        statusCode,
        on: jest.fn((event, eventCb) => {
          if (event === 'data' && !error) {
            eventCb(responseBody);
          }
          if (event === 'end' && !error) {
            eventCb();
          }
          return resMock;
        }),
      };
      if (cb) {
        cb(resMock);
      }
      const reqMock: any = {
        on: jest.fn((event, eventCb) => {
          if (event === 'error' && error) {
            eventCb(error);
          }
          return reqMock;
        }),
      };
      return reqMock;
    });
  };

  describe('shouldSkipPoi', () => {
    it('returns true for MLK address cases', () => {
      expect(shouldSkipPoi('814 Martin Luther King Jr Avenue')).toBe(true);
      expect(shouldSkipPoi('816 Martin Luther King Jr Avenue')).toBe(true);
      expect(shouldSkipPoi('123 Main St')).toBe(false);
      expect(shouldSkipPoi(null)).toBe(false);
    });
  });

  describe('parseContext', () => {
    it('parses context successfully', () => {
      const context = [
        { id: 'place.123', text: 'Springfield' },
        { id: 'region.456', short_code: 'US-IL', text: 'Illinois' },
        { id: 'postcode.789', text: '62701' },
        { id: 'country.000', text: 'United States' },
      ];
      expect(parseContext(context)).toEqual({
        city: 'Springfield',
        state: 'IL',
        postal: '62701',
        country: 'United States',
      });
    });

    it('returns empty object if no context provided', () => {
      expect(parseContext(undefined)).toEqual({});
    });
  });

  describe('reverseGeocode', () => {
    it('uses v5 reverse geocoding for both and poi-only modes', async () => {
      const mockJson = JSON.stringify({
        features: [
          {
            place_type: ['poi'],
            text: 'A Venue',
            properties: { category: 'cafe' },
            place_name: 'A Venue, Springfield',
          },
          {
            place_type: ['address'],
            text: '123 St',
            relevance: 0.95,
            place_name: '123 St, Springfield',
            context: [{ id: 'place.1', text: 'Springfield' }],
          },
        ],
      });
      mockHttpsGet(mockJson);

      const res = await reverseGeocode(42.12, -83.45, 'token', 'both', false);
      expect(res.ok).toBe(true);
      expect(res.poiName).toBe('A Venue');
      expect(res.poiCategory).toBe('cafe');
      expect(res.address).toBe('123 St, Springfield');
      expect(res.city).toBe('Springfield');
      expect(res.confidence).toBe(0.95);
    });

    it('uses v6 reverse geocoding for address-only mode', async () => {
      const mockJson = JSON.stringify({
        features: [{ id: 'address.1' }],
      });
      mockHttpsGet(mockJson);

      const res = await reverseGeocode(42.12, -83.45, 'token', 'address-only', false);
      expect(res.ok).toBe(true);
    });

    it('returns ok false on status >= 400', async () => {
      mockHttpsGet('Error body', 400);
      const res = await reverseGeocode(42.12, -83.45, 'token', 'address-only', false);
      expect(res.ok).toBe(false);
    });

    it('rejects on 429 status code', async () => {
      mockHttpsGet('', 429);
      await expect(reverseGeocode(42.12, -83.45, 'token', 'address-only', false)).rejects.toThrow(
        'rate_limit'
      );
    });
  });

  describe('storeResult', () => {
    it('skips storing if store is false or not ok', async () => {
      await storeResult(
        new Pool(),
        { lat_round: 1, lon_round: 2, obs_count: 1 },
        { ok: false },
        5,
        'address-only',
        false,
        false
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('inserts coordinates into cache table', async () => {
      const row = { lat_round: 42.12, lon_round: -83.45, obs_count: 5 };
      const geo = {
        ok: true,
        address: '123 Main St',
        poiName: 'Cafe',
        poiCategory: 'food',
        featureType: 'poi',
        city: 'Flint',
        state: 'MI',
        postal: '48503',
        country: 'US',
        confidence: 0.9,
        raw: { data: 'yes' },
      };

      await storeResult(new Pool(), row, geo, 5, 'both', true, true);

      expect(mockQuery).toHaveBeenCalled();
      const args = mockQuery.mock.calls[0][1];
      expect(args[0]).toBe(5); // Precision
      expect(args[1]).toBe(42.12); // Lat round
      expect(args[5]).toBe('123 Main St');
      expect(args[6]).toBe('Cafe');
      expect(args[14]).toBe('mapbox_v5_permanent'); // Provider
    });
  });

  describe('main', () => {
    it('fails if MAPBOX_TOKEN missing', async () => {
      delete process.env.MAPBOX_TOKEN;
      await expect(main()).rejects.toThrow('Process.exit called with: 1');
      expect(errorSpy).toHaveBeenCalledWith('❌ MAPBOX_TOKEN not found in .env');
    });

    it('queries observations, samples and geocodes', async () => {
      process.argv = ['node', 'script.js', '10', '5'];
      process.env.MAPBOX_PER_MINUTE = '60000'; // Make delay 1ms for fast test execution

      const mockRows = [{ lat_round: 42.12, lon_round: -83.45, obs_count: 100 }];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const mockJson = JSON.stringify({
        features: [{ place_name: 'Main St' }],
      });
      mockHttpsGet(mockJson);

      await main();

      expect(mockQuery).toHaveBeenCalledTimes(2); // 1 for select, 1 for storeResult (end is called but Pool is mocked to handle it)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Sampling 10 unique blocks'));
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Done. 1/1 returned an address.')
      );
    });

    it('queries geocoding cache in poi-only mode', async () => {
      process.argv = [
        'node',
        'script.js',
        '10',
        '5',
        '--poi-only',
        '--poi-exclude=exclude1|exclude2',
      ];
      process.env.MAPBOX_PER_MINUTE = '60000';

      const mockRows = [
        { lat_round: 42.12, lon_round: -83.45, obs_count: 1, address: 'Test address' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });
      mockHttpsGet(JSON.stringify({ features: [] }));

      await main();

      expect(mockQuery).toHaveBeenCalledTimes(1); // select only (storeResult skipped because geo.ok is false)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('POI exclude list enabled'));
    });

    it('backs off on rate limit', async () => {
      process.argv = ['node', 'script.js', '1', '5'];
      process.env.MAPBOX_PER_MINUTE = '60000';

      const mockRows = [{ lat_round: 42.12, lon_round: -83.45, obs_count: 10 }];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      // Mock delay backoff to complete immediately
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => cb());

      jest.spyOn(https, 'get').mockImplementation((url: any, cb?: any) => {
        cb({
          statusCode: 429,
          on: (event: string, eventCb: any) => {
            if (event === 'data') {
              eventCb('');
            }
            if (event === 'end') {
              eventCb();
            }
          },
        });
        return { on: jest.fn() } as any;
      });

      await main();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Done. 0/1 returned an address.')
      );
      setTimeoutSpy.mockRestore();
    });
  });
});
