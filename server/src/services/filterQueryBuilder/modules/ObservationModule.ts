import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import {
  OBS_TYPE_EXPR,
  SECURITY_FROM_CAPS_EXPR,
  SECURITY_EXPR,
  WIFI_CHANNEL_EXPR,
} from '../sqlExpressions';
import { isOui, coerceOui } from '../normalizers';
import { buildRadioPredicates } from '../radioPredicates';
import { buildEngagementPredicates } from '../engagementPredicates';
import { RELATIVE_WINDOWS } from '../constants';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { CteResult, ObservationFiltersResult } from '../types';

const logger = require('../../../logging/logger');

interface ThreatLevelMap {
  [key: string]: string;
}

const NT_FILTER_TAG_LOWER_EXPR = 'LOWER(nt_filter.threat_tag)';
const NT_FILTER_IS_IGNORED_EXPR = 'COALESCE(nt_filter.is_ignored, FALSE)';

export class ObservationModule {
  constructor(private ctx: FilterBuildContext) {}

  public buildObservationFilters(): ObservationFiltersResult {
    const where: string[] = [];
    const f = this.ctx.filters;
    const e = this.ctx.enabled;

    if (e.excludeInvalidCoords) {
      where.push(
        'o.lat IS NOT NULL',
        'o.lon IS NOT NULL',
        'o.lat BETWEEN -90 AND 90',
        'o.lon BETWEEN -180 AND 180'
      );
      this.ctx.addApplied('quality', 'excludeInvalidCoords', true);
    }

    if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
      where.push(
        `o.accuracy IS NOT NULL AND o.accuracy > 0 AND o.accuracy <= ${this.ctx.addParam(
          f.gpsAccuracyMax
        )}`
      );
      this.ctx.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
    }

    if (e.observationCountMin && f.observationCountMin !== undefined) {
      this.ctx.obsJoins.add('JOIN app.networks ap ON UPPER(ap.bssid) = UPPER(o.bssid)');
      where.push(`ap.observations >= ${this.ctx.addParam(f.observationCountMin)}`);
      this.ctx.addApplied('quality', 'observationCountMin', f.observationCountMin);
    }

    if (e.observationCountMax && f.observationCountMax !== undefined) {
      this.ctx.obsJoins.add('JOIN app.networks ap ON UPPER(ap.bssid) = UPPER(o.bssid)');
      where.push(`ap.observations <= ${this.ctx.addParam(f.observationCountMax)}`);
      this.ctx.addApplied('quality', 'observationCountMax', f.observationCountMax);
    }

    if (e.ssid && f.ssid) {
      where.push(`o.ssid ILIKE ${this.ctx.addParam(`%${f.ssid}%`)}`);
      this.ctx.addApplied('identity', 'ssid', f.ssid);
    }

    if (e.bssid && f.bssid) {
      const value = String(f.bssid).toUpperCase();
      if (value.length === 17) {
        where.push(`UPPER(o.bssid) = ${this.ctx.addParam(value)}`);
      } else {
        where.push(`UPPER(o.bssid) LIKE ${this.ctx.addParam(`${value}%`)}`);
      }
      this.ctx.addApplied('identity', 'bssid', f.bssid);
    }

    if (e.manufacturer && f.manufacturer) {
      const cleaned = coerceOui(f.manufacturer);
      if (isOui(cleaned)) {
        where.push(
          `UPPER(REPLACE(SUBSTRING(o.bssid, 1, 8), ':', '')) = ${this.ctx.addParam(cleaned)}`
        );
        this.ctx.addApplied('identity', 'manufacturerOui', cleaned);
      } else {
        this.ctx.obsJoins.add(SqlFragmentLibrary.joinRadioManufacturers('o', 'rm'));
        where.push(`rm.manufacturer ILIKE ${this.ctx.addParam(`%${f.manufacturer}%`)}`);
        this.ctx.addApplied('identity', 'manufacturer', f.manufacturer);
      }
    }

