import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import { OBS_TYPE_EXPR, SECURITY_FROM_CAPS_EXPR, SECURITY_EXPR } from '../sqlExpressions';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { CteResult, FilteredQueryResult, NetworkListOptions, QueryResult } from '../types';

const NE_NOT_IGNORED_EXISTS_CLAUSE = `NOT EXISTS (
  SELECT 1
  FROM app.network_tags nt_ignored
  WHERE UPPER(nt_ignored.bssid) = UPPER(ne.bssid)
    AND COALESCE((to_jsonb(nt_ignored)->>'is_ignored')::boolean, FALSE) = TRUE
)`;
const NT_NOT_IGNORED_CLAUSE = 'COALESCE(nt.is_ignored, FALSE) = FALSE';
const RM_SELECT_FIELDS = SqlFragmentLibrary.selectManufacturerFields('rm');
const NT_SELECT_FIELDS = SqlFragmentLibrary.selectThreatTagFields('nt');

export function buildNetworkSlowPathListQuery(
  ctx: FilterBuildContext,
  getFilteredObservationsCte: () => CteResult,
  options: NetworkListOptions
): FilteredQueryResult {
  const {
    limit = null,
    offset = 0,
    orderBy = 'last_observed_at DESC',
    locationMode = 'latest_observation',
  } = options;
  const includeIgnored = ctx.shouldIncludeIgnoredByExplicitTagFilter();
  const { cte } = getFilteredObservationsCte();
  const networkWhere = ctx.buildNetworkWhere();

  const whereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';
  const effectiveWhereClause =
    whereClause.length > 0
      ? includeIgnored
        ? whereClause
        : `${whereClause} AND ${NT_NOT_IGNORED_CLAUSE}`
      : includeIgnored
        ? ''
        : `WHERE ${NT_NOT_IGNORED_CLAUSE}`;

  const sql = `
    ${cte}
    , obs_rollup AS (
      SELECT
        bssid,
        COUNT(*) AS observation_count,
        MIN(time) AS first_observed_at,
        MAX(time) AS last_observed_at,
        COUNT(DISTINCT DATE(time)) AS unique_days,
        COUNT(DISTINCT ST_SnapToGrid(geom, 0.001)) AS unique_locations,
        AVG(level) AS avg_signal,
        MIN(level) AS min_signal,
        MAX(level) AS max_signal
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
        radio_type,
        geom,
        altitude
      FROM filtered_obs
      ORDER BY bssid, time DESC
    )
    SELECT
      ne.bssid,
      COALESCE(l.ssid, ne.ssid) AS ssid,
      CASE
        WHEN l.radio_type IS NULL
          AND l.radio_frequency IS NULL
          AND COALESCE(l.radio_capabilities, '') = ''
        THEN ne.type
        ELSE ${OBS_TYPE_EXPR('l')}
      END AS type,
      CASE
        WHEN COALESCE(l.radio_capabilities, '') = '' THEN ${SECURITY_FROM_CAPS_EXPR('COALESCE(ne.capabilities, ne.security)')}
        ELSE ${SECURITY_EXPR('l')}
      END AS security,
      COALESCE(l.radio_frequency, ne.frequency) AS frequency,
      COALESCE(l.radio_capabilities, ne.security) AS capabilities,
      (ne.frequency BETWEEN 5000 AND 5900) AS is_5ghz,
      (ne.frequency BETWEEN 5925 AND 7125) AS is_6ghz,
      (COALESCE(ne.ssid, '') = '') AS is_hidden,
      ne.first_seen,
      ne.last_seen,
      ${RM_SELECT_FIELDS},
      n.min_altitude_m,
      n.max_altitude_m,
      n.altitude_span_m,
      ne.max_distance_meters,
      n.last_altitude_m,
      COALESCE(n.is_sentinel, FALSE) AS is_sentinel,
      CASE
        WHEN home.home_point IS NOT NULL AND l.lat IS NOT NULL AND l.lon IS NOT NULL
        THEN ST_Distance(
          home.home_point,
          COALESCE(l.geom, ST_SetSRID(ST_MakePoint(l.lon, l.lat), 4326)::geometry)::geography
        ) / 1000.0
        ELSE NULL
      END AS distance_from_home_km,
      r.observation_count AS observations,
      ne.wigle_v3_observation_count,
      ne.wigle_v3_last_import_at,
      r.first_observed_at,
      r.last_observed_at,
      r.unique_days,
      r.unique_locations,
      r.avg_signal,
      r.min_signal,
      r.max_signal,
      l.observed_at,
      COALESCE(l.level, ne.signal) AS signal,
      ${SqlFragmentLibrary.selectLocationCoords('l', locationMode)},
      l.accuracy AS accuracy_meters,
      ne.stationary_confidence,
      ${NT_SELECT_FIELDS},
      COALESCE(nn_agg.notes_count, 0)::integer AS notes_count,
      JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat,
      COALESCE(nts.rule_based_score, ne.rule_based_score) AS rule_based_score,
      COALESCE(nts.ml_threat_score, ne.ml_threat_score) AS ml_threat_score,
      COALESCE((nts.ml_feature_values->>'evidence_weight')::numeric, ne.ml_weight, 0) AS ml_weight,
      COALESCE((nts.ml_feature_values->>'ml_boost')::numeric, ne.ml_boost, 0) AS ml_boost,
      NULL::text AS network_id,
      n.bestlat AS raw_lat,
      n.bestlon AS raw_lon
    FROM obs_rollup r
    JOIN obs_latest l ON l.bssid = r.bssid
      LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(l.bssid)
      LEFT JOIN app.networks n ON UPPER(n.bssid) = UPPER(l.bssid)
      LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(l.bssid)
      ${SqlFragmentLibrary.joinNetworkLocations('l', locationMode)}
      ${SqlFragmentLibrary.joinNetworkTagsLateral('l', 'nt')}
      ${SqlFragmentLibrary.joinRadioManufacturers('l', 'rm')}
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS notes_count
        FROM app.network_notes nn
        WHERE UPPER(nn.bssid) = UPPER(l.bssid)
          AND nn.is_deleted IS NOT TRUE
      ) nn_agg ON TRUE
    ${ctx.requiresHome ? 'CROSS JOIN home' : ''}
    ${effectiveWhereClause}
    ORDER BY ${orderBy}
    LIMIT ${ctx.addParam(limit)} OFFSET ${ctx.addParam(offset)}
  `;

  return {
    sql,
    params: ctx.getParams() as any[],
    appliedFilters: ctx.state.appliedFilters(),
    ignoredFilters: ctx.state.ignoredFilters(),
    warnings: ctx.state.warnings(),
  };
}

export function buildNetworkSlowPathCountQuery(
  ctx: FilterBuildContext,
  getFilteredObservationsCte: () => CteResult
): QueryResult {
  const includeIgnored = ctx.shouldIncludeIgnoredByExplicitTagFilter();
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
    SELECT COUNT(DISTINCT r.bssid) AS total
    FROM obs_rollup r
    JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(r.bssid)
    ${effectiveWhereClause}
  `;

  return { sql, params: ctx.getParams() as any[] };
}
