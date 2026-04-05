const {
  providerPriority,
  shouldReplaceAddressData,
} = require('../../server/src/services/geocoding/cacheStore');

describe('geocoding cache replacement helpers', () => {
  test('provider priority prefers permanent mapbox over weaker providers', () => {
    expect(providerPriority('mapbox_v5_permanent')).toBeGreaterThan(providerPriority('locationiq'));
    expect(providerPriority('locationiq')).toBeGreaterThan(providerPriority('opencage'));
  });

  test('replaces missing address with incoming address', () => {
    expect(
      shouldReplaceAddressData(
        { ok: true, address: null, confidence: null, provider: 'opencage' },
        { ok: true, address: '123 Main', confidence: 0.6, provider: 'locationiq' }
      )
    ).toBe(true);
  });

  test('replaces when incoming confidence is materially better', () => {
    expect(
      shouldReplaceAddressData(
        { ok: true, address: 'Old', confidence: 0.3, provider: 'locationiq' },
        { ok: true, address: 'New', confidence: 0.5, provider: 'opencage' }
      )
    ).toBe(true);
  });

  test('replaces when confidence is similar but provider is stronger', () => {
    expect(
      shouldReplaceAddressData(
        { ok: true, address: 'Old', confidence: 0.55, provider: 'opencage' },
        { ok: true, address: 'New', confidence: 0.54, provider: 'locationiq' }
      )
    ).toBe(true);
  });

  test('keeps current address when incoming result is weaker', () => {
    expect(
      shouldReplaceAddressData(
        { ok: true, address: 'Current', confidence: 0.8, provider: 'locationiq' },
        { ok: true, address: 'Incoming', confidence: 0.5, provider: 'opencage' }
      )
    ).toBe(false);
  });
});
