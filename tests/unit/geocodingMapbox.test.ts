/**
 * Mapbox Geocoding Provider Unit Tests
 */

import { mapboxReverse } from '../../server/src/services/geocoding/mapbox';

// Mock global fetch
global.fetch = jest.fn();

describe('GeocodingMapbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mapboxReverse', () => {
    const mockToken = 'test-token';

    it('should return reverse geocoding result on success', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          features: [
            {
              place_type: ['address'],
              place_name: '123 Main St, City, ST 12345, USA',
              text: 'Main St',
              relevance: 1,
              context: [
                { id: 'place.1', text: 'City' },
                { id: 'region.1', text: 'State', short_code: 'US-ST' },
                { id: 'postcode.1', text: '12345' },
                { id: 'country.1', text: 'USA' },
              ],
            },
          ],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await mapboxReverse(1.23, 4.56, 'address-only', false, mockToken);

      expect(result.ok).toBe(true);
      expect(result.address).toBe('123 Main St, City, ST 12345, USA');
      expect(result.city).toBe('City');
      expect(result.state).toBe('ST');
      expect(result.postal).toBe('12345');
      expect(result.country).toBe('USA');
    });

    it('should return POI name if present', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          features: [
            {
              place_type: ['poi'],
              text: 'Starbucks',
              properties: { category: 'coffee shop' },
              relevance: 0.9,
            },
            {
              place_type: ['address'],
              place_name: '123 Main St',
              relevance: 1,
            },
          ],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await mapboxReverse(1.23, 4.56, 'both', false, mockToken);

      expect(result.ok).toBe(true);
      expect(result.poiName).toBe('Starbucks');
      expect(result.poiCategory).toBe('coffee shop');
      expect(result.address).toBe('123 Main St');
    });

    it('should throw missing_key if token is missing', async () => {
      await expect(mapboxReverse(0, 0, 'address-only', false)).rejects.toThrow('missing_key');
    });

    it('should throw rate_limit on 429', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 429 });
      await expect(mapboxReverse(0, 0, 'address-only', false, mockToken)).rejects.toThrow(
        'rate_limit'
      );
    });

    it('should return ok:false if no features found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ features: [] }),
      });

      const result = await mapboxReverse(0, 0, 'address-only', false, mockToken);
      expect(result.ok).toBe(false);
    });

    it('should handle non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid token',
      });

      const result = await mapboxReverse(0, 0, 'address-only', false, mockToken);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 401');
    });
  });
});
