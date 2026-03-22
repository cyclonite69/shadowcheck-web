import type { FilterBuildContext } from '../FilterBuildContext';
import type { FilteredQueryResult, NetworkListOptions, QueryResult } from '../types';
import { RELATIVE_WINDOWS } from '../constants';
import { FIELD_EXPRESSIONS, NULL_SAFE_COMPARISONS } from '../SchemaCompat';
import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import { SECURITY_FROM_CAPS_EXPR, NETWORK_CHANNEL_EXPR } from '../sqlExpressions';
import { isOui, coerceOui, splitTextFilterTokens } from '../normalizers';
import { applyEngagementFilters, applyRadioFilters } from './networkPredicateAdapters';

const NT_TAG_LOWER_EXPR = FIELD_EXPRESSIONS.threatTagLowercase('nt');
const NT_IS_IGNORED_EXPR = NULL_SAFE_COMPARISONS.isIgnored('nt');
const NT_NOT_IGNORED_CLAUSE = 'COALESCE(nt.is_ignored, FALSE) = FALSE';
const RM_SELECT_FIELDS = SqlFragmentLibrary.selectManufacturerFields('rm');
const NT_SELECT_FIELDS = SqlFragmentLibrary.selectThreatTagFields('nt');

export function buildNetworkOnlyQueryImpl(
  ctx: FilterBuildContext,
  options: NetworkListOptions
): FilteredQueryResult {
  const { limit = 500, offset = 0, orderBy = 'last_observed_at DESC' } = options;
  const f = ctx.filters;
  const e = ctx.enabled;
  const where: string[] = [];
  if (!ctx.shouldIncludeIgnoredByExplicitTagFilter()) {
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
      (token) => `ne.ssid ILIKE ${ctx.addParam(`%${token}%`)}`
    );
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'ssid', f.ssid);
  }
  if (e.bssid && f.bssid) {
    const bssidTokens = splitTextFilterTokens(f.bssid);
    const predicates = (bssidTokens.length > 0 ? bssidTokens : [String(f.bssid)]).map((token) => {
      const value = token.toUpperCase();
      return value.length === 17
        ? `UPPER(ne.bssid) = ${ctx.addParam(value)}`
        : `UPPER(ne.bssid) LIKE ${ctx.addParam(`${value}%`)}`;
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
      return isOui(cleaned)
        ? `UPPER(REPLACE(SUBSTRING(ne.bssid, 1, 8), ':', '')) = ${ctx.addParam(cleaned)}`
        : `ne.manufacturer ILIKE ${ctx.addParam(`%${token}%`)}`;
    });
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'manufacturer', f.manufacturer);
  }
  where.push(
    ...applyRadioFilters(ctx, {
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
    ctx.addApplied('security', 'encryptionTypes', f.encryptionTypes);
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
      ctx.addApplied('security', 'securityFlags', f.securityFlags);
    }
  }
  if (e.observationCountMin && f.observationCountMin !== undefined) {
    where.push(`ne.observations >= ${ctx.addParam(f.observationCountMin)}`);
    ctx.addApplied('quality', 'observationCountMin', f.observationCountMin);
  }
  if (e.observationCountMax && f.observationCountMax !== undefined) {
    where.push(`ne.observations <= ${ctx.addParam(f.observationCountMax)}`);
    ctx.addApplied('quality', 'observationCountMax', f.observationCountMax);
  }
  where.push(
    ...applyEngagementFilters(ctx, {
      bssidExpr: 'ne.bssid',
      tagAlias: 'nt',
      tagLowerExpr: NT_TAG_LOWER_EXPR,
      tagIgnoredExpr: NT_IS_IGNORED_EXPR,
    })
  );
  if (e.wigle_v3_observation_count_min && f.wigle_v3_observation_count_min !== undefined) {
    if (ctx.context?.pageType === 'wigle') {
      where.push(
        `ne.wigle_v3_observation_count >= ${ctx.addParam(f.wigle_v3_observation_count_min)}`
      );
      ctx.addApplied('quality', 'wigle_v3_observation_count_min', f.wigle_v3_observation_count_min);
    } else {
      ctx.addIgnored('quality', 'wigle_v3_observation_count_min', 'unsupported_page');
    }
  }
  if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
    where.push(
      `ne.accuracy_meters IS NOT NULL AND ne.accuracy_meters > 0 AND ne.accuracy_meters <= ${ctx.addParam(
        f.gpsAccuracyMax
      )}`
    );
    ctx.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
  }
  if (e.excludeInvalidCoords) {
    where.push(
      'ne.lat IS NOT NULL',
      'ne.lon IS NOT NULL',
      'ne.lat BETWEEN -90 AND 90',
      'ne.lon BETWEEN -180 AND 180'
    );
    ctx.addApplied('quality', 'excludeInvalidCoords', true);
  }
  if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
    where.push(`ne.distance_from_home_km >= ${ctx.addParam(f.distanceFromHomeMin)}`);
    ctx.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
  }
  if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
    where.push(`ne.distance_from_home_km <= ${ctx.addParam(f.distanceFromHomeMax)}`);
    ctx.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
  }
  if (e.threatScoreMin && f.threatScoreMin !== undefined) {
    where.push(
      ...ctx.buildThreatScorePredicate({
        min: f.threatScoreMin,
        expr: 'ne.threat_score',
        wrapExpr: false,
      })
    );
    ctx.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
  }
  if (e.threatScoreMax && f.threatScoreMax !== undefined) {
    where.push(
      ...ctx.buildThreatScorePredicate({
        max: f.threatScoreMax,
        expr: 'ne.threat_score',
        wrapExpr: false,
      })
    );
    ctx.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
  }
  if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
    const threatLevelMap: Record<string, string> = {
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
      where.push(`ne.threat_level = ANY(${ctx.addParam(dbThreatLevels)})`);
      ctx.addApplied('threat', 'threatCategories', f.threatCategories);
    }
  }
  if (e.stationaryConfidenceMin && f.stationaryConfidenceMin !== undefined) {
    where.push(`ne.stationary_confidence >= ${ctx.addParam(f.stationaryConfidenceMin)}`);
    ctx.addApplied('threat', 'stationaryConfidenceMin', f.stationaryConfidenceMin);
  }
  if (e.stationaryConfidenceMax && f.stationaryConfidenceMax !== undefined) {
    where.push(`ne.stationary_confidence <= ${ctx.addParam(f.stationaryConfidenceMax)}`);
    ctx.addApplied('threat', 'stationaryConfidenceMax', f.stationaryConfidenceMax);
  }

  if (e.timeframe && f.timeframe) {
    const scope = f.temporalScope || 'observation_time';
    if (scope === 'threat_window') {
      ctx.addWarning('Threat window scope mapped to observation_time on fast path.');
    }
    if (f.timeframe.type === 'absolute') {
      if (f.timeframe.startTimestamp) {
        where.push(`ne.last_seen >= ${ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`);
      }
      if (f.timeframe.endTimestamp) {
        where.push(`ne.last_seen <= ${ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`);
      }
    } else {
      const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
      if (window) {
        where.push(`ne.last_seen >= NOW() - ${ctx.addParam(window)}::interval`);
      }
    }
    ctx.addApplied('temporal', 'timeframe', f.timeframe);
    ctx.addApplied('temporal', 'temporalScope', scope);
  }

  ctx.params = [...ctx.getParams()];

  const limitParam = ctx.addParam(limit);
  const offsetParam = ctx.addParam(offset);

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
    params: ctx.getParams() as any[],
    appliedFilters: ctx.state.appliedFilters(),
    ignoredFilters: ctx.state.ignoredFilters(),
    warnings: ctx.state.warnings(),
  };
}

