import { OBS_TYPE_EXPR, SECURITY_FROM_CAPS_EXPR, WIFI_CHANNEL_EXPR } from '../sqlExpressions';
import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { CteResult, GeospatialOptions } from '../types';

export interface GeospatialQueryContext {
  cte: string;
  params: unknown[];
  networkWhere: string[];
  includeStationaryConfidence: boolean;
  limitClause: string;
  selectClause: string;
  networkLocationsJoin: string;
}

export function buildGeospatialQueryContext(
  ctx: FilterBuildContext,
  filteredObservationsCte: CteResult,
  options: GeospatialOptions = {}
): GeospatialQueryContext {
  const { limit = null, offset = 0, locationMode = 'latest_observation' } = options;
  const { cte } = filteredObservationsCte;
  const networkWhere = ctx.buildNetworkWhere();
  const includeStationaryConfidence = ctx.shouldComputeStationaryConfidence();
  const limitClause =
    limit !== null ? `LIMIT ${ctx.addParam(limit)} OFFSET ${ctx.addParam(offset)}` : '';

  const networkLocationsJoin = SqlFragmentLibrary.joinNetworkLocations('ne', locationMode);
  const observationMetadata = options.includeObservationMetadata
    ? 'o.id, o.level, o.observed_at_ms,'
    : '';

  const selectClause = `
        ${observationMetadata}
        o.bssid,
        o.ssid,
        COALESCE(o.radio_capabilities, ne.capabilities) AS capabilities,
        ${SECURITY_FROM_CAPS_EXPR('COALESCE(o.radio_capabilities, ne.capabilities)')} AS security,
        o.lat,
        o.lon,
        nl.centroid_lat,
        nl.centroid_lon,
        nl.weighted_lat,
        nl.weighted_lon,
        o.level AS signal,
        o.radio_frequency AS frequency,
        ${WIFI_CHANNEL_EXPR('o')} AS channel,
        ${OBS_TYPE_EXPR('o')} AS type,
        o.time,
        ne.first_seen,
        ne.last_seen,
        ne.observations,
        ne.unique_days,
        ne.unique_locations,
        ne.max_distance_meters,
        ne.manufacturer,
        ne.threat_score,
        ne.threat_level,
        o.accuracy,
        ne.distance_from_home_km,
        ne.geocoded_address,
        ne.geocoded_city,
        ne.geocoded_state,
        ne.geocoded_poi_name,
        ne.has_siblings,
        ne.sibling_count,
        ne.sibling_max_confidence,
        ne.has_strong_sibling,
        ne.sibling_bssids,
        ${includeStationaryConfidence ? 'ne.stationary_confidence' : 'NULL::numeric AS stationary_confidence'},
        COALESCE(nms.media_count, 0) AS media_count,
        nms.media_ids
      `;

  return {
    cte,
    params: ctx.getParams(),
    networkWhere,
    includeStationaryConfidence,
    limitClause,
    selectClause,
    networkLocationsJoin,
  };
}
