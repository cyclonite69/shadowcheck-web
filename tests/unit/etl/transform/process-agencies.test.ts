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

import { enrichZip4, normalizePhones, main } from '../../../../etl/transform/process-agencies';
import { Pool } from 'pg';

describe('process-agencies', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query: (...args: any[]) => mockQuery(...args),
      end: (...args: any[]) => mockEnd(...args),
    }));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    global.fetch = jest.fn();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('resolveDbHost', () => {
    it('should resolve database host using dns lookup', async () => {
      process.env.DB_HOST = 'example.com';
      mockLookup.mockResolvedValueOnce({});
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await normalizePhones({ dryRun: false });

      expect(mockLookup).toHaveBeenCalledWith('example.com');
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({ host: 'example.com' }));
    });

    it('should fallback to localhost if dns lookup fails', async () => {
      process.env.DB_HOST = 'badhost';
      mockLookup.mockRejectedValueOnce(new Error('not found'));
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await normalizePhones({ dryRun: false });

      expect(mockLookup).toHaveBeenCalledWith('badhost');
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({ host: 'localhost' }));
    });

    it('should default host to localhost if shadowcheck_postgres', async () => {
      process.env.DB_HOST = 'shadowcheck_postgres';
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await normalizePhones({ dryRun: false });

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({ host: 'localhost' }));
    });
  });

  describe('normalizePhones', () => {
    it('should not query db if dryRun is true', async () => {
      await normalizePhones({ dryRun: true });
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should run normalizePhones successfully in live mode', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 5 });

      await expect(normalizePhones({ dryRun: false })).resolves.toBeUndefined();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('enrichZip4', () => {
    it('should throw if Smarty credentials are not found', async () => {
      mockGetSecret.mockResolvedValue(null);
      delete process.env.SMARTY_AUTH_ID;
      delete process.env.SMARTY_AUTH_TOKEN;

      await expect(
        enrichZip4({
          limit: 10,
          batchSize: 5,
          sleepMs: 1,
          dryRun: false,
          withCoordinates: false,
          testAuthOnly: false,
          states: null,
        })
      ).rejects.toThrow(/Smarty credentials not configured/);
    });

    it('should make a single test request if testAuthOnly is true', async () => {
      mockGetSecret.mockResolvedValue('test-secret');
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await enrichZip4({
        limit: 10,
        batchSize: 5,
        sleepMs: 1,
        dryRun: false,
        withCoordinates: false,
        testAuthOnly: true,
        states: null,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should select candidate rows but not fetch/update if dryRun is true', async () => {
      mockGetSecret.mockResolvedValue('test-secret');
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Office 1',
            address_line1: '123 Main St',
            city: 'Louisville',
            state: 'KY',
            postal_code: '40202',
          },
        ],
      });

      await enrichZip4({
        limit: 10,
        batchSize: 5,
        sleepMs: 1,
        dryRun: true,
        withCoordinates: false,
        testAuthOnly: false,
        states: null,
      });

      expect(mockQuery).toHaveBeenCalledTimes(1); // Only select query
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should run live enrichment and update db on successful candidate match', async () => {
      mockGetSecret.mockResolvedValue('test-secret');
      const mockFetch = global.fetch as jest.Mock;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Office 1',
            address_line1: '123 Main St',
            address_line2: 'Suite 100',
            city: 'Louisville',
            state: 'KY',
            postal_code: '40202',
            normalized_address_line1: null,
            normalized_city: null,
            normalized_state: null,
            normalized_postal_code: null,
            latitude: null,
            longitude: null,
            location: null,
          },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            input_id: '1',
            delivery_line_1: '123 Main St Ste 100',
            delivery_line_2: '',
            last_line: 'Louisville KY 40202-1234',
            components: {
              city_name: 'Louisville',
              state_abbreviation: 'KY',
              zipcode: '40202',
              plus4_code: '1234',
            },
            analysis: {
              dpv_match_code: 'Y',
              footnotes: 'AABB',
            },
            metadata: {
              latitude: 38.25,
              longitude: -85.75,
            },
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await enrichZip4({
        limit: 10,
        batchSize: 5,
        sleepMs: 1,
        dryRun: false,
        withCoordinates: true,
        testAuthOnly: false,
        states: ['KY'],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should skip rows with zip mismatch or existing zip+4', async () => {
      mockGetSecret.mockResolvedValue('test-secret');
      const mockFetch = global.fetch as jest.Mock;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Office 1',
            address_line1: '123 Main St',
            city: 'Louisville',
            state: 'KY',
            postal_code: '40202',
          },
        ],
      });

      // Match returned but zipcode is 40205 (mismatch from 40202)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            input_id: '1',
            delivery_line_1: '123 Main St',
            components: {
              city_name: 'Louisville',
              state_abbreviation: 'KY',
              zipcode: '40205',
              plus4_code: '1234',
            },
          },
        ],
      });

      await enrichZip4({
        limit: 10,
        batchSize: 5,
        sleepMs: 1,
        dryRun: false,
        withCoordinates: false,
        testAuthOnly: false,
        states: null,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledTimes(1); // Only the select query
    });

    it('should throw if Smarty candidate API returns unauthorized or error status', async () => {
      mockGetSecret.mockResolvedValue('test-secret');
      const mockFetch = global.fetch as jest.Mock;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Office 1',
            address_line1: '123 Main St',
            city: 'Louisville',
            state: 'KY',
            postal_code: '40202',
          },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized access',
      });

      await expect(
        enrichZip4({
          limit: 10,
          batchSize: 5,
          sleepMs: 1,
          dryRun: false,
          withCoordinates: false,
          testAuthOnly: false,
          states: null,
        })
      ).rejects.toThrow(/Smarty HTTP 401/);
    });

    it('should throw other HTTP errors from Smarty API', async () => {
      mockGetSecret.mockResolvedValue('test-secret');
      const mockFetch = global.fetch as jest.Mock;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Office 1',
            address_line1: '123 Main St',
            city: 'Louisville',
            state: 'KY',
            postal_code: '40202',
          },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        enrichZip4({
          limit: 10,
          batchSize: 5,
          sleepMs: 1,
          dryRun: false,
          withCoordinates: false,
          testAuthOnly: false,
          states: null,
        })
      ).rejects.toThrow(/Smarty HTTP 500/);
    });

    it('should throw error if Smarty API returns non-array payload', async () => {
      mockGetSecret.mockResolvedValue('test-secret');
      const mockFetch = global.fetch as jest.Mock;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Office 1',
            address_line1: '123 Main St',
            city: 'Louisville',
            state: 'KY',
            postal_code: '40202',
          },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'error' }),
      });

      await expect(
        enrichZip4({
          limit: 10,
          batchSize: 5,
          sleepMs: 1,
          dryRun: false,
          withCoordinates: false,
          testAuthOnly: false,
          states: null,
        })
      ).rejects.toThrow(/Unexpected Smarty response/);
    });
  });

  describe('main', () => {
    it('should do nothing if isMain is false', async () => {
      await main(false);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should execute enrich and normalize if isMain is true', async () => {
      mockGetSecret.mockResolvedValue('test-secret');
      mockQuery.mockResolvedValueOnce({ rows: [] }); // SELECT agency_offices in enrichZip4
      mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // UPDATE query in normalizePhones

      await main(true, ['node', 'script', '--live']);

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });
});
