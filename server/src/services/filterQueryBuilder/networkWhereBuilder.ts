import { RELATIVE_WINDOWS } from './constants';
import { buildEngagementPredicates } from './engagementPredicates';
import { splitTextFilterTokens, normalizeWildcards } from './normalizers';
import type { NetworkWhereBuildContext } from './NetworkWhereBuildContext';
import { SqlFragmentLibrary } from './SqlFragmentLibrary';
import { mapThreatCategoriesToDbLevels } from './threatCategoryLevels';

export function buildNetworkWhere(ctx: NetworkWhereBuildContext): string[] {
  const f = ctx.filters;
  const e = ctx.enabled;
  const networkWhere: string[] = [];

  // Network-level SSID filtering: include networks where current SSID or any historical observation SSID matches.
  if (e.ssid && f.ssid) {
    const ssidTokens = splitTextFilterTokens(f.ssid);
    const predicates = (ssidTokens.length > 0 ? ssidTokens : [String(f.ssid)]).map((token) => {
      const isNegated = token.startsWith('-') || token.toUpperCase().startsWith('NOT ');
      const cleanToken = isNegated
        ? token.startsWith('-')
          ? token.substring(1).trim()
          : token.substring(4).trim()
        : token;

      const buildAlt = (alt: string): string => {
        const wildcardToken = normalizeWildcards(alt);
        const pattern =
          wildcardToken.includes('%') || wildcardToken.includes('_')
            ? wildcardToken
            : `%${wildcardToken}%`;
        const p = ctx.addParam(pattern);
        if (isNegated) {
          return `(ne.ssid NOT ILIKE ${p} ESCAPE '\\' AND NOT EXISTS (
          SELECT 1 FROM app.observations o2
          WHERE o2.bssid = ne.bssid AND NULLIF(o2.ssid, '') ILIKE ${p} ESCAPE '\\'
        ))`;
        }
        return `(ne.ssid ILIKE ${p} ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM app.observations o2
        WHERE o2.bssid = ne.bssid AND NULLIF(o2.ssid, '') ILIKE ${p} ESCAPE '\\'
      ))`;
      };

      const alternatives = cleanToken
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      if (alternatives.length <= 1) {
        return buildAlt(alternatives[0] ?? cleanToken);
      }
      const altClauses = alternatives.map(buildAlt);
      // Positive OR-group: (A OR B). Negated OR-group: NOT A AND NOT B (De Morgan).
      return isNegated ? `(${altClauses.join(' AND ')})` : `(${altClauses.join(' OR ')})`;
    });
    networkWhere.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' AND ')})`);
    ctx.addApplied('identity', 'ssid', f.ssid);
  }

  // Network-level BSSID filtering
  if (e.bssid && f.bssid) {
    const bssidTokens = splitTextFilterTokens(f.bssid);
    const predicates = (bssidTokens.length > 0 ? bssidTokens : [String(f.bssid)]).map((token) => {
      const isNegated = token.startsWith('-') || token.toUpperCase().startsWith('NOT ');
      const cleanToken = isNegated
        ? token.startsWith('-')
          ? token.substring(1).trim()
          : token.substring(4).trim()
        : token;
      const value = cleanToken.toUpperCase();
      const wildcardValue = normalizeWildcards(value);
      const isWildcard = wildcardValue.includes('%') || wildcardValue.includes('_');
      const operator = isNegated ? 'NOT LIKE' : 'LIKE';

      if (!isWildcard && value.length === 17) {
        const eqOperator = isNegated ? '!=' : '=';
        return `UPPER(ne.bssid) ${eqOperator} ${ctx.addParam(value)}`;
      }

      const pattern = isWildcard ? wildcardValue : `${wildcardValue}%`;
      return `UPPER(ne.bssid) ${operator} ${ctx.addParam(pattern)} ESCAPE '\\'`;
    });
    networkWhere.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'bssid', f.bssid);
  }

  if (e.threatScoreMin && f.threatScoreMin !== undefined) {
    networkWhere.push(
      ...ctx.buildThreatScorePredicate({
        min: f.threatScoreMin,
        expr: 'ne.threat_score',
        wrapExpr: false,
      })
    );
    ctx.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
  }
  if (e.threatScoreMax && f.threatScoreMax !== undefined) {
    networkWhere.push(
      ...ctx.buildThreatScorePredicate({
        max: f.threatScoreMax,
        expr: 'ne.threat_score',
        wrapExpr: false,
      })
    );
    ctx.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
  }
  if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
    const dbThreatLevels = mapThreatCategoriesToDbLevels(f.threatCategories);
    networkWhere.push(`ne.threat_level = ANY(${ctx.addParam(dbThreatLevels)})`);
    ctx.addApplied('threat', 'threatCategories', f.threatCategories);
  }
  if (e.observationCountMin && f.observationCountMin !== undefined) {
    networkWhere.push(`ne.observations >= ${ctx.addParam(f.observationCountMin)}`);
    ctx.addApplied('quality', 'observationCountMin', f.observationCountMin);
  }
  if (e.observationCountMax && f.observationCountMax !== undefined) {
    networkWhere.push(`ne.observations <= ${ctx.addParam(f.observationCountMax)}`);
    ctx.addApplied('quality', 'observationCountMax', f.observationCountMax);
  }

  const engagementResult = buildEngagementPredicates({
    enabled: ctx.enabled,
    filters: ctx.filters,
    addParam: ctx.addParam.bind(ctx),
    bssidExpr: 'ne.bssid',
    tagAlias: 'nt_filter',
    tagLowerExpr: 'LOWER(nt_filter.threat_tag)',
    tagIgnoredExpr: 'COALESCE(nt_filter.is_ignored, FALSE)',
  });
  networkWhere.push(...engagementResult.where);
  engagementResult.applied.forEach((entry) =>
    ctx.addApplied('engagement', entry.field, entry.value)
  );

  if (e.wigle_v3_observation_count_min && f.wigle_v3_observation_count_min !== undefined) {
    networkWhere.push(
      `ne.wigle_v3_observation_count >= ${ctx.addParam(f.wigle_v3_observation_count_min)}`
    );
    ctx.addApplied('quality', 'wigle_v3_observation_count_min', f.wigle_v3_observation_count_min);
  }
  if (e.wigle_v3_observation_count_max && f.wigle_v3_observation_count_max !== undefined) {
    networkWhere.push(
      `ne.wigle_v3_observation_count <= ${ctx.addParam(f.wigle_v3_observation_count_max)}`
    );
    ctx.addApplied('quality', 'wigle_v3_observation_count_max', f.wigle_v3_observation_count_max);
  }
  if (e.wigleV3LastImportBefore && f.wigleV3LastImportBefore) {
    networkWhere.push(
      `ne.wigle_v3_last_import_at <= ${ctx.addParam(f.wigleV3LastImportBefore)}::timestamptz`
    );
    ctx.addApplied('quality', 'wigleV3LastImportBefore', f.wigleV3LastImportBefore);
  }
  if (e.wigleV3LastImportAfter && f.wigleV3LastImportAfter) {
    networkWhere.push(
      `ne.wigle_v3_last_import_at >= ${ctx.addParam(f.wigleV3LastImportAfter)}::timestamptz`
    );
    ctx.addApplied('quality', 'wigleV3LastImportAfter', f.wigleV3LastImportAfter);
  }
  if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
    networkWhere.push(
      `ne.accuracy_meters IS NOT NULL AND ne.accuracy_meters > 0 AND ne.accuracy_meters <= ${ctx.addParam(
        f.gpsAccuracyMax
      )}`
    );
    ctx.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
  }
  if (e.excludeInvalidCoords) {
    networkWhere.push(
      'ne.lat IS NOT NULL',
      'ne.lon IS NOT NULL',
      'ne.lat BETWEEN -90 AND 90',
      'ne.lon BETWEEN -180 AND 180'
    );
    ctx.addApplied('quality', 'excludeInvalidCoords', true);
  }
  if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
    networkWhere.push(`ne.distance_from_home_km >= ${ctx.addParam(f.distanceFromHomeMin)}`);
    ctx.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
  }
  if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
    networkWhere.push(`ne.distance_from_home_km <= ${ctx.addParam(f.distanceFromHomeMax)}`);
    ctx.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
  }
  if (e.stationaryConfidenceMin && f.stationaryConfidenceMin !== undefined) {
    networkWhere.push(`ne.stationary_confidence >= ${ctx.addParam(f.stationaryConfidenceMin)}`);
    ctx.addApplied('threat', 'stationaryConfidenceMin', f.stationaryConfidenceMin);
  }
  if (e.stationaryConfidenceMax && f.stationaryConfidenceMax !== undefined) {
    networkWhere.push(`ne.stationary_confidence <= ${ctx.addParam(f.stationaryConfidenceMax)}`);
    ctx.addApplied('threat', 'stationaryConfidenceMax', f.stationaryConfidenceMax);
  }

  if (e.surveillance && f.surveillance === true) {
    networkWhere.push(
      // eslint-disable-next-line quotes
      `EXISTS (SELECT 1 FROM app.surveillance_detections sd WHERE sd.bssid = ne.bssid AND sd.false_positive = FALSE)`
    );
    ctx.addApplied('threat', 'surveillance', true);
  }

  if (e.shotspotter && f.shotspotter === true) {
    networkWhere.push(
      // eslint-disable-next-line quotes
      `EXISTS (SELECT 1 FROM app.surveillance_detections sd WHERE sd.bssid = ne.bssid AND sd.device_type = 'SHOTSPOTTER_SENSOR' AND sd.false_positive = FALSE)`
    );
    ctx.addApplied('threat', 'shotspotter', true);
  }

  if (e.bwc && f.bwc === true) {
    networkWhere.push(
      // eslint-disable-next-line quotes
      `EXISTS (SELECT 1 FROM app.surveillance_detections sd WHERE sd.bssid = ne.bssid AND sd.device_type IN ('AXON_BODY_CAMERA', 'MOTOROLA_BWC', 'AXON_SIGNAL_PERIPHERAL', 'DEI_BWC', 'BT_IMAGING_DEVICE') AND sd.false_positive = FALSE)`
    );
    ctx.addApplied('threat', 'bwc', true);
  }

  if (e.dashcam && f.dashcam === true) {
    networkWhere.push(
      // eslint-disable-next-line quotes
      `EXISTS (SELECT 1 FROM app.surveillance_detections sd WHERE sd.bssid = ne.bssid AND sd.device_type = 'DASHCAM' AND sd.false_positive = FALSE)`
    );
    ctx.addApplied('threat', 'dashcam', true);
  }

  if (e.residential_cam && f.residential_cam === true) {
    networkWhere.push(
      // eslint-disable-next-line quotes
      `EXISTS (SELECT 1 FROM app.surveillance_detections sd WHERE sd.bssid = ne.bssid AND sd.device_type = 'RESIDENTIAL_CAMERA' AND sd.false_positive = FALSE)`
    );
    ctx.addApplied('threat', 'residential_cam', true);
  }

  if (e.flock && f.flock === true) {
    networkWhere.push(
      // eslint-disable-next-line quotes
      `EXISTS (SELECT 1 FROM app.surveillance_detections sd WHERE sd.bssid = ne.bssid AND sd.device_type IN ('FLOCK_SAFETY_CAMERA', 'RAVEN_GUNSHOT_DETECTOR', 'FS_EXT_BATTERY') AND sd.false_positive = FALSE)`
    );
    ctx.addApplied('threat', 'flock', true);
  }

  if (e.deviceClass && Array.isArray(f.deviceClass) && f.deviceClass.length > 0) {
    const valuesParam = ctx.addParam(f.deviceClass);
    networkWhere.push(SqlFragmentLibrary.deviceClassFilterPredicate('ne', valuesParam));
    ctx.addApplied('threat', 'deviceClass', f.deviceClass);
  }

  if (e.timeframe && f.timeframe) {
    if (f.timeframe.type === 'absolute') {
      if (f.timeframe.startTimestamp) {
        networkWhere.push(
          `ne.last_seen >= ${ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`
        );
      }
      if (f.timeframe.endTimestamp) {
        networkWhere.push(`ne.last_seen <= ${ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`);
      }
    } else {
      const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
      if (window) {
        networkWhere.push(`ne.last_seen >= NOW() - ${ctx.addParam(window)}::interval`);
      }
    }
    ctx.addApplied('temporal', 'timeframe', f.timeframe);
  }

  return networkWhere;
}
