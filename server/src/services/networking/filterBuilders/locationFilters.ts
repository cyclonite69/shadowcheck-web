export {};

import type { NetworkFilterOptions } from '../types';
import type { NetworkQueryState } from '../queryState';

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

export { applyLocationFilters };
