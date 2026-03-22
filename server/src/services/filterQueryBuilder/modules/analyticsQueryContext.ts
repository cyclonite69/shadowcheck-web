import {
  OBS_TYPE_EXPR,
  SECURITY_EXPR,
} from '../sqlExpressions';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { CteResult } from '../types';

export interface AnalyticsQueryContext {
  baseCtes: string;
  filteredObsCte: string;
  params: unknown[];
  sourceTable: 'network_set' | 'filtered_obs';
  typeExpr: string;
  securityExpr: string;
}

export function buildAnalyticsQueryContext(
  ctx: FilterBuildContext,
  filteredObservationsCte: CteResult,
  options: { useLatestPerBssid?: boolean }
): AnalyticsQueryContext {
  const { useLatestPerBssid = false } = options;
  const { cte } = filteredObservationsCte;
  const networkWhere = ctx.buildNetworkWhere();
  const networkWhereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';

  const baseCtes = `
      ${cte}
      , obs_rollup AS (
        SELECT
          bssid,
          COUNT(*) AS observation_count
        FROM filtered_obs
        GROUP BY bssid
      ),
      obs_latest AS (
        SELECT DISTINCT ON (bssid)
          bssid,
          ssid,
          lat,
          lon,
          level,
          accuracy,
          time AS observed_at,
          radio_frequency,
          radio_capabilities,
          radio_type
        FROM filtered_obs
        ORDER BY bssid, time DESC
      ),
      network_set AS (
        SELECT
          l.*,
          r.observation_count
        FROM obs_latest l
        JOIN obs_rollup r ON r.bssid = l.bssid
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(l.bssid)
        LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(l.bssid)
        LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(l.bssid)
        ${networkWhereClause}
      )
    `;

  const sourceTable = useLatestPerBssid ? 'network_set' : 'filtered_obs';
  const typeExpr = useLatestPerBssid ? OBS_TYPE_EXPR('network_set') : OBS_TYPE_EXPR('filtered_obs');
  const securityExpr = useLatestPerBssid
    ? SECURITY_EXPR('network_set')
    : SECURITY_EXPR('filtered_obs');

  return {
    baseCtes,
    filteredObsCte: cte,
    params: ctx.getParams(),
    sourceTable,
    typeExpr,
    securityExpr,
  };
}
