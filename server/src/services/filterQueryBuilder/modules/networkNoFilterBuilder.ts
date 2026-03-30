import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import { SECURITY_FROM_CAPS_EXPR } from '../sqlExpressions';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { FilteredQueryResult, NetworkListOptions, QueryResult } from '../types';

const NE_NOT_IGNORED_EXISTS_CLAUSE = `NOT EXISTS (
  SELECT 1
  FROM app.network_tags nt_ignored
  WHERE UPPER(nt_ignored.bssid) = UPPER(ne.bssid)
    AND COALESCE((to_jsonb(nt_ignored)->>'is_ignored')::boolean, FALSE) = TRUE
)`;
const NT_NOT_IGNORED_CLAUSE = 'COALESCE(nt.is_ignored, FALSE) = FALSE';
const RM_SELECT_FIELDS = SqlFragmentLibrary.selectManufacturerFields('rm');
const NT_SELECT_FIELDS = SqlFragmentLibrary.selectThreatTagFields('nt');

export function buildNetworkNoFilterListQuery(
  ctx: FilterBuildContext,
  options: NetworkListOptions = {}
): FilteredQueryResult {
  const { limit = null, offset = 0, orderBy = 'last_observed_at DESC' } = options;
  const includeIgnored = ctx.shouldIncludeIgnoredByExplicitTagFilter();

  ctx.requiresHome = false;

  const safeOrderBy = orderBy
    .replace(/\bl\.observed_at\b/g, 'ne.observed_at')
    .replace(/\bl\.level\b/g, 'ne.signal')
    .replace(/\bl\.lat\b/g, 'ne.lat')
    .replace(/\bl\.lon\b/g, 'ne.lon')
    .replace(/\bl\.accuracy\b/g, 'ne.accuracy_meters')
    .replace(/\br\.observation_count\b/g, 'ne.observations')
    .replace(/\br\.first_observed_at\b/g, 'ne.first_seen')
    .replace(/\br\.last_observed_at\b/g, 'ne.last_seen')
    .replace(/\bne\.stationary_confidence\b/g, 'ne.stationary_confidence')
    .replace(/\bs\.stationary_confidence\b/g, 'ne.stationary_confidence');

  const sql = `
    SELECT
      ne.bssid,
      ne.ssid,
      ne.type,
      ${SECURITY_FROM_CAPS_EXPR('COALESCE(ne.capabilities, ne.security)')} AS security,
      ne.frequency,
      ne.capabilities,
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
      ne.distance_from_home_km,
      ne.observations AS observations,
      ne.wigle_v3_observation_count,
      ne.wigle_v3_last_import_at,
      ne.first_seen AS first_observed_at,
      ne.last_seen AS last_observed_at,
      NULL::integer AS unique_days,
      NULL::integer AS unique_locations,
      NULL::numeric AS avg_signal,
      NULL::numeric AS min_signal,
      NULL::numeric AS max_signal,
      ne.observed_at,
      ne.signal,
      ne.lat,
      ne.lon,
      ne.accuracy_meters AS accuracy_meters,
      NULL::numeric AS stationary_confidence,
      ${NT_SELECT_FIELDS},
      COALESCE(nn_agg.notes_count, 0)::integer AS notes_count,
      JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat,
      ne.rule_based_score,
      ne.ml_threat_score,
      ne.ml_weight,
      ne.ml_boost,
      NULL::text AS network_id
    FROM app.api_network_explorer_mv ne
    LEFT JOIN app.networks n ON UPPER(n.bssid) = UPPER(ne.bssid)
    ${SqlFragmentLibrary.joinNetworkTagsLateral('ne', 'nt')}
    ${SqlFragmentLibrary.joinRadioManufacturers('ne', 'rm')}
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS notes_count
      FROM app.network_notes nn
      WHERE UPPER(nn.bssid) = UPPER(ne.bssid)
        AND nn.is_deleted IS NOT TRUE
    ) nn_agg ON TRUE
    ${includeIgnored ? '' : `WHERE ${NT_NOT_IGNORED_CLAUSE}`}
    ORDER BY ${safeOrderBy}
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

export function buildNetworkNoFilterCountQuery(ctx: FilterBuildContext): QueryResult {
  const includeIgnored = ctx.shouldIncludeIgnoredByExplicitTagFilter();

  if (includeIgnored) {
    return {
      sql: 'SELECT COUNT(*) AS total FROM app.api_network_explorer_mv ne',
      params: [],
    };
  }

  // Optimize: Use table statistics for total count if no filters are applied
  return {
    sql: `SELECT 
            CASE 
              WHEN (SELECT reltuples FROM pg_class WHERE oid = 'app.api_network_explorer_mv'::regclass) > 100000 
              THEN (SELECT reltuples::bigint FROM pg_class WHERE oid = 'app.api_network_explorer_mv'::regclass)
              ELSE (SELECT COUNT(*) FROM app.api_network_explorer_mv ne WHERE ${NE_NOT_IGNORED_EXISTS_CLAUSE})
            END AS total`,
    params: [],
  };
}
