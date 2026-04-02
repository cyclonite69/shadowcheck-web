import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { FilteredQueryResult, NetworkListOptions } from '../types';
import {
  buildFastPathPredicates,
  buildListChannelExpr,
  NT_IS_IGNORED_EXPR,
  NT_NOT_IGNORED_CLAUSE,
  NT_TAG_LOWER_EXPR,
} from './networkFastPathPredicates';

const RM_SELECT_FIELDS = SqlFragmentLibrary.selectManufacturerFields('rm');
const NT_SELECT_FIELDS = SqlFragmentLibrary.selectThreatTagFields('nt');

function sanitizeFastPathOrderBy(orderBy: string): string {
  return orderBy
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
}

function buildFastPathListSql(
  whereClause: string,
  safeOrderBy: string,
  limitParam: string,
  locationMode: string
): string {
  return `
      SELECT
        ne.bssid,
        ne.ssid AS ssid,
        ne.type AS type,
        ne.security AS security,
        ne.frequency AS frequency,
        ne.capabilities AS capabilities,
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
        ne.observed_at AS observed_at,
        ne.signal AS signal,
        ${SqlFragmentLibrary.selectLocationCoords('ne', locationMode)},
        ne.centroid_lat,
        ne.centroid_lon,
        ne.weighted_lat,
        ne.weighted_lon,
        ne.accuracy_meters AS accuracy_meters,
        ne.stationary_confidence AS stationary_confidence,
        ${NT_SELECT_FIELDS},
        COALESCE(nn_agg.notes_count, 0)::integer AS notes_count,
        JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat,
        ne.rule_based_score,
        ne.ml_threat_score,
        ne.ml_weight,
        ne.ml_boost,
        NULL::text AS network_id,
        n.bestlat AS raw_lat,
        n.bestlon AS raw_lon
      FROM app.api_network_explorer_mv ne
      LEFT JOIN app.networks n ON UPPER(n.bssid) = UPPER(ne.bssid)
      ${SqlFragmentLibrary.joinNetworkLocations('ne', locationMode)}
      ${SqlFragmentLibrary.joinNetworkTagsLateral('ne', 'nt')}
      ${SqlFragmentLibrary.joinRadioManufacturers('ne', 'rm')}
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS notes_count
        FROM app.network_notes nn
        WHERE UPPER(nn.bssid) = UPPER(ne.bssid)
          AND nn.is_deleted IS NOT TRUE
      ) nn_agg ON TRUE
      ${whereClause}
      ORDER BY ${safeOrderBy}
      LIMIT ${limitParam}
    `;
}

export function buildNetworkOnlyQueryImpl(
  ctx: FilterBuildContext,
  options: NetworkListOptions
): FilteredQueryResult {
  const {
    limit = 500,
    offset = 0,
    orderBy = 'last_observed_at DESC',
    locationMode = 'latest_observation',
  } = options;
  const where = buildFastPathPredicates(ctx, {
    ignoredClause: NT_NOT_IGNORED_CLAUSE,
    channelExpr: buildListChannelExpr('ne.frequency'),
    channelWrapComparisons: true,
    tagLowerExpr: NT_TAG_LOWER_EXPR,
    tagIgnoredExpr: NT_IS_IGNORED_EXPR,
    addUnsupportedWigleIgnored: true,
  });

  ctx.params = [...ctx.getParams()];

  const limitParam = ctx.addParam(limit);
  const offsetParam = ctx.addParam(offset);
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const safeOrderBy = sanitizeFastPathOrderBy(orderBy);
  const sql = `${buildFastPathListSql(whereClause, safeOrderBy, limitParam, locationMode)} OFFSET ${offsetParam}`;

  return {
    sql,
    params: ctx.getParams() as any[],
    appliedFilters: ctx.state.appliedFilters(),
    ignoredFilters: ctx.state.ignoredFilters(),
    warnings: ctx.state.warnings(),
  };
}
