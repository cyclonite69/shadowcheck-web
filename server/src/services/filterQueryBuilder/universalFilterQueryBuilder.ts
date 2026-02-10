/**
 * Universal Filter Query Builder
 * Forensically correct, parameterized SQL with explicit enable flags.
 */

const logger = require('../../logging/logger');

import {
  NOISE_FLOOR_DBM,
  RELATIVE_WINDOWS,
  NETWORK_ONLY_FILTERS,
  type FilterKey,
} from './constants';
import {
  OBS_TYPE_EXPR,
  SECURITY_EXPR,
  WIFI_CHANNEL_EXPR,
  NETWORK_CHANNEL_EXPR,
  THREAT_SCORE_EXPR,
  THREAT_LEVEL_EXPR,
} from './sqlExpressions';
import { isOui, coerceOui } from './normalizers';
import { validateFilterPayload } from './validators';
import type {
  Filters,
  EnabledFlags,
  AppliedFilter,
  IgnoredFilter,
  QueryResult,
  FilteredQueryResult,
  CteResult,
  ObservationFiltersResult,
  NetworkListOptions,
  GeospatialOptions,
  AnalyticsOptions,
  AnalyticsQueries,
} from './types';

interface ThreatLevelMap {
  [key: string]: string;
}

class UniversalFilterQueryBuilder {
  private filters: Filters;
  private enabled: EnabledFlags;
  private params: unknown[];
  private paramIndex: number;
  private appliedFilters: AppliedFilter[];
  private ignoredFilters: IgnoredFilter[];
  private warnings: string[];
  private obsJoins: Set<string>;
  private requiresHome: boolean;

  constructor(filters: unknown, enabled: unknown) {
    const { filters: normalized, enabled: flags } = validateFilterPayload(filters, enabled);
    this.filters = normalized;
    this.enabled = flags;
    this.params = [];
    this.paramIndex = 1;
    this.appliedFilters = [];
    this.ignoredFilters = [];
    this.warnings = [];
    this.obsJoins = new Set();
    this.requiresHome = false;
  }

  private addParam(value: unknown): string {
    this.params.push(value);
    const index = this.paramIndex;
    this.paramIndex += 1;
    return `$${index}`;
  }

  private addApplied(type: string, field: string, value: unknown): void {
    this.appliedFilters.push({ type, field, value });
  }

  private addIgnored(type: string, field: string, reason: string): void {
    this.ignoredFilters.push({ type, field, reason });
  }

  buildObservationFilters(): ObservationFiltersResult {
    const where: string[] = [];
    const f = this.filters;
    const e = this.enabled;

    if (e.excludeInvalidCoords) {
      where.push(
        'o.lat IS NOT NULL',
        'o.lon IS NOT NULL',
        'o.lat BETWEEN -90 AND 90',
        'o.lon BETWEEN -180 AND 180'
      );
      this.addApplied('quality', 'excludeInvalidCoords', true);
    }

    if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
      where.push(
        `o.accuracy IS NOT NULL AND o.accuracy > 0 AND o.accuracy <= ${this.addParam(
          f.gpsAccuracyMax
        )}`
      );
      this.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
    }

    if (e.ssid && f.ssid) {
      where.push(`o.ssid ILIKE ${this.addParam(`%${f.ssid}%`)}`);
      this.addApplied('identity', 'ssid', f.ssid);
    }

    if (e.bssid && f.bssid) {
      const value = String(f.bssid).toUpperCase();
      if (value.length === 17) {
        where.push(`o.bssid = ${this.addParam(value)}`);
      } else {
        where.push(`o.bssid LIKE ${this.addParam(`${value}%`)}`);
      }
      this.addApplied('identity', 'bssid', f.bssid);
    }

    if (e.manufacturer && f.manufacturer) {
      const cleaned = coerceOui(f.manufacturer);
      this.obsJoins.add('JOIN app.networks ap ON UPPER(ap.bssid) = UPPER(o.bssid)');
      this.obsJoins.add(
        "LEFT JOIN app.radio_manufacturers rm ON rm.prefix_24bit = UPPER(REPLACE(SUBSTRING(ap.bssid, 1, 8), ':', ''))"
      );
      if (isOui(cleaned)) {
        where.push(`rm.prefix_24bit = ${this.addParam(cleaned)}`);
        this.addApplied('identity', 'manufacturerOui', cleaned);
      } else {
        where.push(`rm.organization_name ILIKE ${this.addParam(`%${f.manufacturer}%`)}`);
        this.addApplied('identity', 'manufacturer', f.manufacturer);
      }
    }

    if (e.networkId && f.networkId) {
      this.addIgnored('identity', 'networkId', 'unsupported_backend');
      this.warnings.push('networkId filter ignored (app.networks not available).');
    }

    if (e.radioTypes && Array.isArray(f.radioTypes) && f.radioTypes.length > 0) {
      where.push(`${OBS_TYPE_EXPR('o')} = ANY(${this.addParam(f.radioTypes)})`);
      this.addApplied('radio', 'radioTypes', f.radioTypes);
    }

    if (e.frequencyBands && Array.isArray(f.frequencyBands) && f.frequencyBands.length > 0) {
      const bandConditions = f.frequencyBands.map((band) => {
        if (band === '2.4GHz') {
          return '(o.radio_frequency BETWEEN 2412 AND 2484)';
        }
        if (band === '5GHz') {
          return '(o.radio_frequency BETWEEN 5000 AND 5900)';
        }
        if (band === '6GHz') {
          return '(o.radio_frequency BETWEEN 5925 AND 7125)';
        }
        if (band === 'BLE') {
          return `${OBS_TYPE_EXPR('o')} = 'E'`;
        }
        if (band === 'Cellular') {
          return `${OBS_TYPE_EXPR('o')} IN ('L', 'G', 'N')`;
        }
        return null;
      });
      const clauses = bandConditions.filter(Boolean);
      if (clauses.length > 0) {
        where.push(`(${clauses.join(' OR ')})`);
        this.addApplied('radio', 'frequencyBands', f.frequencyBands);
      }
    }

    if (e.channelMin && f.channelMin !== undefined) {
      where.push(`${WIFI_CHANNEL_EXPR('o')} >= ${this.addParam(f.channelMin)}`);
      this.addApplied('radio', 'channelMin', f.channelMin);
    }

    if (e.channelMax && f.channelMax !== undefined) {
      where.push(`${WIFI_CHANNEL_EXPR('o')} <= ${this.addParam(f.channelMax)}`);
      this.addApplied('radio', 'channelMax', f.channelMax);
    }

    if (e.rssiMin && f.rssiMin !== undefined) {
      where.push('o.level IS NOT NULL');
      where.push(`o.level >= ${this.addParam(NOISE_FLOOR_DBM)}`);
      where.push(`o.level >= ${this.addParam(f.rssiMin)}`);
      this.addApplied('radio', 'rssiMin', f.rssiMin);
    }

    if (e.rssiMax && f.rssiMax !== undefined) {
      where.push('o.level IS NOT NULL');
      where.push(`o.level >= ${this.addParam(NOISE_FLOOR_DBM)}`);
      where.push(`o.level <= ${this.addParam(f.rssiMax)}`);
      this.addApplied('radio', 'rssiMax', f.rssiMax);
    }

    // Quality filters for anomalous data
    if (e.qualityFilter && f.qualityFilter && f.qualityFilter !== 'none') {
      if (process.env.DEBUG_FILTERS === 'true') {
        logger.debug(`Quality filter applied: ${f.qualityFilter}`);
      }
      const { DATA_QUALITY_FILTERS } = require('../dataQualityFilters');
      let qualityWhere = '';
      if (f.qualityFilter === 'temporal') {
        qualityWhere = DATA_QUALITY_FILTERS.temporal_clusters;
      } else if (f.qualityFilter === 'extreme') {
        qualityWhere = DATA_QUALITY_FILTERS.extreme_signals;
      } else if (f.qualityFilter === 'duplicate') {
        qualityWhere = DATA_QUALITY_FILTERS.duplicate_coords;
      } else if (f.qualityFilter === 'all') {
        qualityWhere = DATA_QUALITY_FILTERS.all();
      }

      if (qualityWhere) {
        // Remove the leading "AND" from the filter
        const cleanFilter = qualityWhere.replace(/^\s*AND\s+/, '');
        where.push(`(${cleanFilter})`);
        this.addApplied('quality', 'qualityFilter', f.qualityFilter);
        if (process.env.DEBUG_FILTERS === 'true') {
          logger.debug(`Quality where clause: ${cleanFilter}`);
        }
      }
    } else {
      if (process.env.DEBUG_FILTERS === 'true') {
        logger.debug('Quality filter not applied', {
          enabled: e.qualityFilter,
          value: f.qualityFilter,
        });
      }
    }

    // Handle security-related filters (encryption types and auth methods)
    const securityClauses: string[] = [];

