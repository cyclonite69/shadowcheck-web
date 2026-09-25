const mockQuery = jest.fn();
const mockEnd = jest.fn();
const mockLookup = jest.fn();
const mockGetSecret = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(),
}));

jest.mock('dns/promises', () => ({
  lookup: (...args: any[]) => mockLookup(...args),
}));

jest.mock('../../../../server/src/services/secretsManager', () => ({
  getSecret: (...args: any[]) => mockGetSecret(...args),
}));

import {
  main,
  parseArgs,
  resolveDbHost,
  countryForState,
  buildQuery,
  nominatimSearch,
  nominatimSearchStructured,
  normalizeZip5,
} from '../../../../etl/transform/enrich-agency-offices-coords-nominatim';
import { Pool } from 'pg';

describe('enrich-agency-offices-coords-nominatim', () => {
  const originalEnv = { ...process.env };
  const originalArgv = [...process.argv];

  beforeEach(() => {
    jest.clearAllMocks();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query: (...args: any[]) => mockQuery(...args),
      end: (...args: any[]) => mockEnd(...args),
    }));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  describe('normalizeZip5', () => {
    test('returns null for null or empty', () => {
      expect(normalizeZip5(null)).toBeNull();
      expect(normalizeZip5('')).toBeNull();
    });

    test('extracts zip5', () => {
      expect(normalizeZip5('12345')).toBe('12345');
      expect(normalizeZip5('12345-6789')).toBe('12345');
    });
  });

  describe('countryForState', () => {
    test('resolves country code based on state', () => {
      expect(countryForState('CA')).toBe('USA');
      expect(countryForState('PR')).toBe('Puerto Rico');
      expect(countryForState('VI')).toBe('US Virgin Islands');
      expect(countryForState('vi')).toBe('US Virgin Islands');
    });
  });

  describe('parseArgs', () => {
    test('returns default options', () => {
      const opts = parseArgs([]);
      expect(opts).toEqual({
        dryRun: true,
        agency: 'FBI',
        limit: 500,
        sleepMs: 1100,
        states: null,
      });
    });

    test('parses custom arguments', () => {
      const opts = parseArgs([
        '--live',
        '--agency=DEA',
        '--limit=150',
        '--sleep-ms=1500',
        '--states=CA,PR',
      ]);
      expect(opts).toEqual({
        dryRun: false,
        agency: 'DEA',
        limit: 150,
        sleepMs: 1500,
        states: ['CA', 'PR'],
      });
    });
  });

  describe('resolveDbHost', () => {
    test('uses DB_HOST and resolves via dns', async () => {
      process.env.DB_HOST = 'custom_host';
      mockLookup.mockResolvedValueOnce({});
      const host = await resolveDbHost();
      expect(host).toBe('custom_host');
    });

    test('falls back to localhost on dns failure', async () => {
      process.env.DB_HOST = 'custom_host';
      mockLookup.mockRejectedValueOnce(new Error('fail'));
      const host = await resolveDbHost();
      expect(host).toBe('localhost');
    });
  });

  describe('buildQuery', () => {
    test('builds query with standard address', () => {
      const row = {
        id: 1,
        agency: 'FBI',
        office_type: 'FO',
        name: 'Office',
        address_line1: '123 Main St',
        address_line2: 'Ste B',
        city: 'City',
        state: 'CA',
        postal_code: '12345',
        latitude: null,
        longitude: null,
        location: null,
      };
      expect(buildQuery(row)).toBe('123 Main St, Ste B, City, CA 12345, USA');
    });
  });

  describe('nominatimSearch', () => {
    test('returns coordinate result on success', async () => {
      const mockResult = [
        {
          lat: '37.7749',
          lon: '-122.4194',
          display_name: 'San Francisco, CA',
        },
      ];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const res = await nominatimSearch('SF');
      expect(res).toEqual(mockResult[0]);
    });

    test('returns null if response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });
      const res = await nominatimSearch('SF');
      expect(res).toBeNull();
    });

    test('throws rate_limit on 429', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 429,
      });
      await expect(nominatimSearch('SF')).rejects.toThrow('rate_limit');
    });
  });

  describe('nominatimSearchStructured', () => {
    test('returns coordinate result on success', async () => {
      const mockResult = [
        {
          lat: '37.7749',
          lon: '-122.4194',
          display_name: 'San Francisco, CA',
        },
      ];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const res = await nominatimSearchStructured({ street: '123 Main', city: 'SF', state: 'CA' });
      expect(res).toEqual(mockResult[0]);
    });
  });

  describe('main', () => {
    test('exits early in dry-run mode', async () => {
      process.argv = ['node', 'script.js', '--dry-run'];
      mockGetSecret.mockResolvedValueOnce('db_pass');
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, agency: 'FBI', name: 'Office' }] });

      await main();

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('runs live forward geocoding loop (structured search first, then unstructured fallback)', async () => {
      process.argv = ['node', 'script.js', '--live', '--sleep-ms=1'];
      mockGetSecret.mockResolvedValueOnce('db_pass');

      const candidateRow = {
        id: 1,
        agency: 'FBI',
        office_type: 'FO',
        name: 'Office',
        address_line1: '123 Main St',
        address_line2: null,
        city: 'City',
        state: 'CA',
        postal_code: '12345',
        latitude: null,
        longitude: null,
        location: null,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [candidateRow] }) // Selection query
        .mockResolvedValueOnce({ rowCount: 1 }); // Update query

      const mockResult = [
        {
          lat: '37.7749',
          lon: '-122.4194',
          display_name: 'San Francisco, CA',
        },
      ];

      // Nominatim structured search returns no match
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        // Unstructured query fallback search returns success
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResult,
        });

      await main();

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('UPDATE app.agency_offices'),
        [1, 37.7749, -122.4194, expect.any(String)]
      );
    });
  });
});
