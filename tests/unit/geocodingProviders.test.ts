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

    it('should return error on 401', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized',
      });

      const result = await nominatimReverse(0, 0);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 401');
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

    it('should handle non-JSON error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Not JSON',
      });

      const result = await nominatimReverse(0, 0);
      expect(result.ok).toBe(false);
      expect(result.raw).toEqual({
        status: 500,
        statusText: 'Internal Server Error',
        body: 'Not JSON',
      });
    });

    it('should handle empty error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => '',
      });

      const result = await nominatimReverse(0, 0);
      expect(result.ok).toBe(false);
      expect(result.raw).toEqual({
        status: 500,
        statusText: 'Internal Server Error',
      });
    });

    it('should return ok:false if display_name is missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ address: {} }),
      });

      const result = await nominatimReverse(0, 0);
      expect(result.ok).toBe(false);
    });

    it('should fall back through city/town/village/hamlet/county', async () => {
      const addressVariants = [
        { town: 'Town' },
        { village: 'Village' },
        { hamlet: 'Hamlet' },
        { county: 'County' },
      ];

      for (const addr of addressVariants) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            display_name: 'Addr',
            address: addr,
          }),
        });
        const result = await nominatimReverse(0, 0);
        expect(result.city).toBe(Object.values(addr)[0]);
      }
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

    it('should throw rate_limit on 429', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 429 });
      await expect(overpassPoi(0, 0)).rejects.toThrow('rate_limit');
    });

    it('should return error on 401', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized',
      });

      const result = await overpassPoi(0, 0);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 401');
    });

    it('should return error on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Error',
      });

      const result = await overpassPoi(0, 0);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 400');
    });

    it('should return ok:false if no elements or tags', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ elements: [] }),
      });
      let result = await overpassPoi(0, 0);
      expect(result.ok).toBe(false);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ elements: [{}] }),
      });
      result = await overpassPoi(0, 0);
      expect(result.ok).toBe(false);
    });

    it('should fall through poiCategory tags', async () => {
      const tags = [
        { name: 'N', shop: 'S' },
        { name: 'N', leisure: 'L' },
        { name: 'N', tourism: 'T' },
        { name: 'N', office: 'O' },
        { name: 'N', building: 'B' },
      ];

      for (const t of tags) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ elements: [{ tags: t }] }),
        });
        const result = await overpassPoi(0, 0);
        expect(result.poiCategory).toBe(Object.values(t)[1]);
      }
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

    it('should throw rate_limit on 429', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 429 });
      await expect(opencageReverse(0, 0, 'key')).rejects.toThrow('rate_limit');
    });

    it('should return error on 401', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized',
      });

      const result = await opencageReverse(0, 0, 'key');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 401');
    });

    it('should return error on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Quota Exceeded',
      });

      const result = await opencageReverse(0, 0, 'key');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 403');
    });

    it('should return ok:false if no results or formatted missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      });
      let result = await opencageReverse(0, 0, 'key');
      expect(result.ok).toBe(false);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [{}] }),
      });
      result = await opencageReverse(0, 0, 'key');
      expect(result.ok).toBe(false);
    });

    it('should fall back through city/town/village/hamlet/county', async () => {
      const components = [
        { town: 'Town' },
        { village: 'Village' },
        { hamlet: 'Hamlet' },
        { county: 'County' },
      ];

      for (const comp of components) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            results: [{ formatted: 'Addr', components: comp }],
          }),
        });
        const result = await opencageReverse(0, 0, 'key');
        expect(result.city).toBe(Object.values(comp)[0]);
      }
    });

    it('should handle missing confidence', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ formatted: 'Addr', components: {} }],
        }),
      });
      const result = await opencageReverse(0, 0, 'key');
      expect(result.confidence).toBeNull();
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

    it('should throw missing_key if key not provided', async () => {
      await expect(geocodioReverse(0, 0)).rejects.toThrow('missing_key');
    });

    it('should throw rate_limit on 429', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 429 });
      await expect(geocodioReverse(0, 0, 'key')).rejects.toThrow('rate_limit');
    });

    it('should return error on 401', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized',
      });

      const result = await geocodioReverse(0, 0, 'key');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 401');
    });

    it('should return error on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Quota Exceeded',
      });

      const result = await geocodioReverse(0, 0, 'key');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 403');
    });

    it('should return ok:false if no results or formatted_address missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      });
      let result = await geocodioReverse(0, 0, 'key');
      expect(result.ok).toBe(false);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [{}] }),
      });
      result = await geocodioReverse(0, 0, 'key');
      expect(result.ok).toBe(false);
    });

    it('should fall back through city/county/place/locality', async () => {
      const components = [{ county: 'County' }, { place: 'Place' }, { locality: 'Locality' }];

      for (const comp of components) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            results: [{ formatted_address: 'Addr', address_components: comp }],
          }),
        });
        const result = await geocodioReverse(0, 0, 'key');
        expect(result.city).toBe(Object.values(comp)[0]);
      }
    });

    it('should handle missing or non-number accuracy', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ formatted_address: 'Addr', address_components: {} }],
        }),
      });
      const result = await geocodioReverse(0, 0, 'key');
      expect(result.confidence).toBeNull();
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

    it('should throw missing_key if key not provided', async () => {
      await expect(locationIqReverse(0, 0)).rejects.toThrow('missing_key');
    });

    it('should throw rate_limit on 429', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 429 });
      await expect(locationIqReverse(0, 0, 'key')).rejects.toThrow('rate_limit');
    });

    it('should return error on 401', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized',
      });

      const result = await locationIqReverse(0, 0, 'key');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 401');
    });

    it('should return error on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'No Result',
      });

      const result = await locationIqReverse(0, 0, 'key');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 404');
    });

    it('should return ok:false if display_name is missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ address: {} }),
      });

      const result = await locationIqReverse(0, 0, 'key');
      expect(result.ok).toBe(false);
    });

    it('should fall back through city/town/village/hamlet/county', async () => {
      const components = [
        { town: 'Town' },
        { village: 'Village' },
        { hamlet: 'Hamlet' },
        { county: 'County' },
      ];

      for (const comp of components) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            display_name: 'Addr',
            address: comp,
          }),
        });
        const result = await locationIqReverse(0, 0, 'key');
        expect(result.city).toBe(Object.values(comp)[0]);
      }
    });

    it('should handle missing or non-number importance', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          display_name: 'Addr',
          address: {},
        }),
      });
      const result = await locationIqReverse(0, 0, 'key');
      expect(result.confidence).toBeNull();
    });
  });
});
