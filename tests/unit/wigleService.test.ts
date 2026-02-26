/**
 * WiGLE Service Tests
 */

import {
  getWigleNetworkByBSSID,
  searchWigleDatabase,
  getWigleV2Networks,
  getWigleV2NetworksCount,
  checkWigleV3TableExists,
} from '../../server/src/services/wigleService';

const mockQuery = jest.fn();
jest.mock('../../server/src/config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

describe('WiGLE Service', () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  describe('getWigleNetworkByBSSID', () => {
    it('returns network when found', async () => {
      const mockNetwork = {
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'TestNetwork',
        encryption: 'WPA2',
        trilat: 40.7128,
        trilon: -74.006,
      };
      mockQuery.mockResolvedValue({ rows: [mockNetwork] });

      const result = await getWigleNetworkByBSSID('AA:BB:CC:DD:EE:FF');

      expect(result).toEqual(mockNetwork);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('wigle_networks_enriched'), [
        'AA:BB:CC:DD:EE:FF',
      ]);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getWigleNetworkByBSSID('00:00:00:00:00:00');

      expect(result).toBeNull();
    });
  });

  describe('searchWigleDatabase', () => {
    it('searches by BSSID when provided', async () => {
      mockQuery.mockResolvedValue({ rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }] });

      await searchWigleDatabase({ bssid: 'AA:BB', limit: 10 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('bssid ILIKE'),
        expect.arrayContaining(['%AA:BB%', 10])
      );
    });

    it('searches by SSID when BSSID not provided', async () => {
      mockQuery.mockResolvedValue({ rows: [{ ssid: 'TestNet' }] });

      await searchWigleDatabase({ ssid: 'Test', limit: 10 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ssid ILIKE'),
        expect.arrayContaining(['%Test%', 10])
      );
    });

    it('omits LIMIT when limit is null', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await searchWigleDatabase({ ssid: 'Test', limit: null });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('LIMIT');
    });
  });

  describe('getWigleV2Networks', () => {
    it('builds query with WHERE clauses', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await getWigleV2Networks({
        limit: 10,
        offset: 0,
        whereClauses: ['type = $1'],
        queryParams: ['WiFi'],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE type = $1'),
        expect.arrayContaining(['WiFi', 10, 0])
      );
    });

    it('omits WHERE when no clauses provided', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await getWigleV2Networks({
        limit: 10,
        offset: 0,
        whereClauses: [],
        queryParams: [],
      });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('WHERE');
    });
  });

  describe('getWigleV2NetworksCount', () => {
    it('returns count as number', async () => {
      mockQuery.mockResolvedValue({ rows: [{ total: '42' }] });

      const result = await getWigleV2NetworksCount(['type = $1'], ['WiFi']);

      expect(result).toBe(42);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        expect.arrayContaining(['WiFi'])
      );
    });
  });

  describe('checkWigleV3TableExists', () => {
    it('returns true when table exists', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: true }] });

      const result = await checkWigleV3TableExists();

      expect(result).toBe(true);
    });

    it('returns false when table does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: false }] });

      const result = await checkWigleV3TableExists();

      expect(result).toBe(false);
    });

    it('returns false when query returns no rows', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await checkWigleV3TableExists();

      expect(result).toBe(false);
    });
  });
});
