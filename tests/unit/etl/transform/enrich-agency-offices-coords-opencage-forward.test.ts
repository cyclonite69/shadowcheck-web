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
  buildQuery,
  opencageForward,
  normalizeZip5,
} from '../../../../etl/transform/enrich-agency-offices-coords-opencage-forward';
import { Pool } from 'pg';

describe('enrich-agency-offices-coords-opencage-forward', () => {
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

  describe('parseArgs', () => {
    test('returns default options', () => {
      const opts = parseArgs([]);
      expect(opts).toEqual({
        dryRun: true,
        agency: 'FBI',
        states: null,
        limit: 200,
        sleepMs: 300,
        minConfidence: 7,
      });
    });

    test('parses custom arguments', () => {
      const opts = parseArgs([
        '--live',
        '--agency=DEA',
        '--states=CA,TX',
        '--limit=50',
        '--sleep-ms=500',
        '--min-confidence=8',
      ]);
      expect(opts).toEqual({
        dryRun: false,
        agency: 'DEA',
        states: ['CA', 'TX'],
        limit: 50,
        sleepMs: 500,
        minConfidence: 8,
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
        address_line2: 'Ste C',
        city: 'City',
        state: 'CA',
        postal_code: '12345',
        normalized_address_line1: null,
        normalized_address_line2: null,
        normalized_city: null,
        normalized_state: null,
        normalized_postal_code: null,
        latitude: null,
        longitude: null,
        location: null,
      };
      expect(buildQuery(row)).toBe('123 Main St, Ste C, City, CA 12345, USA');
    });
  });

  describe('opencageForward', () => {
    test('returns coordinates on success', async () => {
      const mockResponse = {
        results: [
          {
            geometry: { lat: 37.7749, lng: -122.4194 },
            formatted: 'San Francisco, CA, USA',
            confidence: 8,
          },
        ],
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await opencageForward('key', 'SF');
      expect(res).toEqual({
        lat: 37.7749,
        lon: -122.4194,
        formatted: 'San Francisco, CA, USA',
        confidence: 8,
        raw: mockResponse,
      });
    });

    test('returns null if response has no geometry', async () => {
      const mockResponse = {
        results: [
          {
            formatted: 'SF',
          },
        ],
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });
      const res = await opencageForward('key', 'SF');
      expect(res).toBeNull();
    });

    test('returns null if response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });
      const res = await opencageForward('key', 'SF');
      expect(res).toBeNull();
    });

    test('throws rate_limit on 429', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 429,
      });
      await expect(opencageForward('key', 'SF')).rejects.toThrow('rate_limit');
    });
  });

  describe('main', () => {
    test('exits early in dry-run mode', async () => {
      process.argv = ['node', 'script.js', '--dry-run'];
      mockGetSecret.mockResolvedValueOnce('db_pass').mockResolvedValueOnce('key');
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, agency: 'FBI', name: 'Office' }] });

      await main();

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('runs live forward geocoding loop and updates DB on threshold match', async () => {
      process.argv = ['node', 'script.js', '--live', '--sleep-ms=1', '--min-confidence=7'];
      mockGetSecret.mockResolvedValueOnce('db_pass').mockResolvedValueOnce('key');

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
        normalized_address_line1: null,
        normalized_address_line2: null,
        normalized_city: null,
        normalized_state: null,
        normalized_postal_code: null,
        latitude: null,
        longitude: null,
        location: null,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [candidateRow] }) // Selection query
        .mockResolvedValueOnce({ rowCount: 1 }); // Update query

      const mockResponse = {
        results: [
          {
            geometry: { lat: 37.7, lng: -122.1 },
            formatted: 'Formatted address',
            confidence: 8, // Higher than threshold of 7
          },
        ],
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await main();

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('UPDATE app.agency_offices'),
        [1, 37.7, -122.1, expect.any(String)]
      );
    });

    test('does not update coordinate fields but stores suggested metadata if confidence is below threshold', async () => {
      process.argv = ['node', 'script.js', '--live', '--sleep-ms=1', '--min-confidence=8'];
      mockGetSecret.mockResolvedValueOnce('db_pass').mockResolvedValueOnce('key');

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
        normalized_address_line1: null,
        normalized_address_line2: null,
        normalized_city: null,
        normalized_state: null,
        normalized_postal_code: null,
        latitude: null,
        longitude: null,
        location: null,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [candidateRow] }) // Selection query
        .mockResolvedValueOnce({ rowCount: 1 }); // Update query for suggested coords

      const mockResponse = {
        results: [
          {
            geometry: { lat: 37.7, lng: -122.1 },
            formatted: 'Formatted address',
            confidence: 5, // Lower than threshold of 8
          },
        ],
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await main();

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('coords_opencage_suggested'),
        [1, expect.any(String)]
      );
    });
  });
});
