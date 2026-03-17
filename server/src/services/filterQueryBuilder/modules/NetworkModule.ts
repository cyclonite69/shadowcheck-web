import { RELATIVE_WINDOWS, NETWORK_ONLY_FILTERS, type FilterKey } from '../constants';
import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import { FIELD_EXPRESSIONS, NULL_SAFE_COMPARISONS } from '../SchemaCompat';
import { NetworkListQueryBuilder } from '../builders/NetworkListQueryBuilder';
import { NetworkOnlyQueryBuilder } from '../builders/NetworkOnlyQueryBuilder';
import {
  OBS_TYPE_EXPR,
  SECURITY_FROM_CAPS_EXPR,
  SECURITY_EXPR,
  NETWORK_CHANNEL_EXPR,
} from '../sqlExpressions';
import { isOui, coerceOui, splitTextFilterTokens } from '../normalizers';
import { buildRadioPredicates } from '../radioPredicates';
import { buildEngagementPredicates } from '../engagementPredicates';
import type { FilterBuildContext } from '../FilterBuildContext';
import type {
  QueryResult,
  FilteredQueryResult,
  CteResult,
  NetworkListOptions,
  AppliedFilter,
} from '../types';

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
const NT_TAG_LOWER_EXPR = FIELD_EXPRESSIONS.threatTagLowercase('nt');
const NT_IS_IGNORED_EXPR = NULL_SAFE_COMPARISONS.isIgnored('nt');
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
      return this.buildNetworkOnlyQueryImpl({ limit, offset, orderBy });
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
      this.buildNetworkOnlyQueryImpl(options)
    );
    return builder.build();
  }

  private buildNetworkOnlyQueryImpl(options: NetworkListOptions): FilteredQueryResult {
    const { limit = 500, offset = 0, orderBy = 'last_observed_at DESC' } = options;
    const f = this.ctx.filters;
    const e = this.ctx.enabled;
    const where: string[] = [];
    if (!this.ctx.shouldIncludeIgnoredByExplicitTagFilter()) {
      where.push(NT_NOT_IGNORED_CLAUSE);
    }
    const networkTypeExpr = 'ne.type';
    const networkSecurityExpr = SECURITY_FROM_CAPS_EXPR('COALESCE(ne.capabilities, ne.security)');
    const networkFrequencyExpr = 'ne.frequency';
    const networkSignalExpr = 'ne.signal';
    const networkChannelExpr = `
      CASE
        WHEN ${networkFrequencyExpr} BETWEEN 2412 AND 2484 THEN
          CASE
            WHEN ${networkFrequencyExpr} = 2484 THEN 14
            ELSE FLOOR((${networkFrequencyExpr} - 2412) / 5) + 1
          END
        WHEN ${networkFrequencyExpr} BETWEEN 5000 AND 5900 THEN
          FLOOR((${networkFrequencyExpr} - 5000) / 5)
        WHEN ${networkFrequencyExpr} BETWEEN 5925 AND 7125 THEN
          FLOOR((${networkFrequencyExpr} - 5925) / 5)
        ELSE NULL
      END
    `;

    if (e.ssid && f.ssid) {
      const ssidTokens = splitTextFilterTokens(f.ssid);
      const predicates = (ssidTokens.length > 0 ? ssidTokens : [String(f.ssid)]).map(
        (token) => `ne.ssid ILIKE ${this.ctx.addParam(`%${token}%`)}`
      );
      where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
      this.ctx.addApplied('identity', 'ssid', f.ssid);
    }
    if (e.bssid && f.bssid) {
      const bssidTokens = splitTextFilterTokens(f.bssid);
      const predicates = (bssidTokens.length > 0 ? bssidTokens : [String(f.bssid)]).map((token) => {
        const value = token.toUpperCase();
        return value.length === 17
          ? `UPPER(ne.bssid) = ${this.ctx.addParam(value)}`
          : `UPPER(ne.bssid) LIKE ${this.ctx.addParam(`${value}%`)}`;
      });
      where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
      this.ctx.addApplied('identity', 'bssid', f.bssid);
    }
    if (e.manufacturer && f.manufacturer) {
      const manufacturerTokens = splitTextFilterTokens(f.manufacturer);
      const predicates = (
        manufacturerTokens.length > 0 ? manufacturerTokens : [String(f.manufacturer)]
      ).map((token) => {
        const cleaned = coerceOui(token);
        return isOui(cleaned)
          ? `UPPER(REPLACE(SUBSTRING(ne.bssid, 1, 8), ':', '')) = ${this.ctx.addParam(cleaned)}`
          : `ne.manufacturer ILIKE ${this.ctx.addParam(`%${token}%`)}`;
      });
      where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
      this.ctx.addApplied('identity', 'manufacturer', f.manufacturer);
    }
    where.push(
      ...this.applyRadioFilters({
        typeExpr: networkTypeExpr,
        frequencyExpr: networkFrequencyExpr,
        channelExpr: networkChannelExpr,
        signalExpr: networkSignalExpr,
        channelWrapComparisons: true,
      })
    );
    if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
      const securityClauses: string[] = [];
      f.encryptionTypes.forEach((type) => {
        const normalizedType = String(type).trim().toUpperCase();
        const finalType = normalizedType.includes('WEP') ? 'WEP' : normalizedType;

        switch (finalType) {
          case 'OPEN':
            securityClauses.push(`${networkSecurityExpr} = 'OPEN'`);
            break;
          case 'WEP':
            securityClauses.push(`${networkSecurityExpr} = 'WEP'`);
            break;
          case 'WPA':
            securityClauses.push(`${networkSecurityExpr} = 'WPA'`);
            break;
          case 'WPA2-P':
            securityClauses.push(`${networkSecurityExpr} = 'WPA2-P'`);
            break;
          case 'WPA2-E':
            securityClauses.push(`${networkSecurityExpr} = 'WPA2-E'`);
            break;
          case 'WPA2':
            securityClauses.push(`${networkSecurityExpr} IN ('WPA2', 'WPA2-P', 'WPA2-E')`);
            break;
          case 'WPA3-P':
            securityClauses.push(`${networkSecurityExpr} = 'WPA3-P'`);
            break;
          case 'WPA3-E':
            securityClauses.push(`${networkSecurityExpr} = 'WPA3-E'`);
            break;
          case 'WPA3':
            securityClauses.push(`${networkSecurityExpr} IN ('WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`);
            break;
          case 'OWE':
            securityClauses.push(`${networkSecurityExpr} = 'OWE'`);
            break;
          case 'WPS':
            securityClauses.push(`${networkSecurityExpr} = 'WPS'`);
            break;
          case 'UNKNOWN':
            securityClauses.push(`${networkSecurityExpr} = 'UNKNOWN'`);
            break;
          case 'MIXED':
            securityClauses.push(
              `${networkSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA2-E', 'WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`
            );
            break;
        }
      });
      if (securityClauses.length > 0) {
        where.push(`(${securityClauses.join(' OR ')})`);
      }
      this.ctx.addApplied('security', 'encryptionTypes', f.encryptionTypes);
    }
    if (e.securityFlags && Array.isArray(f.securityFlags) && f.securityFlags.length > 0) {
      const flagClauses: string[] = [];
      if (f.securityFlags.includes('insecure')) {
        flagClauses.push(`${networkSecurityExpr} IN ('OPEN', 'WEP', 'WPS')`);
      }
      if (f.securityFlags.includes('deprecated')) {
        flagClauses.push(`${networkSecurityExpr} = 'WEP'`);
      }
      if (f.securityFlags.includes('enterprise')) {
        flagClauses.push(`${networkSecurityExpr} IN ('WPA2-E', 'WPA3-E')`);
      }
      if (f.securityFlags.includes('personal')) {
        flagClauses.push(`${networkSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA3', 'WPA3-P')`);
      }
      if (f.securityFlags.includes('unknown')) {
        flagClauses.push(`${networkSecurityExpr} = 'UNKNOWN'`);
      }
      if (flagClauses.length > 0) {
        where.push(`(${flagClauses.join(' OR ')})`);
        this.ctx.addApplied('security', 'securityFlags', f.securityFlags);
      }
    }
    if (e.observationCountMin && f.observationCountMin !== undefined) {
      where.push(`ne.observations >= ${this.ctx.addParam(f.observationCountMin)}`);
      this.ctx.addApplied('quality', 'observationCountMin', f.observationCountMin);
    }
    if (e.observationCountMax && f.observationCountMax !== undefined) {
      where.push(`ne.observations <= ${this.ctx.addParam(f.observationCountMax)}`);
      this.ctx.addApplied('quality', 'observationCountMax', f.observationCountMax);
    }
    where.push(
      ...this.applyEngagementFilters({
        bssidExpr: 'ne.bssid',
        tagAlias: 'nt',
        tagLowerExpr: NT_TAG_LOWER_EXPR,
        tagIgnoredExpr: NT_IS_IGNORED_EXPR,
      })
    );
    if (e.wigle_v3_observation_count_min && f.wigle_v3_observation_count_min !== undefined) {
      if (this.ctx.context?.pageType === 'wigle') {
        where.push(
          `ne.wigle_v3_observation_count >= ${this.ctx.addParam(f.wigle_v3_observation_count_min)}`
        );
        this.ctx.addApplied(
          'quality',
          'wigle_v3_observation_count_min',
          f.wigle_v3_observation_count_min
        );
      } else {
        this.ctx.addIgnored('quality', 'wigle_v3_observation_count_min', 'unsupported_page');
      }
    }
    if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
      where.push(
        `ne.accuracy_meters IS NOT NULL AND ne.accuracy_meters > 0 AND ne.accuracy_meters <= ${this.ctx.addParam(
          f.gpsAccuracyMax
        )}`
      );
      this.ctx.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
    }
    if (e.excludeInvalidCoords) {
      where.push(
        'ne.lat IS NOT NULL',
        'ne.lon IS NOT NULL',
        'ne.lat BETWEEN -90 AND 90',
        'ne.lon BETWEEN -180 AND 180'
      );
      this.ctx.addApplied('quality', 'excludeInvalidCoords', true);
    }
    if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
      where.push(`ne.distance_from_home_km >= ${this.ctx.addParam(f.distanceFromHomeMin)}`);
      this.ctx.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
    }
    if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
      where.push(`ne.distance_from_home_km <= ${this.ctx.addParam(f.distanceFromHomeMax)}`);
      this.ctx.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
    }
    if (e.threatScoreMin && f.threatScoreMin !== undefined) {
      where.push(
        ...this.ctx.buildThreatScorePredicate({
          min: f.threatScoreMin,
          expr: 'ne.threat_score',
          wrapExpr: false,
        })
      );
      this.ctx.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
    }
    if (e.threatScoreMax && f.threatScoreMax !== undefined) {
      where.push(
        ...this.ctx.buildThreatScorePredicate({
          max: f.threatScoreMax,
          expr: 'ne.threat_score',
          wrapExpr: false,
        })
      );
      this.ctx.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
    }
    if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
      const threatLevelMap: ThreatLevelMap = {
        critical: 'CRITICAL',
        high: 'HIGH',
        medium: 'MEDIUM',
        low: 'LOW',
        none: 'NONE',
      };
      const dbThreatLevels = Array.from(
        new Set(
          f.threatCategories
            .flatMap((cat) => {
              const mapped = threatLevelMap[cat] || cat.toUpperCase();
              if (mapped === 'MEDIUM' || mapped === 'MED') return ['MEDIUM', 'MED'];
              return [mapped];
            })
            .filter(Boolean)
        )
      );
      if (dbThreatLevels.length > 0) {
        where.push(`ne.threat_level = ANY(${this.ctx.addParam(dbThreatLevels)})`);
        this.ctx.addApplied('threat', 'threatCategories', f.threatCategories);
      }
    }
    if (e.stationaryConfidenceMin && f.stationaryConfidenceMin !== undefined) {
      where.push(`ne.stationary_confidence >= ${this.ctx.addParam(f.stationaryConfidenceMin)}`);
      this.ctx.addApplied('threat', 'stationaryConfidenceMin', f.stationaryConfidenceMin);
    }
    if (e.stationaryConfidenceMax && f.stationaryConfidenceMax !== undefined) {
      where.push(`ne.stationary_confidence <= ${this.ctx.addParam(f.stationaryConfidenceMax)}`);
      this.ctx.addApplied('threat', 'stationaryConfidenceMax', f.stationaryConfidenceMax);
    }

    if (e.timeframe && f.timeframe) {
      const scope = f.temporalScope || 'observation_time';
      if (scope === 'threat_window') {
        this.ctx.addWarning('Threat window scope mapped to observation_time on fast path.');
      }
      if (f.timeframe.type === 'absolute') {
        if (f.timeframe.startTimestamp) {
          where.push(
            `ne.last_seen >= ${this.ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`
          );
        }
        if (f.timeframe.endTimestamp) {
          where.push(`ne.last_seen <= ${this.ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`);
        }
      } else {
        const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
        if (window) {
          where.push(`ne.last_seen >= NOW() - ${this.ctx.addParam(window)}::interval`);
        }
      }
      this.ctx.addApplied('temporal', 'timeframe', f.timeframe);
      this.ctx.addApplied('temporal', 'temporalScope', scope);
    }

    this.ctx.params = [...this.ctx.getParams()]; // Ensure consistency

    const limitParam = this.ctx.addParam(limit);
    const offsetParam = this.ctx.addParam(offset);

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
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
        ne.observed_at AS observed_at,
        ne.signal AS signal,
        ne.lat,
        ne.lon,
        ne.accuracy_meters AS accuracy_meters,
        ne.stationary_confidence AS stationary_confidence,
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
      ${whereClause}
      ORDER BY ${safeOrderBy}
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    return {
      sql,
      params: this.ctx.getParams() as any[],
      appliedFilters: this.ctx.state.appliedFilters(),
      ignoredFilters: this.ctx.state.ignoredFilters(),
      warnings: this.ctx.state.warnings(),
    };
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
    const f = this.ctx.filters;
    const e = this.ctx.enabled;
    const where: string[] = [];
    if (!this.ctx.shouldIncludeIgnoredByExplicitTagFilter()) {
      where.push(NE_NOT_IGNORED_EXISTS_CLAUSE);
    }

    if (e.ssid && f.ssid) {
      const ssidTokens = splitTextFilterTokens(f.ssid);
      const predicates = (ssidTokens.length > 0 ? ssidTokens : [String(f.ssid)]).map(
        (token) => `ne.ssid ILIKE ${this.ctx.addParam(`%${token}%`)}`
      );
      where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
      this.ctx.addApplied('identity', 'ssid', f.ssid);
    }
    if (e.bssid && f.bssid) {
      const bssidTokens = splitTextFilterTokens(f.bssid);
      const predicates = (bssidTokens.length > 0 ? bssidTokens : [String(f.bssid)]).map((token) => {
        const value = token.toUpperCase();
        return value.length === 17
          ? `UPPER(ne.bssid) = ${this.ctx.addParam(value)}`
          : `UPPER(ne.bssid) LIKE ${this.ctx.addParam(`${value}%`)}`;
      });
      where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
      this.ctx.addApplied('identity', 'bssid', f.bssid);
    }
    if (e.manufacturer && f.manufacturer) {
      const manufacturerTokens = splitTextFilterTokens(f.manufacturer);
      const predicates = (
        manufacturerTokens.length > 0 ? manufacturerTokens : [String(f.manufacturer)]
      ).map((token) => {
        const cleaned = coerceOui(token);
        return isOui(cleaned)
          ? `UPPER(REPLACE(SUBSTRING(ne.bssid, 1, 8), ':', '')) = ${this.ctx.addParam(cleaned)}`
          : `ne.manufacturer ILIKE ${this.ctx.addParam(`%${token}%`)}`;
      });
      where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
      this.ctx.addApplied('identity', 'manufacturer', f.manufacturer);
    }
    const radioResult = buildRadioPredicates({
      enabled: this.ctx.enabled,
      filters: this.ctx.filters,
      addParam: this.ctx.addParam.bind(this.ctx),
      expressions: {
        typeExpr: 'ne.type',
        frequencyExpr: 'ne.frequency',
        channelExpr: NETWORK_CHANNEL_EXPR('ne'),
        signalExpr: 'ne.signal',
      },
    });
    where.push(...radioResult.where);
    radioResult.applied.forEach((entry) => this.ctx.addApplied('radio', entry.field, entry.value));
    if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
      const networkSecurityExpr = SECURITY_FROM_CAPS_EXPR('COALESCE(ne.capabilities, ne.security)');
      const securityClauses: string[] = [];
      f.encryptionTypes.forEach((type) => {
        const normalizedType = String(type).trim().toUpperCase();
        const finalType = normalizedType.includes('WEP') ? 'WEP' : normalizedType;
        switch (finalType) {
          case 'OPEN':
            securityClauses.push(`${networkSecurityExpr} = 'OPEN'`);
            break;
          case 'WEP':
            securityClauses.push(`${networkSecurityExpr} = 'WEP'`);
            break;
          case 'WPA':
            securityClauses.push(`${networkSecurityExpr} = 'WPA'`);
            break;
          case 'WPA2-P':
            securityClauses.push(`${networkSecurityExpr} = 'WPA2-P'`);
            break;
          case 'WPA2-E':
            securityClauses.push(`${networkSecurityExpr} = 'WPA2-E'`);
            break;
          case 'WPA2':
            securityClauses.push(`${networkSecurityExpr} IN ('WPA2', 'WPA2-P', 'WPA2-E')`);
            break;
          case 'WPA3-P':
            securityClauses.push(`${networkSecurityExpr} = 'WPA3-P'`);
            break;
          case 'WPA3-E':
            securityClauses.push(`${networkSecurityExpr} = 'WPA3-E'`);
            break;
          case 'WPA3':
            securityClauses.push(`${networkSecurityExpr} IN ('WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`);
            break;
          case 'OWE':
            securityClauses.push(`${networkSecurityExpr} = 'OWE'`);
            break;
          case 'WPS':
            securityClauses.push(`${networkSecurityExpr} = 'WPS'`);
            break;
          case 'UNKNOWN':
            securityClauses.push(`${networkSecurityExpr} = 'UNKNOWN'`);
            break;
          case 'MIXED':
            securityClauses.push(
              `${networkSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA2-E', 'WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`
            );
            break;
          default:
            securityClauses.push(`${networkSecurityExpr} = ${this.ctx.addParam(finalType)}`);
            break;
        }
      });
      if (securityClauses.length > 0) {
        where.push(`(${securityClauses.join(' OR ')})`);
        this.ctx.addApplied('security', 'encryptionTypes', f.encryptionTypes);
      }
    }
    if (e.securityFlags && Array.isArray(f.securityFlags) && f.securityFlags.length > 0) {
      const networkSecurityExpr = SECURITY_FROM_CAPS_EXPR('COALESCE(ne.capabilities, ne.security)');
      const flagClauses: string[] = [];
      if (f.securityFlags.includes('insecure')) {
        flagClauses.push(`${networkSecurityExpr} IN ('OPEN', 'WEP', 'WPS')`);
      }
      if (f.securityFlags.includes('deprecated')) {
        flagClauses.push(`${networkSecurityExpr} = 'WEP'`);
      }
      if (f.securityFlags.includes('enterprise')) {
        flagClauses.push(`${networkSecurityExpr} IN ('WPA2-E', 'WPA3-E')`);
      }
      if (f.securityFlags.includes('personal')) {
        flagClauses.push(`${networkSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA3', 'WPA3-P')`);
      }
      if (f.securityFlags.includes('unknown')) {
        flagClauses.push(`${networkSecurityExpr} = 'UNKNOWN'`);
      }
      if (flagClauses.length > 0) {
        where.push(`(${flagClauses.join(' OR ')})`);
        this.ctx.addApplied('security', 'securityFlags', f.securityFlags);
      }
    }
    if (e.observationCountMin && f.observationCountMin !== undefined) {
      where.push(`ne.observations >= ${this.ctx.addParam(f.observationCountMin)}`);
      this.ctx.addApplied('quality', 'observationCountMin', f.observationCountMin);
    }
    if (e.observationCountMax && f.observationCountMax !== undefined) {
      where.push(`ne.observations <= ${this.ctx.addParam(f.observationCountMax)}`);
      this.ctx.addApplied('quality', 'observationCountMax', f.observationCountMax);
    }
    const engagementResult = buildEngagementPredicates({
      enabled: this.ctx.enabled,
      filters: this.ctx.filters,
      addParam: this.ctx.addParam.bind(this.ctx),
      bssidExpr: 'ne.bssid',
      tagAlias: 'nt',
      tagLowerExpr: NT_TAG_LOWER_EXPR,
      tagIgnoredExpr: NT_IS_IGNORED_EXPR,
    });
    where.push(...engagementResult.where);
    engagementResult.applied.forEach((entry) =>
      this.ctx.addApplied('engagement', entry.field, entry.value)
    );
    if (e.wigle_v3_observation_count_min && f.wigle_v3_observation_count_min !== undefined) {
      if (this.ctx.context?.pageType === 'wigle') {
        where.push(
          `ne.wigle_v3_observation_count >= ${this.ctx.addParam(f.wigle_v3_observation_count_min)}`
        );
        this.ctx.addApplied(
          'quality',
          'wigle_v3_observation_count_min',
          f.wigle_v3_observation_count_min
        );
      }
    }
    if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
      where.push(
        `ne.accuracy_meters IS NOT NULL AND ne.accuracy_meters > 0 AND ne.accuracy_meters <= ${this.ctx.addParam(
          f.gpsAccuracyMax
        )}`
      );
      this.ctx.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
    }
    if (e.excludeInvalidCoords) {
      where.push(
        'ne.lat IS NOT NULL',
        'ne.lon IS NOT NULL',
        'ne.lat BETWEEN -90 AND 90',
        'ne.lon BETWEEN -180 AND 180'
      );
      this.ctx.addApplied('quality', 'excludeInvalidCoords', true);
    }
    if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
      where.push(`ne.distance_from_home_km >= ${this.ctx.addParam(f.distanceFromHomeMin)}`);
      this.ctx.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
    }
    if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
      where.push(`ne.distance_from_home_km <= ${this.ctx.addParam(f.distanceFromHomeMax)}`);
      this.ctx.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
    }
    if (e.threatScoreMin && f.threatScoreMin !== undefined) {
      where.push(
        ...this.ctx.buildThreatScorePredicate({
          min: f.threatScoreMin,
          expr: 'ne.threat_score',
          wrapExpr: false,
        })
      );
      this.ctx.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
    }
    if (e.threatScoreMax && f.threatScoreMax !== undefined) {
      where.push(
        ...this.ctx.buildThreatScorePredicate({
          max: f.threatScoreMax,
          expr: 'ne.threat_score',
          wrapExpr: false,
        })
      );
      this.ctx.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
    }
    if (e.stationaryConfidenceMin && f.stationaryConfidenceMin !== undefined) {
      where.push(`ne.stationary_confidence >= ${this.ctx.addParam(f.stationaryConfidenceMin)}`);
      this.ctx.addApplied('threat', 'stationaryConfidenceMin', f.stationaryConfidenceMin);
    }
    if (e.stationaryConfidenceMax && f.stationaryConfidenceMax !== undefined) {
      where.push(`ne.stationary_confidence <= ${this.ctx.addParam(f.stationaryConfidenceMax)}`);
      this.ctx.addApplied('threat', 'stationaryConfidenceMax', f.stationaryConfidenceMax);
    }
    if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
      const threatLevelMap: ThreatLevelMap = {
        critical: 'CRITICAL',
        high: 'HIGH',
        medium: 'MEDIUM',
        low: 'LOW',
        none: 'NONE',
      };
      const dbThreatLevels = Array.from(
        new Set(
          f.threatCategories
            .flatMap((cat) => {
              const mapped = threatLevelMap[cat] || cat.toUpperCase();
              if (mapped === 'MEDIUM' || mapped === 'MED') return ['MEDIUM', 'MED'];
              return [mapped];
            })
            .filter(Boolean)
        )
      );
      where.push(`ne.threat_level = ANY(${this.ctx.addParam(dbThreatLevels)})`);
      this.ctx.addApplied('threat', 'threatCategories', f.threatCategories);
    }
    if (e.timeframe && f.timeframe) {
      const scope = f.temporalScope || 'observation_time';
      if (f.timeframe.type === 'absolute') {
        if (f.timeframe.startTimestamp) {
          where.push(
            `ne.last_seen >= ${this.ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`
          );
        }
        if (f.timeframe.endTimestamp) {
          where.push(`ne.last_seen <= ${this.ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`);
        }
      } else {
        const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
        if (window) {
          where.push(`ne.last_seen >= NOW() - ${this.ctx.addParam(window)}::interval`);
        }
      }
      this.ctx.addApplied('temporal', 'timeframe', f.timeframe);
      this.ctx.addApplied('temporal', 'temporalScope', scope);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return {
      sql: `SELECT COUNT(*) AS total FROM app.api_network_explorer_mv ne
            ${whereClause}`,
      params: [...this.ctx.params],
    };
  }

  private applyRadioFilters(options: {
    typeExpr: string;
    frequencyExpr: string;
    channelExpr: string;
    signalExpr: string;
    channelWrapComparisons?: boolean;
    rssiRequireNotNullExpr?: string;
    rssiIncludeNoiseFloor?: boolean;
  }): string[] {
    const result = buildRadioPredicates({
      enabled: this.ctx.enabled,
      filters: this.ctx.filters,
      addParam: this.ctx.addParam.bind(this.ctx),
      expressions: {
        typeExpr: options.typeExpr,
        frequencyExpr: options.frequencyExpr,
        channelExpr: options.channelExpr,
        signalExpr: options.signalExpr,
      },
      options: {
        channelWrapComparisons: options.channelWrapComparisons,
        rssiRequireNotNullExpr: options.rssiRequireNotNullExpr,
        rssiIncludeNoiseFloor: options.rssiIncludeNoiseFloor,
      },
    });

    result.applied.forEach((entry) => this.ctx.addApplied('radio', entry.field, entry.value));
    return result.where;
  }

  private applyEngagementFilters(options: {
    bssidExpr: string;
    tagAlias: string;
    tagLowerExpr: string;
    tagIgnoredExpr: string;
  }): string[] {
    const result = buildEngagementPredicates({
      enabled: this.ctx.enabled,
      filters: this.ctx.filters,
      addParam: this.ctx.addParam.bind(this.ctx),
      bssidExpr: options.bssidExpr,
      tagAlias: options.tagAlias,
      tagLowerExpr: options.tagLowerExpr,
      tagIgnoredExpr: options.tagIgnoredExpr,
    });

    result.applied.forEach((entry) => this.ctx.addApplied('engagement', entry.field, entry.value));
    return result.where;
  }
}
