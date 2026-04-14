/**
 * Geocoding Providers Unit Tests
 */

import {
  nominatimReverse,
  overpassPoi,
  opencageReverse,
  geocodioReverse,
  locationIqReverse,
} from '../../server/src/services/geocoding/providers';

// Mock global fetch
global.fetch = jest.fn();

describe('GeocodingProviders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('nominatimReverse', () => {
    it('should return address on success', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          display_name: '123 Main St, City, Country',
          address: { city: 'City', state: 'State', postcode: '12345', country: 'Country' },
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await nominatimReverse(1.23, 4.56);

      expect(result.ok).toBe(true);
      expect(result.address).toBe('123 Main St, City, Country');
      expect(result.city).toBe('City');
    });

    it('should throw rate_limit on 429', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 429 });
      await expect(nominatimReverse(0, 0)).rejects.toThrow('rate_limit');
    });

    it('should return error on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Error message',
      });

      const result = await nominatimReverse(0, 0);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 500');
    });
  });

  describe('overpassPoi', () => {
    it('should return POI name on success', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          elements: [{ tags: { name: 'Test Cafe', amenity: 'cafe' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await overpassPoi(1.23, 4.56);

      expect(result.ok).toBe(true);
      expect(result.poiName).toBe('Test Cafe');
      expect(result.poiCategory).toBe('cafe');
    });

    it('should return ok:false if no name tag', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ elements: [{ tags: {} }] }),
      });

      const result = await overpassPoi(0, 0);
      expect(result.ok).toBe(false);
    });
  });

  describe('opencageReverse', () => {
    it('should return address on success', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ formatted: 'Formatted Addr', components: { city: 'City' }, confidence: 9 }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await opencageReverse(1.23, 4.56, 'test-key');

      expect(result.ok).toBe(true);
      expect(result.address).toBe('Formatted Addr');
      expect(result.confidence).toBe(0.09); // 9 / 100
    });

    it('should throw missing_key if key not provided', async () => {
      await expect(opencageReverse(0, 0)).rejects.toThrow('missing_key');
    });
  });

  describe('geocodioReverse', () => {
    it('should return address on success', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              formatted_address: 'GeoAddr',
              address_components: { city: 'GeoCity' },
              accuracy: 0.8,
            },
          ],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await geocodioReverse(1.23, 4.56, 'test-key');

      expect(result.ok).toBe(true);
      expect(result.address).toBe('GeoAddr');
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('locationIqReverse', () => {
    it('should return address on success', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          display_name: 'IQAddr',
          address: { city: 'IQCity' },
          importance: 0.75,
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await locationIqReverse(1.23, 4.56, 'test-key');

      expect(result.ok).toBe(true);
      expect(result.address).toBe('IQAddr');
      expect(result.confidence).toBe(0.75);
    });
  });
});
