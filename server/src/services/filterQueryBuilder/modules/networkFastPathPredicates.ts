import { RELATIVE_WINDOWS } from '../constants';
import { FIELD_EXPRESSIONS, NULL_SAFE_COMPARISONS } from '../SchemaCompat';
import { SECURITY_FROM_CAPS_EXPR } from '../sqlExpressions';
import { isOui, coerceOui, splitTextFilterTokens } from '../normalizers';
import type { FilterBuildContext } from '../FilterBuildContext';
import { applyEngagementFilters, applyRadioFilters } from './networkPredicateAdapters';

export const NT_TAG_LOWER_EXPR = FIELD_EXPRESSIONS.threatTagLowercase('nt');
export const NT_IS_IGNORED_EXPR = NULL_SAFE_COMPARISONS.isIgnored('nt');
export const NT_NOT_IGNORED_CLAUSE = 'COALESCE(nt.is_ignored, FALSE) = FALSE';
export const NE_NOT_IGNORED_EXISTS_CLAUSE = `NOT EXISTS (
  SELECT 1
  FROM app.network_tags nt_ignored
  WHERE UPPER(nt_ignored.bssid) = UPPER(ne.bssid)
    AND COALESCE((to_jsonb(nt_ignored)->>'is_ignored')::boolean, FALSE) = TRUE
)`;

const THREAT_LEVEL_MAP: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  none: 'NONE',
};

export interface FastPathPredicateOptions {
  ignoredClause: string;
  channelExpr: string;
  channelWrapComparisons?: boolean;
  tagLowerExpr: string;
  tagIgnoredExpr: string;
  addUnsupportedWigleIgnored?: boolean;
  allowUnknownEncryptionFallback?: boolean;
}

function mapThreatCategoriesToDbLevels(threatCategories: string[]): string[] {
  return Array.from(
    new Set(
      threatCategories
        .flatMap((cat) => {
          const mapped = THREAT_LEVEL_MAP[cat] || cat.toUpperCase();
          if (mapped === 'MEDIUM' || mapped === 'MED') return ['MEDIUM', 'MED'];
          return [mapped];
        })
        .filter(Boolean)
    )
  );
}

export function buildListChannelExpr(frequencyExpr: string): string {
  return `
      CASE
        WHEN ${frequencyExpr} BETWEEN 2412 AND 2484 THEN
          CASE
            WHEN ${frequencyExpr} = 2484 THEN 14
            ELSE FLOOR((${frequencyExpr} - 2412) / 5) + 1
          END
        WHEN ${frequencyExpr} BETWEEN 5000 AND 5900 THEN
          FLOOR((${frequencyExpr} - 5000) / 5)
        WHEN ${frequencyExpr} BETWEEN 5925 AND 7125 THEN
          FLOOR((${frequencyExpr} - 5925) / 5)
        ELSE NULL
      END
    `;
}

function buildEncryptionClauses(
  ctx: FilterBuildContext,
  encryptionTypes: unknown[],
  networkSecurityExpr: string,
  allowUnknownEncryptionFallback = false
): string[] {
  const securityClauses: string[] = [];

  encryptionTypes.forEach((type) => {
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
        if (allowUnknownEncryptionFallback) {
          securityClauses.push(`${networkSecurityExpr} = ${ctx.addParam(finalType)}`);
        }
        break;
    }
  });

  return securityClauses;
}

function buildSecurityFlagClauses(securityFlags: string[], networkSecurityExpr: string): string[] {
  const flagClauses: string[] = [];

  if (securityFlags.includes('insecure')) {
    flagClauses.push(`${networkSecurityExpr} IN ('OPEN', 'WEP', 'WPS')`);
  }
  if (securityFlags.includes('deprecated')) {
    flagClauses.push(`${networkSecurityExpr} = 'WEP'`);
  }
  if (securityFlags.includes('enterprise')) {
    flagClauses.push(`${networkSecurityExpr} IN ('WPA2-E', 'WPA3-E')`);
  }
  if (securityFlags.includes('personal')) {
    flagClauses.push(`${networkSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA3', 'WPA3-P')`);
  }
  if (securityFlags.includes('unknown')) {
    flagClauses.push(`${networkSecurityExpr} = 'UNKNOWN'`);
  }

  return flagClauses;
}

export function buildFastPathPredicates(
  ctx: FilterBuildContext,
  options: FastPathPredicateOptions
): string[] {
  const f = ctx.filters;
  const e = ctx.enabled;
  const where: string[] = [];
  const networkSecurityExpr = SECURITY_FROM_CAPS_EXPR('COALESCE(ne.capabilities, ne.security)');

  if (!ctx.shouldIncludeIgnoredByExplicitTagFilter()) {
    where.push(options.ignoredClause);
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
      channelExpr: options.channelExpr,
      signalExpr: 'ne.signal',
      channelWrapComparisons: options.channelWrapComparisons,
    })
  );

  if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
    const securityClauses = buildEncryptionClauses(
      ctx,
      f.encryptionTypes,
      networkSecurityExpr,
      options.allowUnknownEncryptionFallback
    );
    if (securityClauses.length > 0) {
      where.push(`(${securityClauses.join(' OR ')})`);
      ctx.addApplied('security', 'encryptionTypes', f.encryptionTypes);
    }
  }

  if (e.securityFlags && Array.isArray(f.securityFlags) && f.securityFlags.length > 0) {
    const flagClauses = buildSecurityFlagClauses(f.securityFlags, networkSecurityExpr);
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
      tagLowerExpr: options.tagLowerExpr,
      tagIgnoredExpr: options.tagIgnoredExpr,
    })
  );

  if (e.wigle_v3_observation_count_min && f.wigle_v3_observation_count_min !== undefined) {
    if (ctx.context?.pageType === 'wigle') {
      where.push(
        `ne.wigle_v3_observation_count >= ${ctx.addParam(f.wigle_v3_observation_count_min)}`
      );
      ctx.addApplied('quality', 'wigle_v3_observation_count_min', f.wigle_v3_observation_count_min);
    } else if (options.addUnsupportedWigleIgnored) {
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
  if (e.stationaryConfidenceMin && f.stationaryConfidenceMin !== undefined) {
    where.push(`ne.stationary_confidence >= ${ctx.addParam(f.stationaryConfidenceMin)}`);
    ctx.addApplied('threat', 'stationaryConfidenceMin', f.stationaryConfidenceMin);
  }
  if (e.stationaryConfidenceMax && f.stationaryConfidenceMax !== undefined) {
    where.push(`ne.stationary_confidence <= ${ctx.addParam(f.stationaryConfidenceMax)}`);
    ctx.addApplied('threat', 'stationaryConfidenceMax', f.stationaryConfidenceMax);
  }
  if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
    const dbThreatLevels = mapThreatCategoriesToDbLevels(f.threatCategories);
    if (dbThreatLevels.length > 0) {
      where.push(`ne.threat_level = ANY(${ctx.addParam(dbThreatLevels)})`);
      ctx.addApplied('threat', 'threatCategories', f.threatCategories);
    }
  }
  if (e.timeframe && f.timeframe) {
    const scope = f.temporalScope || 'observation_time';
    if (scope === 'threat_window' && options.addUnsupportedWigleIgnored) {
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

  return where;
}
