import { buildNetworkOnlyCountQuery } from './networkFastPathBuilder';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { CteResult, QueryResult } from '../types';

const NE_NOT_IGNORED_EXISTS_CLAUSE = `NOT EXISTS (
  SELECT 1
  FROM app.network_tags nt_ignored
  WHERE UPPER(nt_ignored.bssid) = UPPER(ne.bssid)
    AND COALESCE((to_jsonb(nt_ignored)->>'is_ignored')::boolean, FALSE) = TRUE
)`;

export function buildNetworkDashboardMetricsQuery(
  ctx: FilterBuildContext,
  getFilteredObservationsCte: () => CteResult
): QueryResult {
  const includeIgnored = ctx.shouldIncludeIgnoredByExplicitTagFilter();
  const enabledKeys = Object.entries(ctx.enabled)
    .filter(([, value]) => value)
    .map(([key]) => key);
  const networkOnly = ctx.isFastPathEligible(enabledKeys);

  const selectClause = `
    COUNT(*) as total_networks,
    COUNT(*) FILTER (WHERE ne.type = 'W') as wifi_count,
    COUNT(*) FILTER (WHERE ne.type = 'E') as ble_count,
    COUNT(*) FILTER (WHERE ne.type = 'B') as bluetooth_count,
    COUNT(*) FILTER (WHERE ne.type = 'L') as lte_count,
    COUNT(*) FILTER (WHERE ne.type = 'N') as nr_count,
    COUNT(*) FILTER (WHERE ne.type = 'G') as gsm_count,
    COALESCE(SUM(ne.observations), 0) as total_observations,
    COALESCE(SUM(ne.observations) FILTER (WHERE ne.type = 'W'), 0) as wifi_observations,
    COALESCE(SUM(ne.observations) FILTER (WHERE ne.type = 'E'), 0) as ble_observations,
    COALESCE(SUM(ne.observations) FILTER (WHERE ne.type = 'B'), 0) as bluetooth_observations,
    COALESCE(SUM(ne.observations) FILTER (WHERE ne.type = 'L'), 0) as lte_observations,
    COALESCE(SUM(ne.observations) FILTER (WHERE ne.type = 'N'), 0) as nr_observations,
    COALESCE(SUM(ne.observations) FILTER (WHERE ne.type = 'G'), 0) as gsm_observations,
    COUNT(*) FILTER (WHERE ne.threat_level = 'CRITICAL') as threats_critical,
    COUNT(*) FILTER (WHERE ne.threat_level = 'HIGH') as threats_high,
    COUNT(*) FILTER (WHERE ne.threat_level IN ('MEDIUM', 'MED')) as threats_medium,
    COUNT(*) FILTER (WHERE ne.threat_level = 'LOW') as threats_low,
    COUNT(*) FILTER (WHERE ne.lat IS NOT NULL AND ne.lon IS NOT NULL) as enriched_count
  `;

  if (networkOnly) {
    const countResult = buildNetworkOnlyCountQuery(ctx);
    const whereIdx = countResult.sql.indexOf('WHERE');
    const whereClause = whereIdx !== -1 ? countResult.sql.substring(whereIdx) : '';

    return {
      sql: `SELECT ${selectClause} FROM app.api_network_explorer_mv ne ${whereClause}`,
      params: countResult.params,
    };
  }

  const { cte } = getFilteredObservationsCte();
  const networkWhere = ctx.buildNetworkWhere();
  const whereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';
  const effectiveWhereClause =
    whereClause.length > 0
      ? includeIgnored
        ? whereClause
        : `${whereClause} AND ${NE_NOT_IGNORED_EXISTS_CLAUSE}`
      : includeIgnored
        ? ''
        : `WHERE ${NE_NOT_IGNORED_EXISTS_CLAUSE}`;

  const sql = `
    ${cte}
    , obs_rollup AS (
      SELECT
        bssid,
        COUNT(*) AS observation_count
      FROM filtered_obs
      GROUP BY bssid
    )
    SELECT
      COUNT(DISTINCT r.bssid) as total_networks,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.type = 'W') as wifi_count,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.type = 'E') as ble_count,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.type = 'B') as bluetooth_count,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.type = 'L') as lte_count,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.type = 'N') as nr_count,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.type = 'G') as gsm_count,
      COALESCE(SUM(r.observation_count), 0) as total_observations,
      COALESCE(SUM(r.observation_count) FILTER (WHERE ne.type = 'W'), 0) as wifi_observations,
      COALESCE(SUM(r.observation_count) FILTER (WHERE ne.type = 'E'), 0) as ble_observations,
      COALESCE(SUM(r.observation_count) FILTER (WHERE ne.type = 'B'), 0) as bluetooth_observations,
      COALESCE(SUM(r.observation_count) FILTER (WHERE ne.type = 'L'), 0) as lte_observations,
      COALESCE(SUM(r.observation_count) FILTER (WHERE ne.type = 'N'), 0) as nr_observations,
      COALESCE(SUM(r.observation_count) FILTER (WHERE ne.type = 'G'), 0) as gsm_observations,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.threat_level = 'CRITICAL') as threats_critical,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.threat_level = 'HIGH') as threats_high,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.threat_level IN ('MEDIUM', 'MED')) as threats_medium,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.threat_level = 'LOW') as threats_low,
      COUNT(DISTINCT r.bssid) FILTER (WHERE ne.lat IS NOT NULL AND ne.lon IS NOT NULL) as enriched_count
    FROM obs_rollup r
    JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(r.bssid)
    ${effectiveWhereClause}
  `;

  return { sql, params: ctx.getParams() as any[] };
}

