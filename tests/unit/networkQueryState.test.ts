export {};

import {
  addAppliedFilter,
  addArrayCondition,
  addCondition,
  createNetworkQueryState,
} from '../../server/src/services/networking/queryState';

describe('network query state helpers', () => {
  it('initializes empty mutable query state with provided columns and joins', () => {
    const state = createNetworkQueryState(['ne.bssid'], ['LEFT JOIN app.networks n ON true']);

    expect(state.columnsWithDistance).toEqual(['ne.bssid']);
    expect(state.joins).toEqual(['LEFT JOIN app.networks n ON true']);
    expect(state.conditions).toEqual([]);
    expect(state.params).toEqual([]);
    expect(state.paramIndex).toBe(1);
    expect(state.appliedFilters).toEqual([]);
  });

  it('appends scalar and array conditions while incrementing parameter index', () => {
    const state = createNetworkQueryState([], []);

    addCondition(state, 'ne.ssid ILIKE $1', '%home%');
    addArrayCondition(state, 'ne.bssid = ANY($2::text[])', ['AA']);

    expect(state.conditions).toEqual(['ne.ssid ILIKE $1', 'ne.bssid = ANY($2::text[])']);
    expect(state.params).toEqual(['%home%', ['AA']]);
    expect(state.paramIndex).toBe(3);
  });

  it('records applied filters separately from SQL conditions', () => {
    const state = createNetworkQueryState([], []);

    addAppliedFilter(state, { column: 'ssid', value: 'home' });

    expect(state.appliedFilters).toEqual([{ column: 'ssid', value: 'home' }]);
  });
});
