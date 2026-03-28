const { escapeLikePattern } = require('../../../utils/escapeSQL');

export {};

import { addAppliedFilter, addArrayCondition, addCondition } from '../queryState';
import type { NetworkFilterOptions } from '../types';
import type { NetworkQueryState } from '../queryState';

const applyTextAndRangeFilters = (
  state: NetworkQueryState,
  opts: Pick<
    NetworkFilterOptions,
    | 'ssidPattern'
    | 'bssidList'
    | 'threatLevel'
    | 'threatCategories'
    | 'threatScoreMin'
    | 'threatScoreMax'
    | 'lastSeen'
    | 'distanceFromHomeKm'
    | 'distanceFromHomeMinKm'
    | 'distanceFromHomeMaxKm'
    | 'minSignal'
    | 'maxSignal'
    | 'minObsCount'
    | 'maxObsCount'
    | 'manufacturer'
    | 'quickSearchPattern'
  >,
  expressions: {
    threatLevelExpr: string;
    threatScoreExpr: string;
    distanceExpr: string;
  }
) => {
  const {
    ssidPattern,
    bssidList,
    threatLevel,
    threatCategories,
    threatScoreMin,
    threatScoreMax,
    lastSeen,
    distanceFromHomeKm,
    distanceFromHomeMinKm,
    distanceFromHomeMaxKm,
    minSignal,
    maxSignal,
    minObsCount,
    maxObsCount,
    manufacturer,
    quickSearchPattern,
  } = opts;

  if (ssidPattern !== null) {
    addCondition(
      state,
      `ne.ssid ILIKE $${state.paramIndex}`,
      `%${escapeLikePattern(ssidPattern)}%`
    );
    addAppliedFilter(state, { column: 'ssid', value: ssidPattern });
  }
  if (bssidList && bssidList.length > 0) {
    addArrayCondition(state, `ne.bssid = ANY($${state.paramIndex}::text[])`, bssidList);
    addAppliedFilter(state, { column: 'bssid', value: bssidList });
  }
  if (threatLevel !== null) {
    addCondition(state, `(${expressions.threatLevelExpr}) = $${state.paramIndex}`, threatLevel);
    addAppliedFilter(state, { column: 'threatLevel', value: threatLevel });
  }
  if (threatCategories && threatCategories.length > 0) {
    addCondition(
      state,
      `(${expressions.threatLevelExpr}) = ANY($${state.paramIndex}::text[])`,
      threatCategories
    );
    addAppliedFilter(state, { column: 'threatCategories', value: threatCategories });
  }
  if (threatScoreMin !== null) {
    addCondition(state, `${expressions.threatScoreExpr} >= $${state.paramIndex}`, threatScoreMin);
  }
  if (threatScoreMax !== null) {
    addCondition(state, `${expressions.threatScoreExpr} <= $${state.paramIndex}`, threatScoreMax);
  }
  if (threatScoreMin !== null || threatScoreMax !== null) {
    addAppliedFilter(state, {
      column: 'threatScore',
      range: [threatScoreMin ?? -100, threatScoreMax ?? 100],
    });
  }
  if (lastSeen !== null) {
    addCondition(state, `ne.last_seen >= $${state.paramIndex}`, lastSeen);
    addAppliedFilter(state, { column: 'lastSeen', value: lastSeen });
  }
  if (distanceFromHomeKm !== null) {
    addCondition(
      state,
      `(${expressions.distanceExpr}) <= $${state.paramIndex}`,
      distanceFromHomeKm
    );
  }
  if (distanceFromHomeMinKm !== null) {
    addCondition(
      state,
      `(${expressions.distanceExpr}) >= $${state.paramIndex}`,
      distanceFromHomeMinKm
    );
  }
  if (distanceFromHomeMaxKm !== null) {
    addCondition(
      state,
      `(${expressions.distanceExpr}) <= $${state.paramIndex}`,
      distanceFromHomeMaxKm
    );
  }
  if (
    distanceFromHomeMinKm !== null ||
    distanceFromHomeMaxKm !== null ||
    distanceFromHomeKm !== null
  ) {
    addAppliedFilter(state, {
      column: 'distanceFromHome',
      range: [distanceFromHomeMinKm ?? 0, distanceFromHomeMaxKm ?? distanceFromHomeKm ?? 10000],
    });
  }
  if (minSignal !== null) {
    addCondition(state, `ne.signal >= $${state.paramIndex}`, minSignal);
  }
  if (maxSignal !== null) {
    addCondition(state, `ne.signal <= $${state.paramIndex}`, maxSignal);
  }
  if (minSignal !== null || maxSignal !== null) {
    addAppliedFilter(state, { column: 'rssi', range: [minSignal ?? -100, maxSignal ?? 0] });
  }
  if (minObsCount !== null) {
    addCondition(state, `ne.observations >= $${state.paramIndex}`, minObsCount);
  }
  if (maxObsCount !== null) {
    addCondition(state, `ne.observations <= $${state.paramIndex}`, maxObsCount);
  }
  if (minObsCount !== null || maxObsCount !== null) {
    addAppliedFilter(state, {
      column: 'obsCount',
      range: [minObsCount ?? 0, maxObsCount ?? 1000000],
    });
  }
  if (quickSearchPattern !== null) {
    state.conditions.push(
      `(ne.ssid ILIKE $${state.paramIndex} OR ne.bssid ILIKE $${state.paramIndex} OR ne.manufacturer ILIKE $${state.paramIndex})`
    );
    state.params.push(`%${escapeLikePattern(quickSearchPattern)}%`);
    state.paramIndex++;
  }
  if (manufacturer !== null) {
    addCondition(
      state,
      `ne.manufacturer ILIKE $${state.paramIndex}`,
      `%${escapeLikePattern(manufacturer)}%`
    );
    addAppliedFilter(state, { column: 'manufacturer', value: manufacturer });
  }
};

export { applyTextAndRangeFilters };
