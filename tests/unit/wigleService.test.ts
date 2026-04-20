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
    // Mock order: v3Detail, v2Summary, localMatch, v3Temporal (Promise.all — 4 queries)
    const v3DetailRow = {
      netid: 'AA:BB:CC:DD:EE:FF',
      ssid: 'DetailNet',
      type: 'wifi',
      encryption: 'WPA2',
      channel: 11,
      qos: 5,
      last_update: '2024-01-03T00:00:00Z',
      trilat: 40.1,
      trilon: -74.1,
      oui_manufacturer: 'TestCo',
    };
    const v3TemporalRow = {
      wigle_v3_first_seen: '2024-01-01T00:00:00Z',
      wigle_v3_last_seen: '2024-01-02T00:00:00Z',
      wigle_v3_observation_count: 5,
      wigle_precision_warning: false,
      wigle_v3_centroid_lat: 40.1,
      wigle_v3_centroid_lon: -74.1,
      wigle_v3_ssid_variant_count: 1,
      wigle_v3_spread_m: 0,
    };

    it('returns structured { wigle, localLinkage } preferring v3 and obs-derived temporal', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [v3DetailRow] }) // v3Detail
        .mockResolvedValueOnce({ rows: [] }) // v2Summary
        .mockResolvedValueOnce({ rows: [{ has_local_match: true, local_observation_count: 3 }] })
        .mockResolvedValueOnce({ rows: [v3TemporalRow] }); // v3Temporal

      const result = await getWiglePageNetwork('AA:BB:CC:DD:EE:FF');

      expect(result).not.toBeNull();
      expect(result!.wigle).toMatchObject({
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'DetailNet',
        wigle_source: 'wigle-v3',
        wigle_v3_first_seen: '2024-01-01T00:00:00Z',
        wigle_v3_last_seen: '2024-01-02T00:00:00Z',
        wigle_v3_observation_count: 5,
        manufacturer: 'TestCo',
        has_wigle_v3_observations: true,
        has_wigle_v2_record: false,
      });
      expect(result!.localLinkage).toEqual({ has_local_match: true, local_observation_count: 3 });
      expect(mockQuery).toHaveBeenCalledTimes(4);
    });

    it('falls back to v2 summary fields when v3 detail is absent', async () => {
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
              oui_manufacturer: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ has_local_match: false, local_observation_count: 0 }] })
        .mockResolvedValueOnce({
          rows: [{ wigle_v3_observation_count: 0, wigle_precision_warning: true }],
        });

      const result = await getWiglePageNetwork('11:22:33:44:55:66');

      expect(result).not.toBeNull();
      expect(result!.wigle).toMatchObject({
        bssid: '11:22:33:44:55:66',
        ssid: 'V2Net',
        frequency: 5180,
        wigle_source: 'wigle-v2',
        has_wigle_v2_record: true,
        has_wigle_v3_observations: false,
        wigle_v2_firsttime: '2024-02-01T00:00:00Z',
      });
      expect(result!.localLinkage).toEqual({ has_local_match: false, local_observation_count: 0 });
    });

    it('returns null when neither v3 nor v2 record exists', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ has_local_match: false, local_observation_count: 0 }] })
        .mockResolvedValueOnce({ rows: [{ wigle_v3_observation_count: 0 }] });

      const result = await getWiglePageNetwork('00:00:00:00:00:00');

      expect(result).toBeNull();
    });

    it('sets public_nonstationary_flag when v3 spread exceeds 500m', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ ...v3DetailRow }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ has_local_match: false, local_observation_count: 0 }] })
        .mockResolvedValueOnce({
          rows: [{ ...v3TemporalRow, wigle_v3_spread_m: 1200, wigle_v3_observation_count: 8 }],
        });

      const result = await getWiglePageNetwork('AA:BB:CC:DD:EE:FF');

      expect(result!.wigle.public_nonstationary_flag).toBe(true);
    });

    it('sets public_ssid_variant_flag when multiple distinct SSIDs observed', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ ...v3DetailRow }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ has_local_match: false, local_observation_count: 0 }] })
        .mockResolvedValueOnce({
          rows: [
            { ...v3TemporalRow, wigle_v3_ssid_variant_count: 3, wigle_v3_observation_count: 6 },
          ],
        });

      const result = await getWiglePageNetwork('AA:BB:CC:DD:EE:FF');

      expect(result!.wigle.public_ssid_variant_flag).toBe(true);
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