    const radioResult = buildRadioPredicates({
      enabled: this.ctx.enabled,
      filters: this.ctx.filters,
      addParam: this.ctx.addParam.bind(this.ctx),
      expressions: {
        typeExpr: OBS_TYPE_EXPR('o'),
        frequencyExpr: 'o.radio_frequency',
        channelExpr: WIFI_CHANNEL_EXPR('o'),
        signalExpr: 'o.level',
      },
      options: {
        rssiRequireNotNullExpr: 'o.level IS NOT NULL',
        rssiIncludeNoiseFloor: true,
      },
    });
    where.push(...radioResult.where);
    radioResult.applied.forEach((entry) => this.ctx.addApplied('radio', entry.field, entry.value));

    if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
      const securityClauses: string[] = [];
      const obsSecurityExpr = SECURITY_EXPR('o');
      f.encryptionTypes.forEach((type) => {
        const normalizedType = String(type).trim().toUpperCase();
        const finalType = normalizedType.includes('WEP') ? 'WEP' : normalizedType;
        switch (finalType) {
          case 'OPEN':
            securityClauses.push(`${obsSecurityExpr} = 'OPEN'`);
            break;
          case 'WEP':
            securityClauses.push(`${obsSecurityExpr} = 'WEP'`);
            break;
          case 'WPA':
            securityClauses.push(`${obsSecurityExpr} = 'WPA'`);
            break;
          case 'WPA2-P':
            securityClauses.push(`${obsSecurityExpr} = 'WPA2-P'`);
            break;
          case 'WPA2-E':
            securityClauses.push(`${obsSecurityExpr} = 'WPA2-E'`);
            break;
          case 'WPA2':
            securityClauses.push(`${obsSecurityExpr} IN ('WPA2', 'WPA2-P', 'WPA2-E')`);
            break;
          case 'WPA3-P':
            securityClauses.push(`${obsSecurityExpr} = 'WPA3-P'`);
            break;
          case 'WPA3-E':
            securityClauses.push(`${obsSecurityExpr} = 'WPA3-E'`);
            break;
          case 'WPA3':
            securityClauses.push(`${obsSecurityExpr} IN ('WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`);
            break;
          case 'OWE':
            securityClauses.push(`${obsSecurityExpr} = 'OWE'`);
            break;
          case 'WPS':
            securityClauses.push(`${obsSecurityExpr} = 'WPS'`);
            break;
          case 'UNKNOWN':
            securityClauses.push(`${obsSecurityExpr} = 'UNKNOWN'`);
            break;
          case 'MIXED':
            securityClauses.push(
              `${obsSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA2-E', 'WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`
            );
            break;
        }
      });
      if (securityClauses.length > 0) {
        where.push(`(${securityClauses.join(' OR ')})`);
        this.ctx.addApplied('security', 'encryptionTypes', f.encryptionTypes);
      }
    }

    if (e.securityFlags && Array.isArray(f.securityFlags) && f.securityFlags.length > 0) {
      const flagClauses: string[] = [];
      const obsSecurityExpr = SECURITY_EXPR('o');
      if (f.securityFlags.includes('insecure'))
        flagClauses.push(`${obsSecurityExpr} IN ('OPEN', 'WEP', 'WPS')`);
      if (f.securityFlags.includes('deprecated')) flagClauses.push(`${obsSecurityExpr} = 'WEP'`);
      if (f.securityFlags.includes('enterprise'))
        flagClauses.push(`${obsSecurityExpr} IN ('WPA2-E', 'WPA3-E')`);
      if (f.securityFlags.includes('personal'))
        flagClauses.push(`${obsSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA3', 'WPA3-P')`);
      if (f.securityFlags.includes('unknown')) flagClauses.push(`${obsSecurityExpr} = 'UNKNOWN'`);
      if (flagClauses.length > 0) {
        where.push(`(${flagClauses.join(' OR ')})`);
        this.ctx.addApplied('security', 'securityFlags', f.securityFlags);
      }
    }

    if (e.timeframe && f.timeframe) {
      const scope = f.temporalScope || 'observation_time';
      if (scope === 'threat_window') {
        this.ctx.addWarning('Threat window scope mapped to observation_time on slow path.');
      }
      const timeColumn = scope === 'threat_window' ? 'o.time' : 'o.time';
      if (f.timeframe.type === 'absolute') {
        if (f.timeframe.startTimestamp)
          where.push(
            `${timeColumn} >= ${this.ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`
          );
        if (f.timeframe.endTimestamp)
          where.push(
            `${timeColumn} <= ${this.ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`
          );
      } else {
        const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
        if (window) where.push(`${timeColumn} >= NOW() - ${this.ctx.addParam(window)}::interval`);
      }
      this.ctx.addApplied('temporal', 'timeframe', f.timeframe);
      this.ctx.addApplied('temporal', 'temporalScope', scope);
    }

    if (e.boundingBox && f.boundingBox) {
      where.push(
        `o.geom && ST_MakeEnvelope(${this.ctx.addParam(f.boundingBox.west)}, ${this.ctx.addParam(f.boundingBox.south)}, ${this.ctx.addParam(f.boundingBox.east)}, ${this.ctx.addParam(f.boundingBox.north)}, 4326)`
      );
      this.ctx.addApplied('spatial', 'boundingBox', f.boundingBox);
    }

    if (e.radiusFilter && f.radiusFilter) {
      where.push(
        `ST_DWithin(o.geom::geography, ST_SetSRID(ST_MakePoint(${this.ctx.addParam(f.radiusFilter.longitude)}, ${this.ctx.addParam(f.radiusFilter.latitude)}), 4326)::geography, ${this.ctx.addParam(f.radiusFilter.radiusMeters)})`
      );
      this.ctx.addApplied('spatial', 'radiusFilter', f.radiusFilter);
    }

    if (e.distanceFromHomeMin || e.distanceFromHomeMax) {
      this.ctx.requiresHome = true;
      if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
        where.push(
          `ST_Distance(o.geom::geography, home.home_point) >= ${this.ctx.addParam(f.distanceFromHomeMin * 1000)}`
        );
        this.ctx.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
      }
      if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
        where.push(
          `ST_Distance(o.geom::geography, home.home_point) <= ${this.ctx.addParam(f.distanceFromHomeMax * 1000)}`
        );
        this.ctx.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
      }
    }

    const engagementResult = buildEngagementPredicates({
      enabled: this.ctx.enabled,
      filters: this.ctx.filters,
      addParam: this.ctx.addParam.bind(this.ctx),
      bssidExpr: 'o.bssid',
      tagAlias: 'nt_filter',
      tagLowerExpr: NT_FILTER_TAG_LOWER_EXPR,
      tagIgnoredExpr: NT_FILTER_IS_IGNORED_EXPR,
    });
    where.push(...engagementResult.where);
    engagementResult.applied.forEach((entry) =>
      this.ctx.addApplied('engagement', entry.field, entry.value)
    );

    return { where, joins: Array.from(this.ctx.obsJoins) };
  }

  public buildFilteredObservationsCte(options: { selectedBssids?: string[] } = {}): CteResult {
    const { selectedBssids = [] } = options;
    const { where, joins } = this.buildObservationFilters();

    if (selectedBssids.length > 0) {
      where.push(
        `UPPER(o.bssid) = ANY(${this.ctx.addParam(selectedBssids.map((b) => b.toUpperCase()))})`
      );
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const joinClause = joins.join('\n        ');

    const homeCte = this.ctx.requiresHome
      ? `home AS (
        SELECT ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography AS home_point
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
      ),`
      : '';

    const cte = `
      WITH ${homeCte}
      filtered_obs AS (
        SELECT o.*
        FROM app.observations o
        ${joinClause}
        ${this.ctx.requiresHome && !joinClause.includes('CROSS JOIN home') ? 'CROSS JOIN home' : ''}
        ${whereClause.length > 0 ? `${whereClause} AND COALESCE(o.is_quality_filtered, FALSE) = FALSE` : 'WHERE COALESCE(o.is_quality_filtered, FALSE) = FALSE'}
      )
    `;

    return { cte, params: this.ctx.getParams() as any[] };
  }
}
