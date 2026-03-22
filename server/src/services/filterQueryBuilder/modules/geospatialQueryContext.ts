import {
  OBS_TYPE_EXPR,
  SECURITY_FROM_CAPS_EXPR,
  WIFI_CHANNEL_EXPR,
} from '../sqlExpressions';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { CteResult, GeospatialOptions } from '../types';

export interface GeospatialQueryContext {
  cte: string;
  params: unknown[];
  networkWhere: string[];
  includeStationaryConfidence: boolean;
  limitClause: string;
  selectClause: string;
}

export function buildGeospatialQueryContext(
  ctx: FilterBuildContext,
  filteredObservationsCte: CteResult,
  options: GeospatialOptions = {}
): GeospatialQueryContext {
  const { limit = null, offset = 0 } = options;
  const { cte } = filteredObservationsCte;
  const networkWhere = ctx.buildNetworkWhere();
  const includeStationaryConfidence = ctx.shouldComputeStationaryConfidence();
  const limitClause =
    limit !== null ? `LIMIT ${ctx.addParam(limit)} OFFSET ${ctx.addParam(offset)}` : '';

  const selectClause = `
        o.bssid,
        o.ssid,
        COALESCE(o.radio_capabilities, ne.capabilities) AS capabilities,
        ${SECURITY_FROM_CAPS_EXPR('COALESCE(o.radio_capabilities, ne.capabilities)')} AS security,
        o.lat,
        o.lon,
        o.level AS signal,
        o.radio_frequency AS frequency,
        ${WIFI_CHANNEL_EXPR('o')} AS channel,
        ${OBS_TYPE_EXPR('o')} AS type,
        o.time AS last_seen,
        ne.threat_score,
        ne.threat_level,
        o.accuracy,
        ne.distance_from_home_km,
        ${includeStationaryConfidence ? 'ne.stationary_confidence' : 'NULL::numeric AS stationary_confidence'}
      `;

  return {
    cte,
    params: ctx.getParams(),
    networkWhere,
    includeStationaryConfidence,
    limitClause,
    selectClause,
  };
}
