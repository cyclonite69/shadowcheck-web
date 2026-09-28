import {
  calculateRateLimitBackoffMs,
  ensureProviderReady,
  executeProviderLookup,
  getProviderLabel,
  resolveProviderCredentials,
} from '../../../../server/src/services/geocoding/providerRuntime';
import secretsManager from '../../../../server/src/services/secretsManager';
import { mapboxReverse } from '../../../../server/src/services/geocoding/mapbox';
import {
  nominatimReverse,
  overpassPoi,
  opencageReverse,
  geocodioReverse,
  locationIqReverse,
} from '../../../../server/src/services/geocoding/providers';

jest.mock('../../../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    getSecret: jest.fn(),
  },
}));

jest.mock('../../../../server/src/services/geocoding/mapbox', () => ({
  mapboxReverse: jest.fn(),
}));

jest.mock('../../../../server/src/services/geocoding/providers', () => ({
  nominatimReverse: jest.fn(),
  overpassPoi: jest.fn(),
  opencageReverse: jest.fn(),
  geocodioReverse: jest.fn(),
  locationIqReverse: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

describe('providerRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveProviderCredentials', () => {
    it('should resolve mapbox credentials', async () => {
      (secretsManager.getSecret as jest.Mock).mockResolvedValueOnce('token123');
      const creds = await resolveProviderCredentials('mapbox');
      expect(creds).toEqual({ mapboxToken: 'token123' });
      expect(secretsManager.getSecret).toHaveBeenCalledWith('mapbox_unlimited_api_key');
    });

    it('should fall back to mapbox_token', async () => {
      (secretsManager.getSecret as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('token456');
      const creds = await resolveProviderCredentials('mapbox');
      expect(creds).toEqual({ mapboxToken: 'token456' });
    });

    it('should resolve opencage credentials', async () => {
      (secretsManager.getSecret as jest.Mock).mockResolvedValueOnce('key123');
      const creds = await resolveProviderCredentials('opencage');
      expect(creds).toEqual({ opencageKey: 'key123' });
    });

    it('should resolve geocodio credentials', async () => {
      (secretsManager.getSecret as jest.Mock).mockResolvedValueOnce('key123');
      const creds = await resolveProviderCredentials('geocodio');
      expect(creds).toEqual({ geocodioKey: 'key123' });
    });

    it('should resolve locationiq credentials', async () => {
      (secretsManager.getSecret as jest.Mock).mockResolvedValueOnce('key123');
      const creds = await resolveProviderCredentials('locationiq');
      expect(creds).toEqual({ locationIqKey: 'key123' });
    });

    it('should return empty for others', async () => {
      const creds = await resolveProviderCredentials('nominatim');
      expect(creds).toEqual({});
    });
  });

  describe('ensureProviderReady', () => {
    it.each([undefined, '', 'false', '1'])(
      'should disable overpass when GEOCODING_OVERPASS_ENABLED is %s',
      (value) => {
        const originalValue = process.env.GEOCODING_OVERPASS_ENABLED;
        if (value === undefined) {
          delete process.env.GEOCODING_OVERPASS_ENABLED;
        } else {
          process.env.GEOCODING_OVERPASS_ENABLED = value;
        }

        try {
          expect(() => ensureProviderReady('overpass', {})).toThrow('provider_disabled:overpass');
        } finally {
          if (originalValue === undefined) {
            delete process.env.GEOCODING_OVERPASS_ENABLED;
          } else {
            process.env.GEOCODING_OVERPASS_ENABLED = originalValue;
          }
        }
      }
    );

    it('should allow overpass only when explicitly enabled', () => {
      const originalValue = process.env.GEOCODING_OVERPASS_ENABLED;
      process.env.GEOCODING_OVERPASS_ENABLED = 'true';

      try {
        expect(() => ensureProviderReady('overpass', {})).not.toThrow();
      } finally {
        if (originalValue === undefined) {
          delete process.env.GEOCODING_OVERPASS_ENABLED;
        } else {
          process.env.GEOCODING_OVERPASS_ENABLED = originalValue;
        }
      }
    });

    it('should throw if mapbox token missing', () => {
      expect(() => ensureProviderReady('mapbox', {})).toThrow('missing_key:mapbox');
    });

    it('should not throw if mapbox token exists', () => {
      expect(() => ensureProviderReady('mapbox', { mapboxToken: 'ok' })).not.toThrow();
    });

    it('should throw if opencage key missing', () => {
      expect(() => ensureProviderReady('opencage', {})).toThrow('missing_key:opencage');
    });

    it('should throw if geocodio key missing', () => {
      expect(() => ensureProviderReady('geocodio', {})).toThrow('missing_key:geocodio');
    });

    it('should throw if locationiq key missing', () => {
      expect(() => ensureProviderReady('locationiq', {})).toThrow('missing_key:locationiq');
    });
  });

  describe('calculateRateLimitBackoffMs', () => {
    it('should calculate backoff for mapbox', () => {
      const ms = calculateRateLimitBackoffMs('mapbox', 1);
      // initial 15000 * 2^0 = 15000 + jitter(0-999)
      expect(ms).toBeGreaterThanOrEqual(15000);
      expect(ms).toBeLessThan(16000);
    });

    it('should calculate exponential backoff', () => {
      const ms = calculateRateLimitBackoffMs('mapbox', 2);
      // initial 15000 * 2^1 = 30000 + jitter
      expect(ms).toBeGreaterThanOrEqual(30000);
      expect(ms).toBeLessThan(31000);
    });

    it('should cap backoff', () => {
      const ms = calculateRateLimitBackoffMs('mapbox', 10);
      // max 120000 + jitter
      expect(ms).toBeGreaterThanOrEqual(120000);
      expect(ms).toBeLessThan(121000);
    });
  });

  describe('getProviderLabel', () => {
    it('should handle mapbox permanent', () => {
      expect(getProviderLabel('mapbox', true)).toBe('mapbox_v5_permanent');
    });

    it('should handle mapbox non-permanent', () => {
      expect(getProviderLabel('mapbox', false)).toBe('mapbox_v5');
    });

    it('should return provider name for others', () => {
      expect(getProviderLabel('opencage', true)).toBe('opencage');
      expect(getProviderLabel('nominatim', false)).toBe('nominatim');
    });
  });

  describe('executeProviderLookup', () => {
    it('should call mapboxReverse', async () => {
      (mapboxReverse as jest.Mock).mockResolvedValue({ ok: true });
      const result = await executeProviderLookup('mapbox', 'address-only', 1, 2, true, {
        mapboxToken: 'tok',
      });
      expect(mapboxReverse).toHaveBeenCalledWith(1, 2, 'address-only', true, 'tok');
      expect(result).toEqual({ ok: true });
    });

    it('should call nominatimReverse', async () => {
      (nominatimReverse as jest.Mock).mockResolvedValue({ ok: true });
      await executeProviderLookup('nominatim', 'address-only', 1, 2, false, {});
      expect(nominatimReverse).toHaveBeenCalledWith(1, 2);
    });

    it('should call overpassPoi', async () => {
      (overpassPoi as jest.Mock).mockResolvedValue({ ok: true });
      await executeProviderLookup('overpass', 'poi-only', 1, 2, false, {});
      expect(overpassPoi).toHaveBeenCalledWith(1, 2);
    });

    it('should call opencageReverse', async () => {
      (opencageReverse as jest.Mock).mockResolvedValue({ ok: true });
      await executeProviderLookup('opencage', 'address-only', 1, 2, false, { opencageKey: 'key' });
      expect(opencageReverse).toHaveBeenCalledWith(1, 2, 'key');
    });

    it('should call geocodioReverse', async () => {
      (geocodioReverse as jest.Mock).mockResolvedValue({ ok: true });
      await executeProviderLookup('geocodio', 'address-only', 1, 2, false, { geocodioKey: 'key' });
      expect(geocodioReverse).toHaveBeenCalledWith(1, 2, 'key');
    });

    it('should call locationIqReverse', async () => {
      (locationIqReverse as jest.Mock).mockResolvedValue({ ok: true });
      await executeProviderLookup('locationiq', 'address-only', 1, 2, false, {
        locationIqKey: 'key',
      });
      expect(locationIqReverse).toHaveBeenCalledWith(1, 2, 'key');
    });

    it('should return error for unsupported provider', async () => {
      const result = await executeProviderLookup(
        'unsupported' as any,
        'address-only',
        1,
        2,
        false,
        {}
      );
      expect(result).toEqual({ ok: false, error: 'Unsupported provider' });
    });
  });
});
