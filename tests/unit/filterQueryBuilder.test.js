const {
  UniversalFilterQueryBuilder,
  validateFilterPayload,
} = require('../../src/services/filterQueryBuilder');

describe('UniversalFilterQueryBuilder', () => {
  test('rejects RSSI below noise floor', () => {
    const result = validateFilterPayload({ rssiMin: -120 }, { rssiMin: true });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('applies RSSI filters only when enabled', () => {
    const disabledBuilder = new UniversalFilterQueryBuilder({ rssiMin: -80 }, { rssiMin: false });
    const disabledQuery = disabledBuilder.buildNetworkListQuery();
    const hasRssi = disabledQuery.appliedFilters.some((f) => f.field === 'rssiMin');
    expect(hasRssi).toBe(false);

    const enabledBuilder = new UniversalFilterQueryBuilder({ rssiMin: -80 }, { rssiMin: true });
    const enabledQuery = enabledBuilder.buildNetworkListQuery();
    const hasEnabledRssi = enabledQuery.appliedFilters.some((f) => f.field === 'rssiMin');
    expect(hasEnabledRssi).toBe(true);
  });

  test('flags threat window scope fallback warning', () => {
    const builder = new UniversalFilterQueryBuilder(
      {
        timeframe: { type: 'relative', relativeWindow: '7d' },
        temporalScope: 'threat_window',
      },
      { timeframe: true, temporalScope: true }
    );
    const result = builder.buildNetworkListQuery();
    expect(result.warnings.some((w) => w.includes('Threat window'))).toBe(true);
  });
});
