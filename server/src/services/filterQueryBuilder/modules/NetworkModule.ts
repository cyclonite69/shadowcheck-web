import { RELATIVE_WINDOWS, NETWORK_ONLY_FILTERS, type FilterKey } from '../constants';
import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import { FIELD_EXPRESSIONS, NULL_SAFE_COMPARISONS } from '../SchemaCompat';
import { NetworkListQueryBuilder } from '../builders/NetworkListQueryBuilder';
import { NetworkOnlyQueryBuilder } from '../builders/NetworkOnlyQueryBuilder';
import { OBS_TYPE_EXPR, SECURITY_FROM_CAPS_EXPR, SECURITY_EXPR } from '../sqlExpressions';
import type { FilterBuildContext } from '../FilterBuildContext';
import type {
  QueryResult,
  FilteredQueryResult,
  CteResult,
  NetworkListOptions,
  AppliedFilter,
} from '../types';
import { applyEngagementFilters, applyRadioFilters } from './networkPredicateAdapters';
import { buildNetworkOnlyCountQuery, buildNetworkOnlyQueryImpl } from './networkFastPathBuilder';

const logger = require('../../../logging/logger');

interface ThreatLevelMap {
  [key: string]: string;
}

const NE_NOT_IGNORED_EXISTS_CLAUSE = `NOT EXISTS (
  SELECT 1
  FROM app.network_tags nt_ignored
  WHERE UPPER(nt_ignored.bssid) = UPPER(ne.bssid)
    AND COALESCE((to_jsonb(nt_ignored)->>'is_ignored')::boolean, FALSE) = TRUE
)`;
const NT_FILTER_TAG_LOWER_EXPR = FIELD_EXPRESSIONS.threatTagLowercase('nt_filter');
const NT_FILTER_IS_IGNORED_EXPR = NULL_SAFE_COMPARISONS.isIgnored('nt_filter');
const NT_NOT_IGNORED_CLAUSE = 'COALESCE(nt.is_ignored, FALSE) = FALSE';
const RM_SELECT_FIELDS = SqlFragmentLibrary.selectManufacturerFields('rm');
const NT_SELECT_FIELDS = SqlFragmentLibrary.selectThreatTagFields('nt');

export class NetworkModule {
  constructor(
    private ctx: FilterBuildContext,
    private getFilteredObservationsCte: () => CteResult
  ) {}

  public buildNetworkListQuery(options: NetworkListOptions = {}): FilteredQueryResult {
    const builder = new NetworkListQueryBuilder(this.ctx.context as any, () =>
      this.buildNetworkListQueryImpl(options)
    );
    return builder.build();
  }

