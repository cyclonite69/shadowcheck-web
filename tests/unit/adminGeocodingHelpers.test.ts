export {};

const {
  parseDaemonOptions,
  parseRunOptions,
  parseTestOptions,
} = require('../../server/src/api/routes/v1/admin/adminGeocodingHelpers');

describe('adminGeocodingHelpers', () => {
  test('rejects unsupported provider names', () => {
    expect(() => parseRunOptions({ provider: 'bad-provider' })).toThrow(
      "Unsupported geocoding provider 'bad-provider'"
    );
  });

  test('rejects unsupported modes', () => {
    expect(() => parseRunOptions({ provider: 'mapbox', mode: 'bad-mode' })).toThrow(
      "Unsupported geocoding mode 'bad-mode'"
    );
  });

  test('normalizes daemon provider entries', () => {
    const parsed = parseDaemonOptions({
      provider: 'mapbox',
      providers: [
        { provider: 'locationiq', mode: 'address-only', perMinute: '45', enabled: 'true' },
        { provider: 'opencage', mode: 'both', limit: '50', enabled: false },
      ],
    });

    expect(parsed.providers).toEqual([
      {
        provider: 'locationiq',
        mode: 'address-only',
        perMinute: 45,
        enabled: true,
        limit: undefined,
        permanent: undefined,
      },
      {
        provider: 'opencage',
        mode: 'both',
        limit: 50,
        perMinute: undefined,
        enabled: false,
        permanent: undefined,
      },
    ]);
  });

  test('default test mode uses poi-only for overpass', () => {
    const parsed = parseTestOptions({ provider: 'overpass' });
    expect(parsed.mode).toBe('poi-only');
  });
});
