import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import { OBS_TYPE_EXPR, SECURITY_EXPR, WIFI_CHANNEL_EXPR } from '../sqlExpressions';
import { isOui, coerceOui, splitTextFilterTokens } from '../normalizers';
import { buildRadioPredicates } from '../radioPredicates';
import { buildEngagementPredicates } from '../engagementPredicates';
import { RELATIVE_WINDOWS } from '../constants';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { ObservationFiltersResult } from '../types';

const NT_FILTER_TAG_LOWER_EXPR = 'LOWER(nt_filter.threat_tag)';
const NT_FILTER_IS_IGNORED_EXPR = 'COALESCE(nt_filter.is_ignored, FALSE)';

export function buildObservationFilters(ctx: FilterBuildContext): ObservationFiltersResult {
  const where: string[] = [];
  const f = ctx.filters;
  const e = ctx.enabled;

  if (e.excludeInvalidCoords) {
    where.push(
      'o.lat IS NOT NULL',
      'o.lon IS NOT NULL',
      'o.lat BETWEEN -90 AND 90',
      'o.lon BETWEEN -180 AND 180'
    );
    ctx.addApplied('quality', 'excludeInvalidCoords', true);
  }

  if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
    where.push(
      `o.accuracy IS NOT NULL AND o.accuracy > 0 AND o.accuracy <= ${ctx.addParam(
        f.gpsAccuracyMax
      )}`
    );
    ctx.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
  }

  if (e.observationCountMin && f.observationCountMin !== undefined) {
    ctx.obsJoins.add('JOIN app.networks ap ON UPPER(ap.bssid) = UPPER(o.bssid)');
    where.push(`ap.observations >= ${ctx.addParam(f.observationCountMin)}`);
    ctx.addApplied('quality', 'observationCountMin', f.observationCountMin);
  }

  if (e.observationCountMax && f.observationCountMax !== undefined) {
    ctx.obsJoins.add('JOIN app.networks ap ON UPPER(ap.bssid) = UPPER(o.bssid)');
    where.push(`ap.observations <= ${ctx.addParam(f.observationCountMax)}`);
    ctx.addApplied('quality', 'observationCountMax', f.observationCountMax);
  }

  if (e.ssid && f.ssid) {
    const ssidTokens = splitTextFilterTokens(f.ssid);
    const predicates = (ssidTokens.length > 0 ? ssidTokens : [String(f.ssid)]).map(
      (token) => `o.ssid ILIKE ${ctx.addParam(`%${token}%`)}`
    );
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'ssid', f.ssid);
  }

  if (e.bssid && f.bssid) {
    const bssidTokens = splitTextFilterTokens(f.bssid);
    const predicates = (bssidTokens.length > 0 ? bssidTokens : [String(f.bssid)]).map((token) => {
      const value = token.toUpperCase();
      return value.length === 17
        ? `UPPER(o.bssid) = ${ctx.addParam(value)}`
        : `UPPER(o.bssid) LIKE ${ctx.addParam(`${value}%`)}`;
    });
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'bssid', f.bssid);
  }

  if (e.manufacturer && f.manufacturer) {
    const manufacturerTokens = splitTextFilterTokens(f.manufacturer);
    const predicates = (
      manufacturerTokens.length > 0 ? manufacturerTokens : [String(f.manufacturer)]
    ).map((token) => {
      const cleaned = coerceOui(token);
      if (isOui(cleaned)) {
        return `UPPER(REPLACE(SUBSTRING(o.bssid, 1, 8), ':', '')) = ${ctx.addParam(cleaned)}`;
      }
      ctx.obsJoins.add(SqlFragmentLibrary.joinRadioManufacturers('o', 'rm'));
      return `rm.manufacturer ILIKE ${ctx.addParam(`%${token}%`)}`;
    });
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'manufacturer', f.manufacturer);
  }

  const radioResult = buildRadioPredicates({
    enabled: ctx.enabled,
    filters: ctx.filters,
    addParam: ctx.addParam.bind(ctx),
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
  radioResult.applied.forEach((entry) => ctx.addApplied('radio', entry.field, entry.value));

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
      ctx.addApplied('security', 'encryptionTypes', f.encryptionTypes);
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
      ctx.addApplied('security', 'securityFlags', f.securityFlags);
    }
  }

  if (e.timeframe && f.timeframe) {
    const scope = f.temporalScope || 'observation_time';
    if (scope === 'threat_window') {
      ctx.addWarning('Threat window scope mapped to observation_time on slow path.');
    }
    const timeColumn = scope === 'threat_window' ? 'o.time' : 'o.time';
    if (f.timeframe.type === 'absolute') {
      if (f.timeframe.startTimestamp) {
        where.push(`${timeColumn} >= ${ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`);
      }
      if (f.timeframe.endTimestamp) {
        where.push(`${timeColumn} <= ${ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`);
      }
    } else {
      const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
      if (window) {
        where.push(`${timeColumn} >= NOW() - ${ctx.addParam(window)}::interval`);
      }
    }
    ctx.addApplied('temporal', 'timeframe', f.timeframe);
    ctx.addApplied('temporal', 'temporalScope', scope);
  }

  if (e.boundingBox && f.boundingBox) {
    const west = f.boundingBox.west;
    const south = f.boundingBox.south;
    const east = f.boundingBox.east;
    const north = f.boundingBox.north;

    if (west <= east) {
      where.push(
        `o.geom && ST_MakeEnvelope(${ctx.addParam(west)}, ${ctx.addParam(south)}, ${ctx.addParam(east)}, ${ctx.addParam(north)}, 4326)`
      );
    } else {
      where.push(
        `(o.geom && ST_MakeEnvelope(${ctx.addParam(west)}, ${ctx.addParam(south)}, 180, ${ctx.addParam(north)}, 4326) OR o.geom && ST_MakeEnvelope(-180, ${ctx.addParam(south)}, ${ctx.addParam(east)}, ${ctx.addParam(north)}, 4326))`
      );
    }
    ctx.addApplied('spatial', 'boundingBox', f.boundingBox);
  }

  if (e.radiusFilter && f.radiusFilter) {
    where.push(
      `ST_DWithin(o.geom::geography, ST_SetSRID(ST_MakePoint(${ctx.addParam(f.radiusFilter.longitude)}, ${ctx.addParam(f.radiusFilter.latitude)}), 4326)::geography, ${ctx.addParam(f.radiusFilter.radiusMeters)})`
    );
    ctx.addApplied('spatial', 'radiusFilter', f.radiusFilter);
  }

  if (e.distanceFromHomeMin || e.distanceFromHomeMax) {
    ctx.requiresHome = true;
    if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
      where.push(
        `ST_Distance(o.geom::geography, home.home_point) >= ${ctx.addParam(f.distanceFromHomeMin * 1000)}`
      );
      ctx.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
    }
    if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
      where.push(
        `ST_Distance(o.geom::geography, home.home_point) <= ${ctx.addParam(f.distanceFromHomeMax * 1000)}`
      );
      ctx.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
    }
  }

  const engagementResult = buildEngagementPredicates({
    enabled: ctx.enabled,
    filters: ctx.filters,
    addParam: ctx.addParam.bind(ctx),
    bssidExpr: 'o.bssid',
    tagAlias: 'nt_filter',
    tagLowerExpr: NT_FILTER_TAG_LOWER_EXPR,
    tagIgnoredExpr: NT_FILTER_IS_IGNORED_EXPR,
  });
  where.push(...engagementResult.where);
  engagementResult.applied.forEach((entry) =>
    ctx.addApplied('engagement', entry.field, entry.value)
  );

  return { where, joins: Array.from(ctx.obsJoins) };
}
