const { escapeLikePattern } = require('../../utils/escapeSQL');
const {
  buildEncryptionTypeCondition,
  buildAuthMethodCondition,
} = require('../../utils/networkSqlExpressions');

export {};

import { addAppliedFilter, addArrayCondition, addCondition } from './queryState';
import type { NetworkFilterOptions } from './types';
import type { NetworkQueryState } from './queryState';

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

const applySecurityAndRadioFilters = (
  state: NetworkQueryState,
  opts: Pick<
    NetworkFilterOptions,
    'radioTypes' | 'encryptionTypes' | 'authMethods' | 'insecureFlags' | 'securityFlags'
  >,
  expressions: {
    typeExpr: string;
  }
) => {
  const { radioTypes, encryptionTypes, authMethods, insecureFlags, securityFlags } = opts;

  if (radioTypes && radioTypes.length > 0) {
    addArrayCondition(
      state,
      `(${expressions.typeExpr}) = ANY($${state.paramIndex}::text[])`,
      radioTypes
    );
    addAppliedFilter(state, { column: 'radioTypes', value: radioTypes });
  }
  if (encryptionTypes && encryptionTypes.length > 0) {
    const encResult = buildEncryptionTypeCondition(encryptionTypes, state.paramIndex);
    if (encResult) {
      state.conditions.push(encResult.sql);
      state.params.push(...encResult.params);
      state.paramIndex += encResult.params.length;
    }
    addAppliedFilter(state, { column: 'encryptionTypes', value: encryptionTypes });
  }
  if (authMethods && authMethods.length > 0) {
    const authResult = buildAuthMethodCondition(authMethods, state.paramIndex);
    if (authResult) {
      state.conditions.push(authResult.sql);
      state.params.push(...authResult.params);
      state.paramIndex += authResult.params.length;
    }
    addAppliedFilter(state, { column: 'authMethods', value: authMethods });
  }
  if (insecureFlags && insecureFlags.length > 0) {
    addArrayCondition(state, `(ne.insecure_flags && $${state.paramIndex}::text[])`, insecureFlags);
    addAppliedFilter(state, { column: 'insecureFlags', value: insecureFlags });
  }
  if (securityFlags && securityFlags.length > 0) {
    addArrayCondition(state, `(ne.security_flags && $${state.paramIndex}::text[])`, securityFlags);
    addAppliedFilter(state, { column: 'securityFlags', value: securityFlags });
  }
};

const applyLocationFilters = (
  state: NetworkQueryState,
  opts: Pick<
    NetworkFilterOptions,
    | 'locationMode'
    | 'bboxMinLat'
    | 'bboxMaxLat'
    | 'bboxMinLng'
    | 'bboxMaxLng'
    | 'radiusCenterLat'
    | 'radiusCenterLng'
    | 'radiusMeters'
  >
) => {
  const {
    locationMode,
    bboxMinLat,
    bboxMaxLat,
    bboxMinLng,
    bboxMaxLng,
    radiusCenterLat,
    radiusCenterLng,
    radiusMeters,
  } = opts;

  if (
    locationMode === 'centroid' ||
    locationMode === 'weighted_centroid' ||
    locationMode === 'triangulated'
  ) {
    const modePrefix =
      locationMode === 'weighted_centroid'
        ? 'weighted'
        : locationMode === 'triangulated'
          ? 'triangulated'
          : 'centroid';
    state.joins.push(
      `LEFT JOIN LATERAL (SELECT bssid, ${modePrefix}_lat AS lat, ${modePrefix}_lon AS lon FROM app.network_locations WHERE bssid = ne.bssid) AS nl ON true`
    );
  }
  if (bboxMinLat !== null && bboxMaxLat !== null && bboxMinLng !== null && bboxMaxLng !== null) {
    if (locationMode === 'latest_observation') {
      state.conditions.push(`ne.lat BETWEEN $${state.paramIndex} AND $${state.paramIndex + 1}`);
      state.params.push(bboxMinLat, bboxMaxLat);
      state.paramIndex += 2;
      state.conditions.push(`ne.lon BETWEEN $${state.paramIndex} AND $${state.paramIndex + 1}`);
      state.params.push(bboxMinLng, bboxMaxLng);
      state.paramIndex += 2;
    } else {
      state.joins.push('LEFT JOIN app.network_locations nl ON ne.bssid = nl.bssid');
      state.conditions.push(`nl.lat BETWEEN $${state.paramIndex} AND $${state.paramIndex + 1}`);
      state.params.push(bboxMinLat, bboxMaxLat);
      state.paramIndex += 2;
      state.conditions.push(`nl.lon BETWEEN $${state.paramIndex} AND $${state.paramIndex + 1}`);
      state.params.push(bboxMinLng, bboxMaxLng);
      state.paramIndex += 2;
    }
  }
  if (radiusCenterLat !== null && radiusCenterLng !== null && radiusMeters !== null) {
    state.conditions.push(
      `(ST_Distance(ST_MakePoint($${state.paramIndex + 1}, $${state.paramIndex})::geography, ST_MakePoint(ne.lon, ne.lat)::geography) <= $${state.paramIndex + 2})`
    );
    state.params.push(radiusCenterLat, radiusCenterLng, radiusMeters);
    state.paramIndex += 3;
  }
};

export { applyLocationFilters, applySecurityAndRadioFilters };
