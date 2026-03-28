export {};

import type { AppliedFilter, NetworkQueryParts } from './types';

type NetworkQueryState = NetworkQueryParts;

const createNetworkQueryState = (
  columnsWithDistance: string[],
  joins: string[]
): NetworkQueryState => ({
  columnsWithDistance,
  joins,
  conditions: [],
  params: [],
  paramIndex: 1,
  appliedFilters: [],
});

const addCondition = (state: NetworkQueryState, condition: string, value: unknown) => {
  state.conditions.push(condition);
  state.params.push(value);
  state.paramIndex++;
};

const addAppliedFilter = (state: NetworkQueryState, filter: AppliedFilter) => {
  state.appliedFilters.push(filter);
};

const addArrayCondition = (state: NetworkQueryState, condition: string, value: unknown) => {
  state.conditions.push(condition);
  state.params.push(value);
  state.paramIndex++;
};

export { addAppliedFilter, addArrayCondition, addCondition, createNetworkQueryState };
export type { NetworkQueryState };