    if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
      // Normalize and use computed security expression that matches materialized view logic
      f.encryptionTypes.forEach((type) => {
        const normalizedType = String(type).trim().toUpperCase();
        // Map any value containing 'WEP' to 'WEP'
        const finalType = normalizedType.includes('WEP') ? 'WEP' : normalizedType;

        switch (finalType) {
          case 'OPEN':
            securityClauses.push(`${SECURITY_EXPR('o')} = 'OPEN'`);
            break;
          case 'WEP':
            securityClauses.push(`${SECURITY_EXPR('o')} = 'WEP'`);
            break;
          case 'WPA':
            securityClauses.push(`${SECURITY_EXPR('o')} = 'WPA'`);
            break;
          case 'WPA2':
            securityClauses.push(`${SECURITY_EXPR('o')} IN ('WPA2', 'WPA2-E')`);
            break;
          case 'WPA3':
            securityClauses.push(
              `${SECURITY_EXPR('o')} IN ('WPA3', 'WPA3-SAE', 'WPA3-OWE', 'WPA3-E')`
            );
            break;
        }
      });
      this.addApplied('security', 'encryptionTypes', f.encryptionTypes);
    }

    if (e.authMethods && Array.isArray(f.authMethods) && f.authMethods.length > 0) {
      // Map auth methods to security expression patterns
      f.authMethods.forEach((method) => {
        switch (method) {
          case 'PSK':
            securityClauses.push(`${SECURITY_EXPR('o')} IN ('WPA', 'WPA2', 'WPA3', 'WPA3-SAE')`);
            break;
          case 'Enterprise':
            securityClauses.push(`${SECURITY_EXPR('o')} IN ('WPA2-E', 'WPA3-E')`);
            break;
          case 'SAE':
            securityClauses.push(`${SECURITY_EXPR('o')} IN ('WPA3', 'WPA3-SAE')`);
            break;
          case 'OWE':
            securityClauses.push(`${SECURITY_EXPR('o')} = 'WPA3-OWE'`);
            break;
          case 'None':
            securityClauses.push(`${SECURITY_EXPR('o')} = 'OPEN'`);
            break;
        }
      });
      this.addApplied('security', 'authMethods', f.authMethods);
    }

    // Combine all security clauses with OR logic
    if (securityClauses.length > 0) {
      where.push(`(${securityClauses.join(' OR ')})`);
    }

    if (e.insecureFlags && Array.isArray(f.insecureFlags) && f.insecureFlags.length > 0) {
      const insecureClauses: string[] = [];
      if (f.insecureFlags.includes('open')) {
        insecureClauses.push(`${SECURITY_EXPR('o')} = 'OPEN'`);
      }
      if (f.insecureFlags.includes('wep')) {
        insecureClauses.push(`${SECURITY_EXPR('o')} = 'WEP'`);
      }
      if (f.insecureFlags.includes('wps')) {
        insecureClauses.push(`${SECURITY_EXPR('o')} = 'WPS'`);
      }
      if (f.insecureFlags.includes('deprecated')) {
        insecureClauses.push(`${SECURITY_EXPR('o')} IN ('WEP', 'WPS')`);
      }
      if (insecureClauses.length > 0) {
        where.push(`(${insecureClauses.join(' OR ')})`);
        this.addApplied('security', 'insecureFlags', f.insecureFlags);
      }
    }

    if (e.securityFlags && Array.isArray(f.securityFlags) && f.securityFlags.length > 0) {
      const flagClauses: string[] = [];
      if (f.securityFlags.includes('insecure')) {
        flagClauses.push(`${SECURITY_EXPR('o')} IN ('OPEN', 'WEP', 'WPS')`);
      }
      if (f.securityFlags.includes('deprecated')) {
        flagClauses.push(`${SECURITY_EXPR('o')} = 'WEP'`);
      }
      if (f.securityFlags.includes('enterprise')) {
        flagClauses.push(`${SECURITY_EXPR('o')} IN ('WPA2-E', 'WPA3-E')`);
      }
      if (f.securityFlags.includes('personal')) {
        flagClauses.push(`${SECURITY_EXPR('o')} IN ('WPA', 'WPA2', 'WPA3', 'WPA3-SAE')`);
      }
      if (f.securityFlags.includes('unknown')) {
        flagClauses.push(`${SECURITY_EXPR('o')} = 'Unknown'`);
      }
      if (flagClauses.length > 0) {
        where.push(`(${flagClauses.join(' OR ')})`);
        this.addApplied('security', 'securityFlags', f.securityFlags);
      }
    }

    if (e.timeframe && f.timeframe) {
      const normalizeTimestamp = (value: string | undefined): string | null => {
        if (!value || value === 'null' || value === 'undefined') {
          return null;
        }
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : value;
      };
      const scope = f.temporalScope || 'observation_time';
      if (scope === 'network_lifetime') {
        this.obsJoins.add('JOIN app.networks ap ON UPPER(ap.bssid) = UPPER(o.bssid)');
      }
      if (scope === 'threat_window') {
        this.warnings.push(
          'Threat window scope mapped to observation_time (no threat timestamps).'
        );
      }
      if (f.timeframe.type === 'absolute') {
        const startTarget = scope === 'network_lifetime' ? 'ap.first_seen_at' : 'o.time';
        const endTarget = scope === 'network_lifetime' ? 'ap.last_seen_at' : 'o.time';
        const startValue = normalizeTimestamp(f.timeframe.startTimestamp);
        const endValue = normalizeTimestamp(f.timeframe.endTimestamp);
        const startParam = this.addParam(startValue);
        const endParam = this.addParam(endValue);

        where.push(`(${startParam}::timestamptz IS NULL OR ${startTarget} >= ${startParam})`);
        where.push(`(${endParam}::timestamptz IS NULL OR ${endTarget} <= ${endParam})`);
      } else {
        const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
        const target = scope === 'network_lifetime' ? 'ap.last_seen_at' : 'o.time';
        const windowParam = this.addParam(window || null);
        where.push(
          `(${windowParam}::interval IS NULL OR ${target} >= NOW() - ${windowParam}::interval)`
        );
      }
      this.addApplied('temporal', 'timeframe', f.timeframe);
      this.addApplied('temporal', 'temporalScope', f.temporalScope || 'observation_time');
    }

    if (e.boundingBox && f.boundingBox) {
      where.push(`o.lat <= ${this.addParam(f.boundingBox.north)}`);
      where.push(`o.lat >= ${this.addParam(f.boundingBox.south)}`);
      where.push(`o.lon <= ${this.addParam(f.boundingBox.east)}`);
      where.push(`o.lon >= ${this.addParam(f.boundingBox.west)}`);
      this.addApplied('spatial', 'boundingBox', f.boundingBox);
    }

    if (e.radiusFilter && f.radiusFilter) {
      const radiusLon = this.addParam(f.radiusFilter.longitude);
      const radiusLat = this.addParam(f.radiusFilter.latitude);
      where.push(
        `ST_DWithin(
          ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${radiusLon}, ${radiusLat}), 4326)::geography,
          ${this.addParam(f.radiusFilter.radiusMeters)}
        )`
      );
      this.addApplied('spatial', 'radiusFilter', f.radiusFilter);
    }

    if (e.distanceFromHomeMin || e.distanceFromHomeMax) {
      this.requiresHome = true;
      const distanceExpr = `ST_Distance(
        home.home_point,
        COALESCE(o.geom, ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geometry)::geography
      )`;
      if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
        where.push(`${distanceExpr} >= ${this.addParam(f.distanceFromHomeMin)}`);
        this.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
      }
      if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
        where.push(`${distanceExpr} <= ${this.addParam(f.distanceFromHomeMax)}`);
        this.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
      }
    }

    if (e.ssid && !f.ssid) {
      this.addIgnored('identity', 'ssid', 'enabled_without_value');
    }
    if (e.bssid && !f.bssid) {
      this.addIgnored('identity', 'bssid', 'enabled_without_value');
    }
    if (e.manufacturer && !f.manufacturer) {
      this.addIgnored('identity', 'manufacturer', 'enabled_without_value');
    }
    if (e.networkId && !f.networkId) {
      this.addIgnored('identity', 'networkId', 'enabled_without_value');
    }
    if (e.radioTypes && (!Array.isArray(f.radioTypes) || f.radioTypes.length === 0)) {
      this.addIgnored('radio', 'radioTypes', 'enabled_without_value');
    }
    if (e.frequencyBands && (!Array.isArray(f.frequencyBands) || f.frequencyBands.length === 0)) {
      this.addIgnored('radio', 'frequencyBands', 'enabled_without_value');
    }
    if (e.channelMin && f.channelMin === undefined) {
      this.addIgnored('radio', 'channelMin', 'enabled_without_value');
    }
    if (e.channelMax && f.channelMax === undefined) {
      this.addIgnored('radio', 'channelMax', 'enabled_without_value');
    }
    if (e.rssiMin && f.rssiMin === undefined) {
      this.addIgnored('radio', 'rssiMin', 'enabled_without_value');
    }
    if (e.rssiMax && f.rssiMax === undefined) {
      this.addIgnored('radio', 'rssiMax', 'enabled_without_value');
    }
    if (
      e.encryptionTypes &&
      (!Array.isArray(f.encryptionTypes) || f.encryptionTypes.length === 0)
    ) {
      this.addIgnored('security', 'encryptionTypes', 'enabled_without_value');
    }
    if (e.authMethods && (!Array.isArray(f.authMethods) || f.authMethods.length === 0)) {
      this.addIgnored('security', 'authMethods', 'enabled_without_value');
    }
    if (e.insecureFlags && (!Array.isArray(f.insecureFlags) || f.insecureFlags.length === 0)) {
      this.addIgnored('security', 'insecureFlags', 'enabled_without_value');
    }
    if (e.securityFlags && (!Array.isArray(f.securityFlags) || f.securityFlags.length === 0)) {
      this.addIgnored('security', 'securityFlags', 'enabled_without_value');
    }
    if (e.timeframe && !f.timeframe) {
      this.addIgnored('temporal', 'timeframe', 'enabled_without_value');
    }
    if (e.boundingBox && !f.boundingBox) {
      this.addIgnored('spatial', 'boundingBox', 'enabled_without_value');
    }
    if (e.radiusFilter && !f.radiusFilter) {
      this.addIgnored('spatial', 'radiusFilter', 'enabled_without_value');
    }
    if (e.distanceFromHomeMin && f.distanceFromHomeMin === undefined) {
      this.addIgnored('spatial', 'distanceFromHomeMin', 'enabled_without_value');
    }
    if (e.distanceFromHomeMax && f.distanceFromHomeMax === undefined) {
      this.addIgnored('spatial', 'distanceFromHomeMax', 'enabled_without_value');
    }
    if (e.observationCountMin && f.observationCountMin === undefined) {
      this.addIgnored('quality', 'observationCountMin', 'enabled_without_value');
    }
    if (e.observationCountMax && f.observationCountMax === undefined) {
      this.addIgnored('quality', 'observationCountMax', 'enabled_without_value');
    }

    return { where, joins: Array.from(this.obsJoins) };
  }

  buildFilteredObservationsCte(options: { selectedBssids?: string[] } = {}): CteResult {
    const { selectedBssids = [] } = options;
    const { where, joins } = this.buildObservationFilters();
    const whereClause = where.length > 0 ? where.join(' AND ') : '1=1';
    const homeCte = this.requiresHome
      ? `home AS (
        SELECT
          ST_SetSRID(location::geometry, 4326)::geography AS home_point
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
      )`
      : '';

    const homeJoin = this.requiresHome ? 'CROSS JOIN home' : '';
    const selectionClause =
      Array.isArray(selectedBssids) && selectedBssids.length > 0
        ? `AND UPPER(o.bssid) = ANY(${this.addParam(selectedBssids.map((v) => String(v).toUpperCase()))})`
        : '';
    const cte = `
    WITH ${homeCte ? `${homeCte},` : ''} filtered_obs AS (
      SELECT
        o.bssid,
        o.ssid,
        o.lat,
        o.lon,
        o.level,
        o.accuracy,
        o.time,
        o.radio_type,
        o.radio_frequency,
        o.radio_capabilities,
        o.geom,
        o.altitude
      FROM app.observations o
      ${homeJoin}
      ${joins.join('\n')}
      WHERE ${whereClause}
        AND o.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
        AND o.bssid IS NOT NULL
        ${selectionClause}
    )
    `;

    return { cte, params: this.params };
  }

  buildNetworkListQuery(options: NetworkListOptions = {}): FilteredQueryResult {
    // Default to no limit for visualization endpoints (Kepler, Geospatial)
    const { limit = null, offset = 0, orderBy = 'last_observed_at DESC' } = options;

    // Set requiresHome flag if we need to calculate distance from home in SELECT clause
    this.requiresHome = true;

    const noFiltersEnabled = Object.values(this.enabled).every((value) => !value);
    if (noFiltersEnabled) {
      const safeOrderBy = orderBy
        .replace(/\bl\.observed_at\b/g, 'COALESCE(ola.time, ne.observed_at)')
        .replace(/\bl\.level\b/g, 'COALESCE(ola.level, ne.signal)')
        .replace(/\bl\.lat\b/g, 'ne.lat')
        .replace(/\bl\.lon\b/g, 'ne.lon')
        .replace(/\bl\.accuracy\b/g, 'COALESCE(ola.accuracy, ne.accuracy_meters)')
        .replace(/\br\.observation_count\b/g, 'ne.observations')
        .replace(/\br\.first_observed_at\b/g, 'ne.first_seen')
        .replace(/\br\.last_observed_at\b/g, 'ne.last_seen')
        .replace(/\bs\.stationary_confidence\b/g, 'ne.last_seen');

      const sql = `
        WITH obs_latest_any AS (
          SELECT DISTINCT ON (bssid)
            bssid,
            ssid,
            level,
            accuracy,
            time,
            radio_type,
            radio_frequency,
            radio_capabilities
          FROM app.observations
          WHERE bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
            AND time >= '2000-01-01 00:00:00+00'::timestamptz
          ORDER BY bssid, time DESC
        )
        SELECT
          ne.bssid,
          COALESCE(ola.ssid, ne.ssid) AS ssid,
          CASE
            WHEN ola.radio_type IS NULL
              AND ola.radio_frequency IS NULL
              AND COALESCE(ola.radio_capabilities, '') = ''
            THEN ne.type
            ELSE ${OBS_TYPE_EXPR('ola')}
          END AS type,
          CASE
            WHEN COALESCE(ola.radio_capabilities, '') = '' THEN 
              CASE
                WHEN ne.security LIKE '%WEP%' THEN 'WEP'
                WHEN ne.security ~ '^\\s*\\[ESS\\]\\s*$' THEN 'OPEN'
                WHEN ne.security ~ '^\\s*\\[IBSS\\]\\s*$' THEN 'OPEN'
                WHEN ne.security ~ 'RSN-OWE' THEN 'WPA3-OWE'
                WHEN ne.security ~ 'RSN-SAE' THEN 'WPA3-SAE'
                WHEN ne.security ~ '(WPA3|SAE)' AND ne.security ~ '(EAP|MGT)' THEN 'WPA3-E'
                WHEN ne.security ~ '(WPA3|SAE)' THEN 'WPA3'
                WHEN ne.security ~ '(WPA2|RSN)' AND ne.security ~ '(EAP|MGT)' THEN 'WPA2-E'
                WHEN ne.security ~ '(WPA2|RSN)' THEN 'WPA2'
                WHEN ne.security ~ 'WPA-' AND ne.security NOT LIKE '%WPA2%' THEN 'WPA'
                WHEN ne.security LIKE '%WPA%' AND ne.security NOT LIKE '%WPA2%' AND ne.security NOT LIKE '%WPA3%' AND ne.security NOT LIKE '%RSN%' THEN 'WPA'
                WHEN ne.security LIKE '%WPS%' AND ne.security NOT LIKE '%WPA%' AND ne.security NOT LIKE '%RSN%' THEN 'WPS'
                WHEN ne.security ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
                WHEN COALESCE(ne.security, '') = '' THEN 'OPEN'
                ELSE 'Unknown'
              END
            ELSE ${SECURITY_EXPR('ola')}
          END AS security,
          COALESCE(ola.radio_frequency, ne.frequency) AS frequency,
          COALESCE(ola.radio_capabilities, ne.security) AS capabilities,
          (ne.frequency BETWEEN 5000 AND 5900) AS is_5ghz,
          (ne.frequency BETWEEN 5925 AND 7125) AS is_6ghz,
          (COALESCE(ne.ssid, '') = '') AS is_hidden,
          ne.first_seen,
          ne.last_seen,
          rm.organization_name AS manufacturer,
          rm.address AS manufacturer_address,
          NULL::numeric AS min_altitude_m,
          NULL::numeric AS max_altitude_m,
          NULL::numeric AS altitude_span_m,
          ne.max_distance_meters,
          NULL::numeric AS last_altitude_m,
          FALSE AS is_sentinel,
          CASE 
            WHEN home.home_point IS NOT NULL AND ne.lat IS NOT NULL AND ne.lon IS NOT NULL 
            THEN ST_Distance(
              home.home_point,
              ST_SetSRID(ST_MakePoint(ne.lon, ne.lat), 4326)::geometry::geography
            ) / 1000.0
            ELSE NULL 
          END AS distance_from_home_km,
          ne.observations AS observations,
          ne.first_seen AS first_observed_at,
          ne.last_seen AS last_observed_at,
          NULL::integer AS unique_days,
          NULL::integer AS unique_locations,
          NULL::numeric AS avg_signal,
          NULL::numeric AS min_signal,
          NULL::numeric AS max_signal,
          COALESCE(ola.time, ne.observed_at) AS observed_at,
          COALESCE(ola.level, ne.signal) AS signal,
          ne.lat,
          ne.lon,
          COALESCE(ola.accuracy, ne.accuracy_meters) AS accuracy_meters,
          NULL::numeric AS stationary_confidence,
          JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat,
          NULL::text AS network_id
        FROM app.api_network_explorer_mv ne
        LEFT JOIN obs_latest_any ola ON UPPER(ola.bssid) = UPPER(ne.bssid)
        LEFT JOIN app.radio_manufacturers rm ON rm.prefix_24bit = UPPER(REPLACE(SUBSTRING(ne.bssid, 1, 8), ':', ''))
        ${this.requiresHome ? "CROSS JOIN (SELECT ST_SetSRID(location::geometry, 4326)::geography AS home_point FROM app.location_markers WHERE marker_type = 'home' LIMIT 1) home" : ''}
        ORDER BY ${safeOrderBy}
        LIMIT ${this.addParam(limit)} OFFSET ${this.addParam(offset)}
      `;

      return {
        sql,
        params: [limit, offset],
        appliedFilters: this.appliedFilters,
        ignoredFilters: this.ignoredFilters,
        warnings: this.warnings,
      };
    }

    const enabledKeys = Object.entries(this.enabled)
      .filter(([, value]) => value)
      .map(([key]) => key);
    const networkOnly =
      enabledKeys.length > 0 &&
      enabledKeys.every((key) => NETWORK_ONLY_FILTERS.has(key as FilterKey));
    if (networkOnly) {
      return this.buildNetworkOnlyQuery({ limit, offset, orderBy });
    }

    const { cte, params } = this.buildFilteredObservationsCte();
    const networkWhere = this.buildNetworkWhere();

    const whereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';

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
      ),
      obs_centroids AS (
        SELECT
          bssid,
          ST_Centroid(ST_Collect(geom::geometry)) AS centroid,
          MIN(time) AS first_time,
          MAX(time) AS last_time,
          COUNT(*) AS obs_count
        FROM filtered_obs
        WHERE geom IS NOT NULL
        GROUP BY bssid
      ),
      -- Stationary confidence derives from spatial variance, temporal spread, and observation density.
      obs_spatial AS (
        SELECT
          c.bssid,
          CASE
            WHEN c.obs_count < 2 THEN NULL
            ELSE ROUND(
              LEAST(1, GREATEST(0,
                (
                  (1 - LEAST(MAX(ST_Distance(o.geom::geography, c.centroid::geography)) / 500.0, 1)) * 0.5 +
                  (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
                  LEAST(c.obs_count / 50.0, 1) * 0.2
                )
              ))::numeric,
              3
            )
          END AS stationary_confidence
        FROM filtered_obs o
        JOIN obs_centroids c ON c.bssid = o.bssid
        WHERE o.geom IS NOT NULL
        GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
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
          WHEN COALESCE(l.radio_capabilities, '') = '' THEN ne.security
          ELSE ${SECURITY_EXPR('l')}
        END AS security,
        COALESCE(l.radio_frequency, ne.frequency) AS frequency,
        COALESCE(l.radio_capabilities, ne.security) AS capabilities,
        (ne.frequency BETWEEN 5000 AND 5900) AS is_5ghz,
        (ne.frequency BETWEEN 5925 AND 7125) AS is_6ghz,
        (COALESCE(ne.ssid, '') = '') AS is_hidden,
        ne.first_seen,
        ne.last_seen,
        rm.organization_name AS manufacturer,
        rm.organization_address AS manufacturer_address,
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
        s.stationary_confidence,
        JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat,
        NULL::text AS network_id
      FROM obs_rollup r
      JOIN obs_latest l ON l.bssid = r.bssid
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(l.bssid)
        LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(l.bssid)
        LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(l.bssid)
        LEFT JOIN app.radio_manufacturers rm ON rm.prefix_24bit = UPPER(REPLACE(SUBSTRING(l.bssid, 1, 8), ':', ''))
      LEFT JOIN obs_spatial s ON s.bssid = r.bssid
      ${this.requiresHome ? 'CROSS JOIN home' : ''}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${this.addParam(limit)} OFFSET ${this.addParam(offset)}
    `;

    return {
      sql,
      params: [...params],
      appliedFilters: this.appliedFilters,
      ignoredFilters: this.ignoredFilters,
      warnings: this.warnings,
    };
  }

  private buildNetworkOnlyQuery(options: NetworkListOptions): FilteredQueryResult {
    const { limit = 500, offset = 0, orderBy = 'last_observed_at DESC' } = options;
    const f = this.filters;
    const e = this.enabled;
    const where: string[] = [];
    const networkTypeExpr = `
      CASE
        WHEN ola.radio_type IS NULL
          AND ola.radio_frequency IS NULL
          AND COALESCE(ola.radio_capabilities, '') = ''
        THEN ne.type
        ELSE ${OBS_TYPE_EXPR('ola')}
      END
    `;
    // ne.security contains raw capabilities string, not computed security type
    // So we need to compute security from capabilities in both cases
    const networkSecurityExpr = `
      CASE
        WHEN COALESCE(ola.radio_capabilities, '') = '' THEN
          CASE
            WHEN COALESCE(ne.security, '') = '' THEN 'OPEN'
            WHEN UPPER(ne.security) LIKE '%WEP%' THEN 'WEP'
            WHEN UPPER(ne.security) ~ '^\\s*\\[ESS\\]\\s*$' THEN 'OPEN'
            WHEN UPPER(ne.security) ~ '^\\s*\\[IBSS\\]\\s*$' THEN 'OPEN'
            WHEN UPPER(ne.security) ~ 'RSN-OWE' THEN 'WPA3-OWE'
            WHEN UPPER(ne.security) ~ 'RSN-SAE' THEN 'WPA3-SAE'
            WHEN UPPER(ne.security) ~ '(WPA3|SAE)' AND UPPER(ne.security) ~ '(EAP|MGT)' THEN 'WPA3-E'
            WHEN UPPER(ne.security) ~ '(WPA3|SAE)' THEN 'WPA3'
            WHEN UPPER(ne.security) ~ '(WPA2|RSN)' AND UPPER(ne.security) ~ '(EAP|MGT)' THEN 'WPA2-E'
            WHEN UPPER(ne.security) ~ '(WPA2|RSN)' THEN 'WPA2'
            WHEN UPPER(ne.security) ~ 'WPA-' AND UPPER(ne.security) NOT LIKE '%WPA2%' THEN 'WPA'
            WHEN UPPER(ne.security) LIKE '%WPA%' AND UPPER(ne.security) NOT LIKE '%WPA2%' AND UPPER(ne.security) NOT LIKE '%WPA3%' AND UPPER(ne.security) NOT LIKE '%RSN%' THEN 'WPA'
            WHEN UPPER(ne.security) LIKE '%WPS%' AND UPPER(ne.security) NOT LIKE '%WPA%' AND UPPER(ne.security) NOT LIKE '%RSN%' THEN 'WPS'
            WHEN UPPER(ne.security) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
            ELSE 'Unknown'
          END
        ELSE ${SECURITY_EXPR('ola')}
      END
    `;
    const networkFrequencyExpr = 'COALESCE(ola.radio_frequency, ne.frequency)';
    const networkSignalExpr = 'COALESCE(ola.level, ne.signal)';
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
      where.push(`ne.ssid ILIKE ${this.addParam(`%${f.ssid}%`)}`);
      this.addApplied('identity', 'ssid', f.ssid);
    }
    if (e.bssid && f.bssid) {
      const value = String(f.bssid).toUpperCase();
      if (value.length === 17) {
        where.push(`UPPER(ne.bssid) = ${this.addParam(value)}`);
      } else {
        where.push(`UPPER(ne.bssid) LIKE ${this.addParam(`${value}%`)}`);
      }
      this.addApplied('identity', 'bssid', f.bssid);
    }
    if (e.manufacturer && f.manufacturer) {
      const cleaned = coerceOui(f.manufacturer);
      if (isOui(cleaned)) {
        where.push(
          `UPPER(REPLACE(SUBSTRING(ne.bssid, 1, 8), ':', '')) = ${this.addParam(cleaned)}`
        );
        this.addApplied('identity', 'manufacturerOui', cleaned);
      } else {
        where.push(`ne.manufacturer ILIKE ${this.addParam(`%${f.manufacturer}%`)}`);
        this.addApplied('identity', 'manufacturer', f.manufacturer);
      }
    }
    if (e.radioTypes && Array.isArray(f.radioTypes) && f.radioTypes.length > 0) {
      where.push(`${networkTypeExpr} = ANY(${this.addParam(f.radioTypes)})`);
      this.addApplied('radio', 'radioTypes', f.radioTypes);
    }
    if (e.frequencyBands && Array.isArray(f.frequencyBands) && f.frequencyBands.length > 0) {
      const bandConditions = f.frequencyBands.map((band) => {
        if (band === '2.4GHz') {
          return `(${networkFrequencyExpr} BETWEEN 2412 AND 2484)`;
        }
        if (band === '5GHz') {
          return `(${networkFrequencyExpr} BETWEEN 5000 AND 5900)`;
        }
        if (band === '6GHz') {
          return `(${networkFrequencyExpr} BETWEEN 5925 AND 7125)`;
        }
        if (band === 'BLE') {
          return `${networkTypeExpr} = 'E'`;
        }
        if (band === 'Cellular') {
          return `${networkTypeExpr} IN ('L', 'G', 'N')`;
        }
        return null;
      });
      const clauses = bandConditions.filter(Boolean);
      if (clauses.length > 0) {
        where.push(`(${clauses.join(' OR ')})`);
        this.addApplied('radio', 'frequencyBands', f.frequencyBands);
      }
    }
    if (e.channelMin && f.channelMin !== undefined) {
      where.push(`(${networkChannelExpr} >= ${this.addParam(f.channelMin)})`);
      this.addApplied('radio', 'channelMin', f.channelMin);
    }
    if (e.channelMax && f.channelMax !== undefined) {
      where.push(`(${networkChannelExpr} <= ${this.addParam(f.channelMax)})`);
      this.addApplied('radio', 'channelMax', f.channelMax);
    }
    if (e.rssiMin && f.rssiMin !== undefined) {
      where.push(`${networkSignalExpr} >= ${this.addParam(f.rssiMin)}`);
      this.addApplied('radio', 'rssiMin', f.rssiMin);
    }
    if (e.rssiMax && f.rssiMax !== undefined) {
      where.push(`${networkSignalExpr} <= ${this.addParam(f.rssiMax)}`);
      this.addApplied('radio', 'rssiMax', f.rssiMax);
    }
    if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
      // Build security clauses that include variants (e.g., WPA2 includes WPA2-E)
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
          case 'WPA2':
            securityClauses.push(`${networkSecurityExpr} IN ('WPA2', 'WPA2-E')`);
            break;
          case 'WPA3':
            securityClauses.push(
              `${networkSecurityExpr} IN ('WPA3', 'WPA3-SAE', 'WPA3-OWE', 'WPA3-E')`
            );
            break;
        }
      });
      if (securityClauses.length > 0) {
        where.push(`(${securityClauses.join(' OR ')})`);
      }
      this.addApplied('security', 'encryptionTypes', f.encryptionTypes);
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
        flagClauses.push(`${networkSecurityExpr} IN ('WPA', 'WPA2-P', 'WPA3-P')`);
      }
      if (f.securityFlags.includes('unknown')) {
        flagClauses.push(`${networkSecurityExpr} = 'Unknown'`);
      }
      if (flagClauses.length > 0) {
        where.push(`(${flagClauses.join(' OR ')})`);
        this.addApplied('security', 'securityFlags', f.securityFlags);
      }
    }
    if (e.observationCountMin && f.observationCountMin !== undefined) {
      where.push(`ne.observations >= ${this.addParam(f.observationCountMin)}`);
      this.addApplied('quality', 'observationCountMin', f.observationCountMin);
    }
    if (e.observationCountMax && f.observationCountMax !== undefined) {
      where.push(`ne.observations <= ${this.addParam(f.observationCountMax)}`);
      this.addApplied('quality', 'observationCountMax', f.observationCountMax);
    }
    if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
      where.push(
        `ne.accuracy_meters IS NOT NULL AND ne.accuracy_meters > 0 AND ne.accuracy_meters <= ${this.addParam(
          f.gpsAccuracyMax
        )}`
      );
      this.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
    }
    if (e.excludeInvalidCoords && f.excludeInvalidCoords) {
      where.push('ne.lat IS NOT NULL AND ne.lon IS NOT NULL');
      this.addApplied('quality', 'excludeInvalidCoords', f.excludeInvalidCoords);
    }
    if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
      where.push(`ne.distance_from_home_km >= ${this.addParam(f.distanceFromHomeMin)}`);
      this.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
    }
    if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
      where.push(`ne.distance_from_home_km <= ${this.addParam(f.distanceFromHomeMax)}`);
      this.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
    }
    if (e.threatScoreMin && f.threatScoreMin !== undefined) {
      where.push(`ne.threat_score >= ${this.addParam(f.threatScoreMin)}`);
      this.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
    }
    if (e.threatScoreMax && f.threatScoreMax !== undefined) {
      where.push(`ne.threat_score <= ${this.addParam(f.threatScoreMax)}`);
      this.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
    }
    if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
      // Map frontend threat categories to database values
      const threatLevelMap: ThreatLevelMap = {
        critical: 'CRITICAL',
        high: 'HIGH',
        medium: 'MED',
        low: 'LOW',
      };
      const dbThreatLevels = f.threatCategories.map((cat) => threatLevelMap[cat]).filter(Boolean);
      if (dbThreatLevels.length > 0) {
        where.push(`ne.threat_level = ANY(${this.addParam(dbThreatLevels)})`);
        this.addApplied('threat', 'threatCategories', f.threatCategories);
      }
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const safeOrderBy = orderBy
      .replace(/\bl\.observed_at\b/g, 'COALESCE(ola.time, ne.observed_at)')
      .replace(/\bl\.level\b/g, 'COALESCE(ola.level, ne.signal)')
      .replace(/\bl\.lat\b/g, 'ne.lat')
      .replace(/\bl\.lon\b/g, 'ne.lon')
      .replace(/\bl\.accuracy\b/g, 'COALESCE(ola.accuracy, ne.accuracy_meters)')
      .replace(/\br\.observation_count\b/g, 'ne.observations')
      .replace(/\br\.first_observed_at\b/g, 'ne.first_seen')
      .replace(/\br\.last_observed_at\b/g, 'ne.last_seen')
      .replace(/\bs\.stationary_confidence\b/g, 'ne.last_seen');

    const sql = `
      WITH obs_latest_any AS (
        SELECT DISTINCT ON (bssid)
          bssid,
          ssid,
          level,
          accuracy,
          time,
          radio_type,
          radio_frequency,
          radio_capabilities
        FROM app.observations
        WHERE bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
          AND time >= '2000-01-01 00:00:00+00'::timestamptz
        ORDER BY bssid, time DESC
      )
      SELECT
        ne.bssid,
        COALESCE(ola.ssid, ne.ssid) AS ssid,
        CASE
          WHEN ola.radio_type IS NULL
            AND ola.radio_frequency IS NULL
            AND COALESCE(ola.radio_capabilities, '') = ''
          THEN ne.type
          ELSE ${OBS_TYPE_EXPR('ola')}
        END AS type,
        CASE
          WHEN COALESCE(ola.radio_capabilities, '') = '' THEN ne.security
          ELSE ${SECURITY_EXPR('ola')}
        END AS security,
        COALESCE(ola.radio_frequency, ne.frequency) AS frequency,
        COALESCE(ola.radio_capabilities, ne.security) AS capabilities,
        (ne.frequency BETWEEN 5000 AND 5900) AS is_5ghz,
        (ne.frequency BETWEEN 5925 AND 7125) AS is_6ghz,
        (COALESCE(ne.ssid, '') = '') AS is_hidden,
        ne.first_seen,
        ne.last_seen,
        rm.organization_name AS manufacturer,
        rm.organization_address AS manufacturer_address,
        NULL::numeric AS min_altitude_m,
        NULL::numeric AS max_altitude_m,
        NULL::numeric AS altitude_span_m,
        ne.max_distance_meters,
        NULL::numeric AS last_altitude_m,
        FALSE AS is_sentinel,
        ne.distance_from_home_km,
        ne.observations AS observations,
        ne.first_seen AS first_observed_at,
        ne.last_seen AS last_observed_at,
        NULL::integer AS unique_days,
        NULL::integer AS unique_locations,
        NULL::numeric AS avg_signal,
        NULL::numeric AS min_signal,
        NULL::numeric AS max_signal,
        COALESCE(ola.time, ne.observed_at) AS observed_at,
        COALESCE(ola.level, ne.signal) AS signal,
        ne.lat,
        ne.lon,
        COALESCE(ola.accuracy, ne.accuracy_meters) AS accuracy_meters,
        NULL::numeric AS stationary_confidence,
        JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat,
        NULL::text AS network_id
      FROM app.api_network_explorer_mv ne
      LEFT JOIN obs_latest_any ola ON UPPER(ola.bssid) = UPPER(ne.bssid)
      LEFT JOIN app.radio_manufacturers rm ON rm.prefix_24bit = UPPER(REPLACE(SUBSTRING(ne.bssid, 1, 8), ':', ''))
      ${whereClause}
      ORDER BY ${safeOrderBy}
      LIMIT ${this.addParam(limit)} OFFSET ${this.addParam(offset)}
    `;

    return {
      sql,
      params: [...this.params],
      appliedFilters: this.appliedFilters,
      ignoredFilters: this.ignoredFilters,
      warnings: this.warnings,
    };
  }

  buildNetworkCountQuery(): QueryResult {
    const noFiltersEnabled = Object.values(this.enabled).every((value) => !value);
    if (noFiltersEnabled) {
      return {
        sql: 'SELECT COUNT(*) AS total FROM app.api_network_explorer_mv',
        params: [],
      };
    }

    const enabledKeys = Object.entries(this.enabled)
      .filter(([, value]) => value)
      .map(([key]) => key);
    const networkOnly =
      enabledKeys.length > 0 &&
      enabledKeys.every((key) => NETWORK_ONLY_FILTERS.has(key as FilterKey));
    if (networkOnly) {
      return this.buildNetworkOnlyCountQuery();
    }

    const { cte, params } = this.buildFilteredObservationsCte();
    const networkWhere = this.buildNetworkWhere();
    const whereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';

    const sql = `
      ${cte}
      , obs_rollup AS (
        SELECT
          bssid,
          COUNT(*) AS observation_count
        FROM filtered_obs
        GROUP BY bssid
      ),
      obs_centroids AS (
        SELECT
          bssid,
          ST_Centroid(ST_Collect(geom::geometry)) AS centroid,
          MIN(time) AS first_time,
          MAX(time) AS last_time,
          COUNT(*) AS obs_count
        FROM filtered_obs
        WHERE geom IS NOT NULL
        GROUP BY bssid
      ),
      obs_spatial AS (
        SELECT
          c.bssid,
          CASE
            WHEN c.obs_count < 2 THEN NULL
            ELSE ROUND(
              LEAST(1, GREATEST(0,
                (
                  (1 - LEAST(MAX(ST_Distance(o.geom::geography, c.centroid::geography)) / 500.0, 1)) * 0.5 +
                  (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
                  LEAST(c.obs_count / 50.0, 1) * 0.2
                )
              ))::numeric,
              3
            )
          END AS stationary_confidence
        FROM filtered_obs o
        JOIN obs_centroids c ON c.bssid = o.bssid
        WHERE o.geom IS NOT NULL
        GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
      )
      SELECT COUNT(DISTINCT r.bssid) AS total
      FROM obs_rollup r
      JOIN app.api_network_explorer_mv ne ON ne.bssid = r.bssid
      LEFT JOIN obs_spatial s ON s.bssid = r.bssid
      ${whereClause}
    `;

    return { sql, params: [...params] };
  }

  private buildNetworkOnlyCountQuery(): QueryResult {
    const f = this.filters;
    const e = this.enabled;
    const where: string[] = [];

    if (e.ssid && f.ssid) {
      where.push(`ne.ssid ILIKE ${this.addParam(`%${f.ssid}%`)}`);
    }
    if (e.bssid && f.bssid) {
      const value = String(f.bssid).toUpperCase();
      if (value.length === 17) {
        where.push(`UPPER(ne.bssid) = ${this.addParam(value)}`);
      } else {
        where.push(`UPPER(ne.bssid) LIKE ${this.addParam(`${value}%`)}`);
      }
    }
    if (e.manufacturer && f.manufacturer) {
      const cleaned = coerceOui(f.manufacturer);
      if (isOui(cleaned)) {
        where.push(
          `UPPER(REPLACE(SUBSTRING(ne.bssid, 1, 8), ':', '')) = ${this.addParam(cleaned)}`
        );
      } else {
        where.push(`ne.manufacturer ILIKE ${this.addParam(`%${f.manufacturer}%`)}`);
      }
    }
    if (e.radioTypes && Array.isArray(f.radioTypes) && f.radioTypes.length > 0) {
      where.push(`ne.type = ANY(${this.addParam(f.radioTypes)})`);
    }
    if (e.frequencyBands && Array.isArray(f.frequencyBands) && f.frequencyBands.length > 0) {
      const bandConditions = f.frequencyBands.map((band) => {
        if (band === '2.4GHz') {
          return '(ne.frequency BETWEEN 2412 AND 2484)';
        }
        if (band === '5GHz') {
          return '(ne.frequency BETWEEN 5000 AND 5900)';
        }
        if (band === '6GHz') {
          return '(ne.frequency BETWEEN 5925 AND 7125)';
        }
        if (band === 'BLE') {
          return "ne.type = 'E'";
        }
        if (band === 'Cellular') {
          return "ne.type IN ('L', 'G', 'N')";
        }
        return null;
      });
      const clauses = bandConditions.filter(Boolean);
      if (clauses.length > 0) {
        where.push(`(${clauses.join(' OR ')})`);
      }
    }
    if (e.channelMin && f.channelMin !== undefined) {
      where.push(`${NETWORK_CHANNEL_EXPR('ne')} >= ${this.addParam(f.channelMin)}`);
    }
    if (e.channelMax && f.channelMax !== undefined) {
      where.push(`${NETWORK_CHANNEL_EXPR('ne')} <= ${this.addParam(f.channelMax)}`);
    }
    if (e.rssiMin && f.rssiMin !== undefined) {
      where.push(`ne.signal >= ${this.addParam(f.rssiMin)}`);
    }
    if (e.rssiMax && f.rssiMax !== undefined) {
      where.push(`ne.signal <= ${this.addParam(f.rssiMax)}`);
    }
    // ne.security contains raw capabilities string, compute security type for comparison
    const computedSecurityExpr = `
      CASE
        WHEN COALESCE(ne.security, '') = '' THEN 'OPEN'
        WHEN UPPER(ne.security) ~ '^\\s*\\[ESS\\]\\s*$' THEN 'OPEN'
        WHEN UPPER(ne.security) ~ '^\\s*\\[IBSS\\]\\s*$' THEN 'OPEN'
        WHEN UPPER(ne.security) ~ 'RSN-OWE' THEN 'WPA3-OWE'
        WHEN UPPER(ne.security) ~ 'RSN-SAE' THEN 'WPA3-SAE'
        WHEN UPPER(ne.security) ~ '(WPA3|SAE)' AND UPPER(ne.security) ~ '(EAP|MGT)' THEN 'WPA3-E'
        WHEN UPPER(ne.security) ~ '(WPA3|SAE)' THEN 'WPA3'
        WHEN UPPER(ne.security) ~ '(WPA2|RSN)' AND UPPER(ne.security) ~ '(EAP|MGT)' THEN 'WPA2-E'
        WHEN UPPER(ne.security) ~ '(WPA2|RSN)' THEN 'WPA2'
        WHEN UPPER(ne.security) ~ 'WPA-' AND UPPER(ne.security) NOT LIKE '%WPA2%' THEN 'WPA'
        WHEN UPPER(ne.security) LIKE '%WPA%' AND UPPER(ne.security) NOT LIKE '%WPA2%' AND UPPER(ne.security) NOT LIKE '%WPA3%' AND UPPER(ne.security) NOT LIKE '%RSN%' THEN 'WPA'
        WHEN UPPER(ne.security) LIKE '%WEP%' THEN 'WEP'
        WHEN UPPER(ne.security) LIKE '%WPS%' AND UPPER(ne.security) NOT LIKE '%WPA%' AND UPPER(ne.security) NOT LIKE '%RSN%' THEN 'WPS'
        WHEN UPPER(ne.security) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
        ELSE 'Unknown'
      END
    `;
    if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
      where.push(`(${computedSecurityExpr}) = ANY(${this.addParam(f.encryptionTypes)})`);
    }
    if (e.securityFlags && Array.isArray(f.securityFlags) && f.securityFlags.length > 0) {
      const flagClauses: string[] = [];
      if (f.securityFlags.includes('insecure')) {
        flagClauses.push(`(${computedSecurityExpr}) IN ('OPEN', 'WEP', 'WPS')`);
      }
      if (f.securityFlags.includes('deprecated')) {
        flagClauses.push(`(${computedSecurityExpr}) = 'WEP'`);
      }
      if (f.securityFlags.includes('enterprise')) {
        flagClauses.push(`(${computedSecurityExpr}) IN ('WPA2-E', 'WPA3-E')`);
      }
      if (f.securityFlags.includes('personal')) {
        flagClauses.push(`(${computedSecurityExpr}) IN ('WPA', 'WPA2-P', 'WPA3-P')`);
      }
      if (f.securityFlags.includes('unknown')) {
        flagClauses.push(`(${computedSecurityExpr}) = 'Unknown'`);
      }
      if (flagClauses.length > 0) {
        where.push(`(${flagClauses.join(' OR ')})`);
      }
    }
    if (e.observationCountMin && f.observationCountMin !== undefined) {
      where.push(`ne.observations >= ${this.addParam(f.observationCountMin)}`);
    }
    if (e.observationCountMax && f.observationCountMax !== undefined) {
      where.push(`ne.observations <= ${this.addParam(f.observationCountMax)}`);
    }
    if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
      where.push(
        `ne.accuracy_meters IS NOT NULL AND ne.accuracy_meters > 0 AND ne.accuracy_meters <= ${this.addParam(
          f.gpsAccuracyMax
        )}`
      );
    }
    if (e.excludeInvalidCoords && f.excludeInvalidCoords) {
      where.push('ne.lat IS NOT NULL AND ne.lon IS NOT NULL');
    }
    if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
      where.push(`ne.distance_from_home_km >= ${this.addParam(f.distanceFromHomeMin)}`);
    }
    if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
      where.push(`ne.distance_from_home_km <= ${this.addParam(f.distanceFromHomeMax)}`);
    }
    if (e.threatScoreMin && f.threatScoreMin !== undefined) {
      where.push(`(${THREAT_SCORE_EXPR('nts', 'nt')} >= ${this.addParam(f.threatScoreMin)})`);
    }
    if (e.threatScoreMax && f.threatScoreMax !== undefined) {
      where.push(`(${THREAT_SCORE_EXPR('nts', 'nt')} <= ${this.addParam(f.threatScoreMax)})`);
    }
    if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
      // Map frontend lowercase categories to database uppercase values
      const threatLevelMap: ThreatLevelMap = {
        critical: 'CRITICAL',
        high: 'HIGH',
        medium: 'MED',
        low: 'LOW',
      };
      const dbThreatLevels = f.threatCategories
        .map((cat) => threatLevelMap[cat] || cat.toUpperCase())
        .filter(Boolean);
      where.push(`${THREAT_LEVEL_EXPR('nts', 'nt')} = ANY(${this.addParam(dbThreatLevels)})`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return {
      sql: `SELECT COUNT(*) AS total FROM app.api_network_explorer_mv ne
            LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
            LEFT JOIN app.network_tags nt ON nt.bssid = ne.bssid
            ${whereClause}`,
      params: [...this.params],
    };
  }

  buildNetworkWhere(): string[] {
    const f = this.filters;
    const e = this.enabled;
    const networkWhere: string[] = [];

    if (e.threatScoreMin && f.threatScoreMin !== undefined) {
      networkWhere.push(
        `(${THREAT_SCORE_EXPR('nts', 'nt')} >= ${this.addParam(f.threatScoreMin)})`
      );
      this.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
    }
    if (e.threatScoreMax && f.threatScoreMax !== undefined) {
      networkWhere.push(
        `(${THREAT_SCORE_EXPR('nts', 'nt')} <= ${this.addParam(f.threatScoreMax)})`
      );
      this.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
    }
    if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
      // Map frontend lowercase categories to database uppercase values
      const threatLevelMap: ThreatLevelMap = {
        critical: 'CRITICAL',
        high: 'HIGH',
        medium: 'MED',
        low: 'LOW',
      };
      const dbThreatLevels = f.threatCategories
        .map((cat) => threatLevelMap[cat] || cat.toUpperCase())
        .filter(Boolean);
      networkWhere.push(
        `${THREAT_LEVEL_EXPR('nts', 'nt')} = ANY(${this.addParam(dbThreatLevels)})`
      );
      this.addApplied('threat', 'threatCategories', f.threatCategories);
    }
    if (e.observationCountMin && f.observationCountMin !== undefined) {
      networkWhere.push(`r.observation_count >= ${this.addParam(f.observationCountMin)}`);
      this.addApplied('quality', 'observationCountMin', f.observationCountMin);
    }
    if (e.observationCountMax && f.observationCountMax !== undefined) {
      networkWhere.push(`r.observation_count <= ${this.addParam(f.observationCountMax)}`);
      this.addApplied('quality', 'observationCountMax', f.observationCountMax);
    }
    if (e.stationaryConfidenceMin && f.stationaryConfidenceMin !== undefined) {
      networkWhere.push(`s.stationary_confidence >= ${this.addParam(f.stationaryConfidenceMin)}`);
      this.addApplied('threat', 'stationaryConfidenceMin', f.stationaryConfidenceMin);
    }
    if (e.stationaryConfidenceMax && f.stationaryConfidenceMax !== undefined) {
      networkWhere.push(`s.stationary_confidence <= ${this.addParam(f.stationaryConfidenceMax)}`);
      this.addApplied('threat', 'stationaryConfidenceMax', f.stationaryConfidenceMax);
    }

    if (e.threatScoreMin && f.threatScoreMin === undefined) {
      this.addIgnored('threat', 'threatScoreMin', 'enabled_without_value');
    }
    if (e.threatScoreMax && f.threatScoreMax === undefined) {
      this.addIgnored('threat', 'threatScoreMax', 'enabled_without_value');
    }
    if (
      e.threatCategories &&
      (!Array.isArray(f.threatCategories) || f.threatCategories.length === 0)
    ) {
      this.addIgnored('threat', 'threatCategories', 'enabled_without_value');
    }
    if (e.stationaryConfidenceMin && f.stationaryConfidenceMin === undefined) {
      this.addIgnored('threat', 'stationaryConfidenceMin', 'enabled_without_value');
    }
    if (e.stationaryConfidenceMax && f.stationaryConfidenceMax === undefined) {
      this.addIgnored('threat', 'stationaryConfidenceMax', 'enabled_without_value');
    }

    return networkWhere;
  }

  buildGeospatialQuery(options: GeospatialOptions = {}): FilteredQueryResult {
    // Default to no limit for full dataset visualization (Kepler can handle 500K+ points)
    const { limit = null, offset = 0, selectedBssids = [] } = options;
    const { cte } = this.buildFilteredObservationsCte({ selectedBssids });
    const networkWhere = this.buildNetworkWhere();

    // Optimization: If no network-level filters are active, skip the expensive rollup/spatial CTEs
    // filtering logic. We still join api_network_explorer to provide threat data if needed.
    if (networkWhere.length === 0) {
      const sql = `
        ${cte}
        SELECT
          o.bssid,
          o.ssid,
          COALESCE(o.lat, ST_Y(o.geom::geometry)) AS lat,
          COALESCE(o.lon, ST_X(o.geom::geometry)) AS lon,
          o.level,
          o.accuracy,
          o.time,
          o.radio_frequency,
          o.radio_capabilities,
          o.radio_type,
          o.altitude,
          ${SECURITY_EXPR('o')} AS security,
          ROW_NUMBER() OVER (PARTITION BY o.bssid ORDER BY o.time ASC) AS obs_number,
          JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat
        FROM filtered_obs o
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(o.bssid)
        WHERE ((o.lat IS NOT NULL AND o.lon IS NOT NULL)
          OR o.geom IS NOT NULL)
        ORDER BY o.time ASC
        ${limit !== null ? `LIMIT ${this.addParam(limit)}` : ''}
        OFFSET ${this.addParam(offset)}
      `;

      // Ensure parameters are correctly ordered for the LIMIT/OFFSET which are added at the end
      const finalParams = [...this.params];

      return {
        sql,
        params: finalParams,
        appliedFilters: this.appliedFilters,
        ignoredFilters: this.ignoredFilters,
        warnings: this.warnings,
      };
    }

    const networkWhereClause = `WHERE ${networkWhere.join(' AND ')}`;

    const sql = `
      ${cte}
      , obs_rollup AS (
        SELECT
          bssid,
          COUNT(*) AS observation_count
        FROM filtered_obs
        GROUP BY bssid
      ),
      obs_centroids AS (
        SELECT
          bssid,
          ST_Centroid(ST_Collect(geom::geometry)) AS centroid,
          MIN(time) AS first_time,
          MAX(time) AS last_time,
          COUNT(*) AS obs_count
        FROM filtered_obs
        WHERE geom IS NOT NULL
        GROUP BY bssid
      ),
      obs_spatial AS (
        SELECT
          c.bssid,
          CASE
            WHEN c.obs_count < 2 THEN NULL
            ELSE ROUND(
              LEAST(1, GREATEST(0,
                (
                  (1 - LEAST(MAX(ST_Distance(o.geom::geography, c.centroid::geography)) / 500.0, 1)) * 0.5 +
                  (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
                  LEAST(c.obs_count / 50.0, 1) * 0.2
                )
              ))::numeric,
              3
            )
          END AS stationary_confidence
        FROM filtered_obs o
        JOIN obs_centroids c ON c.bssid = o.bssid
        WHERE o.geom IS NOT NULL
        GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
      ),
      filtered_networks AS (
        SELECT r.bssid
        FROM obs_rollup r
        LEFT JOIN obs_spatial s ON s.bssid = r.bssid
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(r.bssid)
        LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(r.bssid)
        LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(r.bssid)
        ${networkWhereClause}
      )
      SELECT
        o.bssid,
        o.ssid,
        COALESCE(o.lat, ST_Y(o.geom::geometry)) AS lat,
        COALESCE(o.lon, ST_X(o.geom::geometry)) AS lon,
        o.level,
        o.accuracy,
        o.time,
        o.radio_frequency,
        o.radio_capabilities,
        o.radio_type,
        o.altitude,
        ${SECURITY_EXPR('o')} AS security,
        ROW_NUMBER() OVER (PARTITION BY o.bssid ORDER BY o.time ASC) AS obs_number,
        JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat
      FROM filtered_obs o
      JOIN filtered_networks fn ON fn.bssid = o.bssid
      LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(o.bssid)
      WHERE ((o.lat IS NOT NULL AND o.lon IS NOT NULL)
        OR o.geom IS NOT NULL)
      ORDER BY o.time ASC
      ${limit !== null ? `LIMIT ${this.addParam(limit)}` : ''}
      OFFSET ${this.addParam(offset)}
    `;

    // Ensure parameters are correctly ordered for the LIMIT/OFFSET which are added at the end
    const finalParams = [...this.params];

    return {
      sql,
      params: finalParams,
      appliedFilters: this.appliedFilters,
      ignoredFilters: this.ignoredFilters,
      warnings: this.warnings,
    };
  }

  buildGeospatialCountQuery(options: { selectedBssids?: string[] } = {}): QueryResult {
    const { selectedBssids = [] } = options;
    const { cte, params } = this.buildFilteredObservationsCte({ selectedBssids });
    const networkWhere = this.buildNetworkWhere();
    const networkWhereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';

    const sql = `
      ${cte}
      , obs_rollup AS (
        SELECT
          bssid,
          COUNT(*) AS observation_count
        FROM filtered_obs
        GROUP BY bssid
      ),
      obs_centroids AS (
        SELECT
          bssid,
          ST_Centroid(ST_Collect(geom::geometry)) AS centroid,
          MIN(time) AS first_time,
          MAX(time) AS last_time,
          COUNT(*) AS obs_count
        FROM filtered_obs
        WHERE geom IS NOT NULL
        GROUP BY bssid
      ),
      obs_spatial AS (
        SELECT
          c.bssid,
          CASE
            WHEN c.obs_count < 2 THEN NULL
            ELSE ROUND(
              LEAST(1, GREATEST(0,
                (
                  (1 - LEAST(MAX(ST_Distance(o.geom::geography, c.centroid::geography)) / 500.0, 1)) * 0.5 +
                  (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
                  LEAST(c.obs_count / 50.0, 1) * 0.2
                )
              ))::numeric,
              3
            )
          END AS stationary_confidence
        FROM filtered_obs o
        JOIN obs_centroids c ON c.bssid = o.bssid
        WHERE o.geom IS NOT NULL
        GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
      ),
      filtered_networks AS (
        SELECT r.bssid
        FROM obs_rollup r
        LEFT JOIN obs_spatial s ON s.bssid = r.bssid
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(r.bssid)
        LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(r.bssid)
        LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(r.bssid)
        ${networkWhereClause}
      )
      SELECT COUNT(*)::bigint AS total
      FROM filtered_obs o
      JOIN filtered_networks fn ON fn.bssid = o.bssid
      WHERE ((o.lat IS NOT NULL AND o.lon IS NOT NULL)
        OR o.geom IS NOT NULL)
    `;

    return {
      sql,
      params: [...params],
    };
  }

  buildAnalyticsQueries(options: AnalyticsOptions = {}): AnalyticsQueries {
    const { useLatestPerBssid = false } = options;
    // NOTE: MV optimization disabled - complex filters require CTE queries
    // for accurate results with temporal/spatial/behavioral filtering

    // Fall back to complex CTE queries for advanced filtering
    const { cte, params } = this.buildFilteredObservationsCte();
    const networkWhere = this.buildNetworkWhere();
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
      obs_centroids AS (
        SELECT
          bssid,
          ST_Centroid(ST_Collect(geom::geometry)) AS centroid,
          MIN(time) AS first_time,
          MAX(time) AS last_time,
          COUNT(*) AS obs_count
        FROM filtered_obs
        WHERE geom IS NOT NULL
        GROUP BY bssid
      ),
      obs_spatial AS (
        SELECT
          c.bssid,
          CASE
            WHEN c.obs_count < 2 THEN NULL
            ELSE ROUND(
              LEAST(1, GREATEST(0,
                (
                  (1 - LEAST(MAX(ST_Distance(o.geom::geography, c.centroid::geography)) / 500.0, 1)) * 0.5 +
                  (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
                  LEAST(c.obs_count / 50.0, 1) * 0.2
                )
              ))::numeric,
              3
            )
          END AS stationary_confidence
        FROM filtered_obs o
        JOIN obs_centroids c ON c.bssid = o.bssid
        WHERE o.geom IS NOT NULL
        GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
      ),
      filtered_networks AS (
        SELECT r.bssid
        FROM obs_rollup r
        LEFT JOIN obs_spatial s ON s.bssid = r.bssid
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(r.bssid)
        LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(r.bssid)
        LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(r.bssid)
        ${networkWhereClause}
      ),
      filtered_obs_scope AS (
        SELECT o.*
        FROM filtered_obs o
        JOIN filtered_networks fn ON fn.bssid = o.bssid
      )
    `;
    const latestPerBssidCte = useLatestPerBssid
      ? `,
      latest_per_bssid AS (
        SELECT *
        FROM (
          SELECT o.*, ROW_NUMBER() OVER (PARTITION BY UPPER(o.bssid) ORDER BY o.time DESC NULLS LAST) as rn
          FROM filtered_obs_scope o
        ) ranked
        WHERE rn = 1
      )`
      : '';
    const signalStrengthCte = useLatestPerBssid
      ? ''
      : `
        , latest AS (
          SELECT DISTINCT ON (bssid)
            bssid,
            level
          FROM filtered_obs_scope o
          ORDER BY bssid, o.time DESC
        )
      `;
    const signalStrengthSource = useLatestPerBssid ? 'latest_per_bssid' : 'latest';

    const base = (query: string): QueryResult => ({
      sql: `${baseCtes}${latestPerBssidCte}\n${query}`,
      params: [...params],
    });

    return {
      networkTypes: base(`
        SELECT
          CASE
            WHEN ${OBS_TYPE_EXPR('o')} = 'W' THEN 'WiFi'
            WHEN ${OBS_TYPE_EXPR('o')} = 'E' THEN 'BLE'
            WHEN ${OBS_TYPE_EXPR('o')} = 'B' THEN 'BT'
            WHEN ${OBS_TYPE_EXPR('o')} = 'L' THEN 'LTE'
            WHEN ${OBS_TYPE_EXPR('o')} = 'N' THEN 'NR'
            WHEN ${OBS_TYPE_EXPR('o')} = 'G' THEN 'GSM'
            ELSE 'Other'
          END AS network_type,
          COUNT(DISTINCT o.bssid) AS count
        FROM filtered_obs_scope o
        GROUP BY network_type
        ORDER BY count DESC
      `),
      signalStrength: base(`
        ${signalStrengthCte}
        SELECT
          CASE
            WHEN o.level >= -30 THEN '-30'
            WHEN o.level >= -40 THEN '-40'
            WHEN o.level >= -50 THEN '-50'
            WHEN o.level >= -60 THEN '-60'
            WHEN o.level >= -70 THEN '-70'
            WHEN o.level >= -80 THEN '-80'
            ELSE '-90'
          END AS signal_range,
          COUNT(*) AS count
        FROM ${signalStrengthSource} o
        WHERE o.level IS NOT NULL
        GROUP BY signal_range
        ORDER BY signal_range DESC
      `),
      security: base(`
        SELECT
          ${SECURITY_EXPR('o')} AS security_type,
          COUNT(*) AS count
        FROM filtered_obs_scope o
        GROUP BY security_type
        ORDER BY count DESC
      `),
      threatDistribution: base(`
        SELECT
          CASE
            WHEN ne.threat_score >= 80 THEN '80-100'
            WHEN ne.threat_score >= 60 THEN '60-80'
            WHEN ne.threat_score >= 40 THEN '40-60'
            WHEN ne.threat_score >= 20 THEN '20-40'
            ELSE '0-20'
          END AS range,
          COUNT(DISTINCT ne.bssid) AS count
        FROM filtered_networks fn
        JOIN app.api_network_explorer_mv ne ON ne.bssid = fn.bssid
        GROUP BY range
        ORDER BY range DESC
      `),
      temporalActivity: base(`
        SELECT
          EXTRACT(HOUR FROM o.time) AS hour,
          COUNT(*) AS count
        FROM filtered_obs_scope o
        GROUP BY hour
        ORDER BY hour
      `),
      radioTypeOverTime: base(`
        SELECT
          DATE_TRUNC('day', o.time) AS date,
          CASE
            WHEN ${OBS_TYPE_EXPR('o')} = 'W' THEN 'WiFi'
            WHEN ${OBS_TYPE_EXPR('o')} = 'E' THEN 'BLE'
            WHEN ${OBS_TYPE_EXPR('o')} = 'B' THEN 'BT'
            WHEN ${OBS_TYPE_EXPR('o')} = 'L' THEN 'LTE'
            WHEN ${OBS_TYPE_EXPR('o')} = 'N' THEN 'NR'
            WHEN ${OBS_TYPE_EXPR('o')} = 'G' THEN 'GSM'
            ELSE 'Other'
          END AS network_type,
          COUNT(*) AS count
        FROM filtered_obs_scope o
        GROUP BY date, network_type
        ORDER BY date, network_type
      `),
      threatTrends: base(`
        , daily_networks AS (
          SELECT
            DATE_TRUNC('day', o.time) AS date,
            o.bssid
          FROM filtered_obs_scope o
          GROUP BY date, o.bssid
        )
        SELECT
          d.date,
          AVG(COALESCE(ne.threat_score, 0)) AS avg_score,
          COUNT(CASE WHEN ne.threat_score >= 80 THEN 1 END) AS critical_count,
          COUNT(CASE WHEN ne.threat_score BETWEEN 60 AND 79.9 THEN 1 END) AS high_count,
          COUNT(CASE WHEN ne.threat_score BETWEEN 40 AND 59.9 THEN 1 END) AS medium_count,
          COUNT(CASE WHEN ne.threat_score BETWEEN 20 AND 39.9 THEN 1 END) AS low_count,
          COUNT(*) AS network_count
        FROM daily_networks d
        LEFT JOIN app.api_network_explorer_mv ne ON ne.bssid = d.bssid
        GROUP BY d.date
        ORDER BY d.date
      `),
      topNetworks: base(`
        SELECT
          o.bssid,
          MAX(o.ssid) AS ssid,
          COUNT(*) AS observation_count,
          MIN(o.time) AS first_seen,
          MAX(o.time) AS last_seen
        FROM filtered_obs_scope o
        GROUP BY o.bssid
        ORDER BY observation_count DESC
        LIMIT 50
      `),
    };
  }

  // Check if we can use the analytics materialized view for faster queries
  canUseAnalyticsMV(): boolean {
    // Only use MV for simple time-based filters without complex spatial operations
    const hasComplexFilters =
      this.enabled?.boundingBox ||
      this.enabled?.radiusFilter ||
      this.enabled?.distanceFromHomeMin ||
      this.enabled?.distanceFromHomeMax ||
      this.filters?.boundingBox ||
      this.filters?.radiusFilter;

    return !hasComplexFilters;
  }

  // Build analytics queries using the materialized view
  buildAnalyticsQueriesFromMV(): AnalyticsQueries {
    // For now, just return queries without time filtering for the MV
    // Time filtering can be added later when needed
    const params: unknown[] = [];

    return {
      networkTypes: {
        sql: `
          SELECT
            CASE
              WHEN type = 'W' THEN 'WiFi'
              WHEN type = 'E' THEN 'BLE'
              WHEN type = 'B' THEN 'BT'
              WHEN type = 'L' THEN 'LTE'
              WHEN type = 'N' THEN 'NR'
              WHEN type = 'G' THEN 'GSM'
              ELSE type
            END as type,
            COUNT(*) as count
          FROM app.analytics_summary_mv
          GROUP BY type
          ORDER BY count DESC
        `,
        params,
      },
      signalStrength: {
        sql: `
          SELECT
            CASE
              WHEN max_signal >= -30 THEN 'Excellent'
              WHEN max_signal >= -50 THEN 'Good'
              WHEN max_signal >= -70 THEN 'Fair'
              ELSE 'Poor'
            END as strength_category,
            COUNT(*) as count
          FROM app.analytics_summary_mv
          GROUP BY strength_category
          ORDER BY count DESC
        `,
        params,
      },
      security: {
        sql: `
          SELECT
            CASE
              WHEN capabilities LIKE '%WPA3%' THEN 'WPA3'
              WHEN capabilities LIKE '%WPA2%' THEN 'WPA2'
              WHEN capabilities LIKE '%WPA%' THEN 'WPA'
              WHEN capabilities LIKE '%WEP%' THEN 'WEP'
              WHEN capabilities = '' OR capabilities IS NULL THEN 'Open'
              ELSE 'Other'
            END as encryption,
            COUNT(*) as count
          FROM app.analytics_summary_mv
          GROUP BY encryption
          ORDER BY count DESC
        `,
        params,
      },
      threatDistribution: {
        sql: `
          SELECT
            CASE
              WHEN threat_score >= 0.7 THEN 'high'
              WHEN threat_score >= 0.4 THEN 'medium'
              WHEN threat_score >= 0.1 THEN 'low'
              ELSE 'none'
            END as threat_level,
            COUNT(*) as count
          FROM app.analytics_summary_mv
          GROUP BY threat_level
          ORDER BY count DESC
        `,
        params,
      },
      temporalActivity: {
        sql: `
          SELECT
            DATE(last_seen) as date,
            COUNT(*) as count
          FROM app.analytics_summary_mv
          GROUP BY DATE(last_seen)
          ORDER BY date DESC
          LIMIT 30
        `,
        params,
      },
      radioTypeOverTime: {
        sql: `
          SELECT
            DATE(last_seen) as date,
            CASE
              WHEN type = 'W' THEN 'WiFi'
              WHEN type = 'E' THEN 'BLE'
              WHEN type = 'B' THEN 'BT'
              WHEN type = 'L' THEN 'LTE'
              WHEN type = 'N' THEN 'NR'
              WHEN type = 'G' THEN 'GSM'
              ELSE type
            END as type,
            COUNT(*) as count
          FROM app.analytics_summary_mv
          GROUP BY DATE(last_seen), type
          ORDER BY date DESC, count DESC
          LIMIT 100
        `,
        params,
      },
      threatTrends: {
        sql: `
          SELECT
            DATE(last_seen) as date,
            AVG(threat_score) as avg_threat_score,
            COUNT(*) as network_count
          FROM app.analytics_summary_mv
          GROUP BY DATE(last_seen)
          ORDER BY date DESC
          LIMIT 30
        `,
        params,
      },
      topNetworks: {
        sql: `
          SELECT
            bssid,
            ssid,
            type,
            observation_count,
            threat_score,
            last_seen
          FROM app.analytics_summary_mv
          ORDER BY observation_count DESC
          LIMIT 20
        `,
        params,
      },
    };
  }
}

export { UniversalFilterQueryBuilder };
