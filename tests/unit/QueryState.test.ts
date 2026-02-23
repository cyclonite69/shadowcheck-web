export {};

import { QueryState } from '../../server/src/services/filterQueryBuilder/QueryState';

describe('QueryState', () => {
  test('withAppliedFilter returns new immutable state', () => {
    const state0 = new QueryState();
    const state1 = state0.withAppliedFilter('identity', 'ssid', 'MyWiFi');

    expect(state0.appliedFilters()).toEqual([]);
    expect(state1.appliedFilters()).toEqual([{ type: 'identity', field: 'ssid', value: 'MyWiFi' }]);
  });

  test('withIgnoredFilter and withWarning support chaining', () => {
    const state = new QueryState()
      .withIgnoredFilter('quality', 'wigle_v3_observation_count_min', 'unsupported_page')
      .withWarning('Threat window scope mapped to observation_time');

    expect(state.ignoredFilters()).toEqual([
      {
        type: 'quality',
        field: 'wigle_v3_observation_count_min',
        reason: 'unsupported_page',
      },
    ]);
    expect(state.warnings()).toEqual(['Threat window scope mapped to observation_time']);
  });

  test('accessors return copies (no external mutation side-effects)', () => {
    const state = new QueryState().withAppliedFilter('radio', 'rssiMin', -80);

    const applied = state.appliedFilters();
    applied.push({ type: 'radio', field: 'rssiMax', value: -40 });

    expect(state.appliedFilters()).toEqual([{ type: 'radio', field: 'rssiMin', value: -80 }]);
  });
});
