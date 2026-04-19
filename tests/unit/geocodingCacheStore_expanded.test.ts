import { 
  providerPriority, 
  shouldReplaceAddressData, 
  shouldSkipPoi, 
  GeocodeCacheWrite,
  upsertGeocodeCacheBatch
} from '../../server/src/services/geocoding/cacheStore';

// Mock the database dependency
jest.mock('../../server/src/config/database', () => ({
  query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] })
}));

const { query } = require('../../server/src/config/database');

describe('geocodingCacheStore', () => {
  describe('providerPriority', () => {
    test('ranks providers correctly', () => {
      expect(providerPriority('mapbox_v5_permanent')).toBe(5);
      expect(providerPriority('mapbox')).toBe(4);
      expect(providerPriority('locationiq')).toBe(3);
      expect(providerPriority('geocodio')).toBe(2);
      expect(providerPriority('opencage')).toBe(1);
      expect(providerPriority('unknown')).toBe(0);
    });
  });

  describe('shouldReplaceAddressData', () => {
    test('handles valid incoming data correctly', () => {
      expect(shouldReplaceAddressData({ address: null }, { ok: true, address: 'addr' })).toBe(true);
      expect(shouldReplaceAddressData({ address: 'A', confidence: 0.5 }, { ok: true, address: 'B', confidence: 0.7 })).toBe(true);
      expect(shouldReplaceAddressData({ address: 'A', confidence: 0.5, provider: 'opencage' }, { ok: true, address: 'B', confidence: 0.51, provider: 'locationiq' })).toBe(true);
    });

    test('rejects bad incoming data', () => {
      expect(shouldReplaceAddressData({ address: 'A' }, { ok: false, address: 'B' })).toBe(false);
      expect(shouldReplaceAddressData({ address: 'A', confidence: 0.8 }, { ok: true, address: 'B', confidence: 0.5 })).toBe(false);
    });
  });

  describe('shouldSkipPoi', () => {
    test('filters sensitive POIs', () => {
      expect(shouldSkipPoi('814 martin luther king')).toBe(true);
      expect(shouldSkipPoi('816 MARTIN LUTHER KING')).toBe(true);
      expect(shouldSkipPoi('Main St')).toBe(false);
    });
  });

  describe('upsertGeocodeCacheBatch - Concurrency and Stress', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('handles high concurrency batch writes', async () => {
      const entry: GeocodeCacheWrite = {
        row: { lat_round: 1, lon_round: 1 },
        provider: 'mapbox',
        result: { ok: true, address: 'Test', confidence: 0.9 },
        mode: 'address-only'
      };
      
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }).map(() => 
        upsertGeocodeCacheBatch(1, [entry])
      );
      
      await Promise.all(promises);
      
      expect(query).toHaveBeenCalledTimes(concurrentRequests);
    });
  });
});
