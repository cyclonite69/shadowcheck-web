import { RELATIVE_WINDOWS } from '../constants';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { FastPathPredicateOptions } from './networkFastPathPredicateTypes';

const THREAT_LEVEL_MAP: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  none: 'NONE',
};

function mapThreatCategoriesToDbLevels(threatCategories: string[]): string[] {
  return Array.from(
    new Set(
      threatCategories
        .flatMap((cat) => {
          const mapped = THREAT_LEVEL_MAP[cat] || cat.toUpperCase();
          if (mapped === 'MEDIUM' || mapped === 'MED') {
            return ['MEDIUM', 'MED'];
          }
          return [mapped];
        })
        .filter(Boolean)
    )
  );
}

export function buildFastPathSupplementalPredicates(
  ctx: FilterBuildContext,
  options: Pick<FastPathPredicateOptions, 'addUnsupportedWigleIgnored'>
): string[] {
  const f = ctx.filters;
  const e = ctx.enabled;
  const where: string[] = [];

  if (e.observationCountMin && f.observationCountMin !== undefined) {
    where.push(`ne.observations >= ${ctx.addParam(f.observationCountMin)}`);
    ctx.addApplied('quality', 'observationCountMin', f.observationCountMin);
  }
  if (e.observationCountMax && f.observationCountMax !== undefined) {
    where.push(`ne.observations <= ${ctx.addParam(f.observationCountMax)}`);
    ctx.addApplied('quality', 'observationCountMax', f.observationCountMax);
  }

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
