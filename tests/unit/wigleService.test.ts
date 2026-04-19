/**
 * WiGLE Service Tests
 */

import {
  getWiglePageNetwork,
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
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.wigle_v2_networks_search'),
        ['AA:BB:CC:DD:EE:FF']
      );
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

  describe('getWiglePageNetwork', () => {
    it('prefers v3 detail and adds local match metadata', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              netid: 'AA:BB:CC:DD:EE:FF',
              ssid: 'DetailNet',
              type: 'wifi',
              encryption: 'WPA2',
              channel: 11,
              qos: 5,
              first_seen: '2024-01-01T00:00:00Z',
              last_seen: '2024-01-02T00:00:00Z',
              last_update: '2024-01-03T00:00:00Z',
              trilat: 40.1,
              trilon: -74.1,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ local_observations: 3 }] });

      const result = await getWiglePageNetwork('AA:BB:CC:DD:EE:FF');

      expect(result).toMatchObject({
        netid: 'AA:BB:CC:DD:EE:FF',
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'DetailNet',
        firsttime: '2024-01-01T00:00:00Z',
        lasttime: '2024-01-02T00:00:00Z',
        lastupdt: '2024-01-03T00:00:00Z',
        local_observations: 3,
        wigle_match: true,
        wigle_source: 'wigle-v3',
      });
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('falls back to v2 summary when v3 detail is absent', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              bssid: '11:22:33:44:55:66',
              ssid: 'V2Net',
              type: 'wifi',
              encryption: 'WPA3',
              channel: 36,
              frequency: 5180,
              qos: 4,
              firsttime: '2024-02-01T00:00:00Z',
              lasttime: '2024-02-02T00:00:00Z',
              lastupdt: '2024-02-03T00:00:00Z',
              trilat: 41.1,
              trilong: -73.9,
              source: 'wigle_api_search',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ local_observations: 0 }] });

      const result = await getWiglePageNetwork('11:22:33:44:55:66');

      expect(result).toMatchObject({
        netid: '11:22:33:44:55:66',
        bssid: '11:22:33:44:55:66',
        ssid: 'V2Net',
        frequency: 5180,
        local_observations: null,
        wigle_match: false,
        wigle_source: 'wigle-v2',
      });
    });

    it('returns null when no WiGLE page record exists', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ local_observations: 0 }] });

      const result = await getWiglePageNetwork('00:00:00:00:00:00');

      expect(result).toBeNull();
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