export function buildNetworkOnlyCountQuery(ctx: FilterBuildContext): QueryResult {
  const f = ctx.filters;
  const e = ctx.enabled;
  const where: string[] = [];
  if (!ctx.shouldIncludeIgnoredByExplicitTagFilter()) {
    where.push(`NOT EXISTS (
  SELECT 1
  FROM app.network_tags nt_ignored
  WHERE UPPER(nt_ignored.bssid) = UPPER(ne.bssid)
    AND COALESCE((to_jsonb(nt_ignored)->>'is_ignored')::boolean, FALSE) = TRUE
)`);
  }

  if (e.ssid && f.ssid) {
    const ssidTokens = splitTextFilterTokens(f.ssid);
    const predicates = (ssidTokens.length > 0 ? ssidTokens : [String(f.ssid)]).map(
      (token) => `ne.ssid ILIKE ${ctx.addParam(`%${token}%`)}`
    );
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'ssid', f.ssid);
  }
  if (e.bssid && f.bssid) {
    const bssidTokens = splitTextFilterTokens(f.bssid);
    const predicates = (bssidTokens.length > 0 ? bssidTokens : [String(f.bssid)]).map((token) => {
      const value = token.toUpperCase();
      return value.length === 17
        ? `UPPER(ne.bssid) = ${ctx.addParam(value)}`
        : `UPPER(ne.bssid) LIKE ${ctx.addParam(`${value}%`)}`;
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
      return isOui(cleaned)
        ? `UPPER(REPLACE(SUBSTRING(ne.bssid, 1, 8), ':', '')) = ${ctx.addParam(cleaned)}`
        : `ne.manufacturer ILIKE ${ctx.addParam(`%${token}%`)}`;
    });
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'manufacturer', f.manufacturer);
  }
  where.push(
    ...applyRadioFilters(ctx, {
      typeExpr: 'ne.type',
      frequencyExpr: 'ne.frequency',
      channelExpr: NETWORK_CHANNEL_EXPR('ne'),
      signalExpr: 'ne.signal',
    })
  );
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
          securityClauses.push(`${networkSecurityExpr} = ${ctx.addParam(finalType)}`);
          break;
      }
    });
    if (securityClauses.length > 0) {
      where.push(`(${securityClauses.join(' OR ')})`);
      ctx.addApplied('security', 'encryptionTypes', f.encryptionTypes);
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
      ctx.addApplied('security', 'securityFlags', f.securityFlags);
    }
  }
  if (e.observationCountMin && f.observationCountMin !== undefined) {
    where.push(`ne.observations >= ${ctx.addParam(f.observationCountMin)}`);
    ctx.addApplied('quality', 'observationCountMin', f.observationCountMin);
  }
  if (e.observationCountMax && f.observationCountMax !== undefined) {
    where.push(`ne.observations <= ${ctx.addParam(f.observationCountMax)}`);
    ctx.addApplied('quality', 'observationCountMax', f.observationCountMax);
  }
  where.push(
    ...applyEngagementFilters(ctx, {
      bssidExpr: 'ne.bssid',
      tagAlias: 'nt',
      tagLowerExpr: `LOWER(COALESCE((to_jsonb(nt)->>'threat_tag'), ''))`,
      tagIgnoredExpr: `COALESCE((to_jsonb(nt)->>'is_ignored')::boolean, FALSE)`,
    })
  );
  if (e.wigle_v3_observation_count_min && f.wigle_v3_observation_count_min !== undefined) {
    if (ctx.context?.pageType === 'wigle') {
      where.push(
        `ne.wigle_v3_observation_count >= ${ctx.addParam(f.wigle_v3_observation_count_min)}`
      );
      ctx.addApplied('quality', 'wigle_v3_observation_count_min', f.wigle_v3_observation_count_min);
    }
  }
  if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
    where.push(
      `ne.accuracy_meters IS NOT NULL AND ne.accuracy_meters > 0 AND ne.accuracy_meters <= ${ctx.addParam(
        f.gpsAccuracyMax
      )}`
    );
    ctx.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
  }
  if (e.excludeInvalidCoords) {
    where.push(
      'ne.lat IS NOT NULL',
      'ne.lon IS NOT NULL',
      'ne.lat BETWEEN -90 AND 90',
      'ne.lon BETWEEN -180 AND 180'
    );
    ctx.addApplied('quality', 'excludeInvalidCoords', true);
  }
  if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
    where.push(`ne.distance_from_home_km >= ${ctx.addParam(f.distanceFromHomeMin)}`);
    ctx.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
  }
  if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
    where.push(`ne.distance_from_home_km <= ${ctx.addParam(f.distanceFromHomeMax)}`);
    ctx.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
  }
  if (e.threatScoreMin && f.threatScoreMin !== undefined) {
    where.push(
      ...ctx.buildThreatScorePredicate({
        min: f.threatScoreMin,
        expr: 'ne.threat_score',
        wrapExpr: false,
      })
    );
    ctx.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
  }
  if (e.threatScoreMax && f.threatScoreMax !== undefined) {
    where.push(
      ...ctx.buildThreatScorePredicate({
        max: f.threatScoreMax,
        expr: 'ne.threat_score',
        wrapExpr: false,
      })
    );
    ctx.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
  }
  if (e.stationaryConfidenceMin && f.stationaryConfidenceMin !== undefined) {
    where.push(`ne.stationary_confidence >= ${ctx.addParam(f.stationaryConfidenceMin)}`);
    ctx.addApplied('threat', 'stationaryConfidenceMin', f.stationaryConfidenceMin);
  }
  if (e.stationaryConfidenceMax && f.stationaryConfidenceMax !== undefined) {
    where.push(`ne.stationary_confidence <= ${ctx.addParam(f.stationaryConfidenceMax)}`);
    ctx.addApplied('threat', 'stationaryConfidenceMax', f.stationaryConfidenceMax);
  }
  if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
    const threatLevelMap: Record<string, string> = {
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
    where.push(`ne.threat_level = ANY(${ctx.addParam(dbThreatLevels)})`);
    ctx.addApplied('threat', 'threatCategories', f.threatCategories);
  }
  if (e.timeframe && f.timeframe) {
    const scope = f.temporalScope || 'observation_time';
    if (f.timeframe.type === 'absolute') {
      if (f.timeframe.startTimestamp) {
        where.push(`ne.last_seen >= ${ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`);
      }
      if (f.timeframe.endTimestamp) {
        where.push(`ne.last_seen <= ${ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`);
      }
    } else {
      const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
      if (window) {
        where.push(`ne.last_seen >= NOW() - ${ctx.addParam(window)}::interval`);
      }
    }
    ctx.addApplied('temporal', 'timeframe', f.timeframe);
    ctx.addApplied('temporal', 'temporalScope', scope);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return {
    sql: `SELECT COUNT(*) AS total FROM app.api_network_explorer_mv ne
            ${whereClause}`,
    params: [...ctx.params],
  };
}