export function buildThreatSeverityCountsQuery(
  ctx: FilterBuildContext,
  getFilteredObservationsCte: () => CteResult
): QueryResult {
  const includeIgnored = ctx.shouldIncludeIgnoredByExplicitTagFilter();
  const enabledKeys = Object.entries(ctx.enabled)
    .filter(([, value]) => value)
    .map(([key]) => key);
  const networkOnly = ctx.isFastPathEligible(enabledKeys);

  const dynamicThreatLevel =
    "COALESCE((to_jsonb(nt)->>'threat_level'), nts.final_threat_level, 'NONE')";
  const selectClause = `
    SELECT
      (${dynamicThreatLevel}) as severity,
      COUNT(DISTINCT ne.bssid) as unique_networks,
      SUM(ne.observations)::bigint as total_observations
  `;

  if (networkOnly) {
    const countResult = buildNetworkOnlyCountQuery(ctx);
    const whereIdx = countResult.sql.indexOf('WHERE');
    const whereClause = whereIdx !== -1 ? countResult.sql.substring(whereIdx) : '';

    return {
      sql: `${selectClause}
      FROM app.api_network_explorer_mv ne
      LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(ne.bssid)
      LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(ne.bssid)
      ${whereClause}
      GROUP BY 1`,
      params: countResult.params,
    };
  }

  const { cte } = getFilteredObservationsCte();
  const networkWhere = ctx.buildNetworkWhere();
  const whereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';
  const effectiveWhereClause =
    whereClause.length > 0
      ? includeIgnored
        ? whereClause
        : `${whereClause} AND ${NE_NOT_IGNORED_EXISTS_CLAUSE}`
      : includeIgnored
        ? ''
        : `WHERE ${NE_NOT_IGNORED_EXISTS_CLAUSE}`;

  const sql = `
    ${cte}
    , obs_rollup AS (
      SELECT
        bssid,
        COUNT(*) AS observation_count
      FROM filtered_obs
      GROUP BY bssid
    )
    ${selectClause}
    FROM obs_rollup r
    JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(r.bssid)
    LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(ne.bssid)
    LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(ne.bssid)
    ${effectiveWhereClause}
    GROUP BY 1
  `;

  return { sql, params: ctx.getParams() as any[] };
}
