import {
  fetchRows,
  loadCacheStats,
  providerPriority,
  seedAddressCandidates,
  shouldReplaceAddressData,
  shouldSkipPoi,
  upsertGeocodeCacheBatch,
} from '../../../../server/src/services/geocoding/cacheStore';
import { query } from '../../../../server/src/config/database';

jest.mock('../../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('cacheStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldSkipPoi', () => {
    it('should return true for MLK addresses', () => {
      expect(shouldSkipPoi('814 Martin Luther King Blvd')).toBe(true);
      expect(shouldSkipPoi('816 Martin Luther King Ave')).toBe(true);
      expect(shouldSkipPoi('815 Martin Luther King')).toBe(false);
    });

    it('should return false for other addresses', () => {
      expect(shouldSkipPoi('123 Main St')).toBe(false);
      expect(shouldSkipPoi('')).toBe(false);
      expect(shouldSkipPoi(null)).toBe(false);
    });
  });

  describe('providerPriority', () => {
    it('should return correct priorities', () => {
      expect(providerPriority('mapbox_v5_permanent')).toBe(5);
      expect(providerPriority('mapbox_v5')).toBe(4);
      expect(providerPriority('mapbox')).toBe(4);
      expect(providerPriority('locationiq')).toBe(3);
      expect(providerPriority('geocodio')).toBe(2);
      expect(providerPriority('opencage')).toBe(1);
      expect(providerPriority('unknown')).toBe(0);
      expect(providerPriority(null)).toBe(0);
    });
  });

  describe('shouldReplaceAddressData', () => {
    it('should return false if incoming is not ok or has no address', () => {
      expect(shouldReplaceAddressData({ address: 'old' }, { ok: false } as any)).toBe(false);
      expect(shouldReplaceAddressData({ address: 'old' }, { ok: true, address: null } as any)).toBe(
        false
      );
    });

    it('should return true if current has no address', () => {
      expect(shouldReplaceAddressData({ address: null }, { ok: true, address: 'new' } as any)).toBe(
        true
      );
    });

    it('should return true if confidence is significantly higher', () => {
      expect(
        shouldReplaceAddressData({ address: 'old', confidence: 0.5 }, {
          ok: true,
          address: 'new',
          confidence: 0.61,
        } as any)
      ).toBe(true);
    });

    it('should return false if confidence is not significantly higher', () => {
      expect(
        shouldReplaceAddressData({ address: 'old', confidence: 0.5 }, {
          ok: true,
          address: 'new',
          confidence: 0.55,
        } as any)
      ).toBe(false);
    });

    it('should use provider priority if confidence is similar', () => {
      // 0.53 - 0.5 = 0.03 (<= 0.05)
      expect(
        shouldReplaceAddressData({ address: 'old', confidence: 0.5, provider: 'opencage' }, {
          ok: true,
          address: 'new',
          confidence: 0.53,
          provider: 'mapbox',
        } as any)
      ).toBe(true);

      expect(
        shouldReplaceAddressData({ address: 'old', confidence: 0.5, provider: 'mapbox' }, {
          ok: true,
          address: 'new',
          confidence: 0.53,
          provider: 'opencage',
        } as any)
      ).toBe(false);
    });
  });

  describe('upsertGeocodeCacheBatch', () => {
    it('should do nothing if entries are empty', async () => {
      await upsertGeocodeCacheBatch(5, []);
      expect(query).not.toHaveBeenCalled();
    });

    it('should not call query (implementation is a stub)', async () => {
      const entries = [
        {
          row: { lat_round: 1.23456, lon_round: 2.34567, address: null },
          provider: 'mapbox',
          result: {
            ok: true,
            address: '123 Main St',
            city: 'City',
            state: 'ST',
            postal: '12345',
            country: 'USA',
            confidence: 0.9,
            raw: { some: 'data' },
          },
          mode: 'address-only' as const,
        },
      ];

      await upsertGeocodeCacheBatch(5, entries);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('seedAddressCandidates', () => {
    it('should call query and return inserted count', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ inserted_count: 5 }] });
      const count = await seedAddressCandidates(5, 10);
      // precision=5 triggers both observation candidates (5) + network representative candidates (5)
      expect(count).toBe(10);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('WITH pending AS'), [5, 10]);
    });

    it('should handle empty result', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [] });
      const count = await seedAddressCandidates(5, 10);
      expect(count).toBe(0);
    });
  });

  describe('fetchRows', () => {
    it('should fetch rows for poi-only mode', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ lat_round: 1, lon_round: 2 }] });
      const rows = await fetchRows(5, 10, 'poi-only', 'mapbox');
      expect(rows).toHaveLength(1);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('c.poi_name IS NULL'), [10, 5]);
    });

    it('should fetch rows for mapbox provider', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ lat_round: 1, lon_round: 2 }] });
      const rows = await fetchRows(5, 10, 'address-only', 'mapbox');
      expect(rows).toHaveLength(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('c.address_attempts < 3'),
        [10, 5]
      );
    });

    it('should fetch rows for other providers', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ lat_round: 1, lon_round: 2 }] });
      const rows = await fetchRows(5, 10, 'address-only', 'opencage');
      expect(rows).toHaveLength(1);
      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('c.address_attempts < 3'),
        [10, 5]
      );
    });
  });

  describe('loadCacheStats', () => {
    it('should return combined stats', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [
            {
              observation_count: 100,
              unique_blocks: 50,
              cached_blocks: 40,
              resolved_address_rows: 30,
              cached_with_address: 30,
              cached_with_poi: 10,
              distinct_addresses: 25,
              pending_address_queue: 5,
              attempted_without_address: 5,
              recent_activity: 2,
              last_activity_at: '2023-01-01',
              missing_blocks: 10,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { provider: 'mapbox', count: 20 },
            { provider: 'opencage', count: 10 },
          ],
        });

      const stats = await loadCacheStats(5, null, null, null, null);
      expect(stats.observation_count).toBe(100);
      expect(stats.providers).toEqual({ mapbox: 20, opencage: 10 });
      expect(query).toHaveBeenCalledTimes(2);
    });
  });
});