  private buildNetworkListQueryImpl(options: NetworkListOptions = {}): FilteredQueryResult {
    const { limit = null, offset = 0, orderBy = 'last_observed_at DESC' } = options;
    const includeIgnored = this.ctx.shouldIncludeIgnoredByExplicitTagFilter();

    this.ctx.requiresHome = true;

    const noFiltersEnabled = Object.values(this.ctx.enabled).every((value) => !value);
    if (noFiltersEnabled) {
      this.ctx.requiresHome = false;
      const safeOrderBy = orderBy
        .replace(/\bl\.observed_at\b/g, 'ne.observed_at')
        .replace(/\bl\.level\b/g, 'ne.signal')
        .replace(/\bl\.lat\b/g, 'ne.lat')
        .replace(/\bl\.lon\b/g, 'ne.lon')
        .replace(/\bl\.accuracy\b/g, 'ne.accuracy_meters')
        .replace(/\br\.observation_count\b/g, 'ne.observations')
        .replace(/\br\.first_observed_at\b/g, 'ne.first_seen')
        .replace(/\br\.last_observed_at\b/g, 'ne.last_seen')
        .replace(/\bs\.stationary_confidence\b/g, 'ne.last_seen');

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
          NULL::numeric AS min_altitude_m,
          NULL::numeric AS max_altitude_m,
          NULL::numeric AS altitude_span_m,
          ne.max_distance_meters,
          NULL::numeric AS last_altitude_m,
          FALSE AS is_sentinel,
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
          (
            SELECT COUNT(*)
            FROM app.network_notes nn
            WHERE UPPER(nn.bssid) = UPPER(ne.bssid)
              AND nn.is_deleted IS NOT TRUE
          )::integer AS notes_count,
          JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat,
          NULL::text AS network_id
        FROM app.api_network_explorer_mv ne
        ${SqlFragmentLibrary.joinNetworkTagsLateral('ne', 'nt')}
        ${SqlFragmentLibrary.joinRadioManufacturers('ne', 'rm')}
        ${includeIgnored ? '' : `WHERE ${NT_NOT_IGNORED_CLAUSE}`}
        ORDER BY ${safeOrderBy}
        LIMIT ${this.ctx.addParam(limit)} OFFSET ${this.ctx.addParam(offset)}
      `;

      return {
        sql,
        params: this.ctx.getParams() as any[],
        appliedFilters: this.ctx.state.appliedFilters(),
        ignoredFilters: this.ctx.state.ignoredFilters(),
        warnings: this.ctx.state.warnings(),
      };
    }

    const enabledKeys = Object.entries(this.ctx.enabled)
      .filter(([, value]) => value)
      .map(([key]) => key);
    const networkOnly = this.ctx.isFastPathEligible(enabledKeys);

    if (networkOnly) {
      if (this.ctx.perfTracker) {
        this.ctx.perfTracker.setPath('fast');
      }
      if (this.ctx.context?.mode === 'network-only') {
        return this.buildNetworkOnlyQuery({ limit, offset, orderBy });
      }
      return buildNetworkOnlyQueryImpl(this.ctx, { limit, offset, orderBy });
    }

    if (this.ctx.perfTracker) {
      this.ctx.perfTracker.setPath('slow');
    }
    const { cte, params } = this.getFilteredObservationsCte();
    const networkWhere = this.ctx.buildNetworkWhere();

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
        NULL::numeric AS min_altitude_m,
        NULL::numeric AS max_altitude_m,
        NULL::numeric AS altitude_span_m,
        ne.max_distance_meters,
        NULL::numeric AS last_altitude_m,
        FALSE AS is_sentinel,
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
        l.lat,
        l.lon,
        l.accuracy AS accuracy_meters,
        ne.stationary_confidence,
        ${NT_SELECT_FIELDS},
        (
          SELECT COUNT(*)
          FROM app.network_notes nn
          WHERE UPPER(nn.bssid) = UPPER(l.bssid)
            AND nn.is_deleted IS NOT TRUE
        )::integer AS notes_count,
        JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat,
        NULL::text AS network_id
      FROM obs_rollup r
      JOIN obs_latest l ON l.bssid = r.bssid
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(l.bssid)
        LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(l.bssid)
        ${SqlFragmentLibrary.joinNetworkTagsLateral('l', 'nt')}
        ${SqlFragmentLibrary.joinRadioManufacturers('l', 'rm')}
      ${this.ctx.requiresHome ? 'CROSS JOIN home' : ''}
      ${effectiveWhereClause}
      ORDER BY ${orderBy}
      LIMIT ${this.ctx.addParam(limit)} OFFSET ${this.ctx.addParam(offset)}
    `;

    return {
      sql,
      params: this.ctx.getParams() as any[],
      appliedFilters: this.ctx.state.appliedFilters(),
      ignoredFilters: this.ctx.state.ignoredFilters(),
      warnings: this.ctx.state.warnings(),
    };
  }

  public buildNetworkOnlyQuery(options: NetworkListOptions): FilteredQueryResult {
    const builder = new NetworkOnlyQueryBuilder(this.ctx.context as any, () =>
      buildNetworkOnlyQueryImpl(this.ctx, options)
    );
    return builder.build();
  }

  public buildNetworkCountQuery(): QueryResult {
    const includeIgnored = this.ctx.shouldIncludeIgnoredByExplicitTagFilter();
    const noFiltersEnabled = Object.values(this.ctx.enabled).every((value) => !value);
    if (noFiltersEnabled) {
      return {
        sql: `SELECT COUNT(*) AS total
              FROM app.api_network_explorer_mv ne
              ${includeIgnored ? '' : `WHERE ${NE_NOT_IGNORED_EXISTS_CLAUSE}`}`,
        params: [],
      };
    }

    const enabledKeys = Object.entries(this.ctx.enabled)
      .filter(([, value]) => value)
      .map(([key]) => key);
    const networkOnly = this.ctx.isFastPathEligible(enabledKeys);
    if (networkOnly) {
      return this.buildNetworkOnlyCountQuery();
    }

    // SLOW PATH
    const { cte } = this.getFilteredObservationsCte(); // Ignore CTE params, they are already in this.ctx
    const networkWhere = this.ctx.buildNetworkWhere();
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

    return { sql, params: this.ctx.getParams() as any[] };
  }

  public buildDashboardMetricsQuery(): QueryResult {
    const includeIgnored = this.ctx.shouldIncludeIgnoredByExplicitTagFilter();
    const enabledKeys = Object.entries(this.ctx.enabled)
      .filter(([, value]) => value)
      .map(([key]) => key);
    const networkOnly = this.ctx.isFastPathEligible(enabledKeys);

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
      const countResult = this.buildNetworkOnlyCountQuery();
      const whereIdx = countResult.sql.indexOf('WHERE');
      const whereClause = whereIdx !== -1 ? countResult.sql.substring(whereIdx) : '';

      return {
        sql: `SELECT ${selectClause} FROM app.api_network_explorer_mv ne ${whereClause}`,
        params: countResult.params,
      };
    }

    // SLOW PATH
    const { cte } = this.getFilteredObservationsCte(); // Already in this.ctx
    const networkWhere = this.ctx.buildNetworkWhere();
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

    return { sql, params: this.ctx.getParams() as any[] };
  }

  private buildNetworkOnlyCountQuery(): QueryResult {
    return buildNetworkOnlyCountQuery(this.ctx);
  }
}
