import { RELATIVE_WINDOWS } from '../constants';
import type { FilterBuildContext } from '../FilterBuildContext';
import { mapThreatCategoriesToDbLevels } from '../threatCategoryLevels';
import type { FastPathPredicateOptions } from './networkFastPathPredicateTypes';

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
    if (options.addUnsupportedWigleIgnored) {
      ctx.addIgnored('quality', 'wigle_v3_observation_count_min', 'unsupported_page');
    } else {
      where.push(
        `ne.wigle_v3_observation_count >= ${ctx.addParam(f.wigle_v3_observation_count_min)}`
      );
      ctx.addApplied('quality', 'wigle_v3_observation_count_min', f.wigle_v3_observation_count_min);
    }
  }

  if (e.wigle_v3_observation_count_max && f.wigle_v3_observation_count_max !== undefined) {
    if (options.addUnsupportedWigleIgnored) {
      ctx.addIgnored('quality', 'wigle_v3_observation_count_max', 'unsupported_page');
    } else {
      where.push(
        `ne.wigle_v3_observation_count <= ${ctx.addParam(f.wigle_v3_observation_count_max)}`
      );
      ctx.addApplied('quality', 'wigle_v3_observation_count_max', f.wigle_v3_observation_count_max);
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
    let timeExpr = 'ne.last_seen'; // Default for fast path

    if (scope === 'first_seen') {
      timeExpr = 'ne.first_seen';
    } else if (scope === 'last_seen') {
      timeExpr = 'ne.last_seen';
    } else if (scope === 'network_lifetime') {
      // For network_lifetime, we check if ANY part of the lifetime overlaps with the window
      if (f.timeframe.type === 'absolute') {
        if (f.timeframe.startTimestamp) {
          where.push(`ne.last_seen >= ${ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`);
        }
        if (f.timeframe.endTimestamp) {
          where.push(`ne.first_seen <= ${ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`);
        }
      } else {
        const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
        if (window) {
          where.push(`ne.last_seen >= NOW() - ${ctx.addParam(window)}::interval`);
        }
      }
      ctx.addApplied('temporal', 'timeframe', f.timeframe);
      ctx.addApplied('temporal', 'temporalScope', scope);
      return where;
    } else if (scope === 'threat_window' && options.addUnsupportedWigleIgnored) {
      ctx.addWarning('Threat window scope mapped to observation_time on fast path.');
    }

    if (f.timeframe.type === 'absolute') {
      if (f.timeframe.startTimestamp) {
        where.push(`${timeExpr} >= ${ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`);
      }
      if (f.timeframe.endTimestamp) {
        where.push(`${timeExpr} <= ${ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`);
      }
    } else {
      const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
      if (window) {
        where.push(`${timeExpr} >= NOW() - ${ctx.addParam(window)}::interval`);
      }
    }
    ctx.addApplied('temporal', 'timeframe', f.timeframe);
    ctx.addApplied('temporal', 'temporalScope', scope);
  }

  // --- Geocoding Filters ---

  if (e.geocodedAddress && f.geocodedAddress) {
    where.push(`ne.geocoded_address ILIKE ${ctx.addParam(`%${f.geocodedAddress}%`)}`);
    ctx.addApplied('geocoding', 'geocodedAddress', f.geocodedAddress);
  }

  if (e.geocodedCity && f.geocodedCity) {
    where.push(`ne.geocoded_city ILIKE ${ctx.addParam(`${f.geocodedCity}%`)}`);
    ctx.addApplied('geocoding', 'geocodedCity', f.geocodedCity);
  }

  if (e.geocodedState && f.geocodedState) {
    where.push(`UPPER(ne.geocoded_state) = UPPER(${ctx.addParam(f.geocodedState)})`);
    ctx.addApplied('geocoding', 'geocodedState', f.geocodedState);
  }

  if (e.geocodedPostalCode && f.geocodedPostalCode) {
    where.push(`ne.geocoded_postal_code ILIKE ${ctx.addParam(`${f.geocodedPostalCode}%`)}`);
    ctx.addApplied('geocoding', 'geocodedPostalCode', f.geocodedPostalCode);
  }

  if (e.geocodedCountry && f.geocodedCountry) {
    where.push(`UPPER(ne.geocoded_country) = UPPER(${ctx.addParam(f.geocodedCountry)})`);
    ctx.addApplied('geocoding', 'geocodedCountry', f.geocodedCountry);
  }

  if (e.geocodedPoiName && f.geocodedPoiName) {
    where.push(`ne.geocoded_poi_name ILIKE ${ctx.addParam(`%${f.geocodedPoiName}%`)}`);
    ctx.addApplied('geocoding', 'geocodedPoiName', f.geocodedPoiName);
  }

  if (e.geocodedPoiCategory && f.geocodedPoiCategory) {
    where.push(`ne.geocoded_poi_category ILIKE ${ctx.addParam(`%${f.geocodedPoiCategory}%`)}`);
    ctx.addApplied('geocoding', 'geocodedPoiCategory', f.geocodedPoiCategory);
  }

  if (e.geocodedFeatureType && f.geocodedFeatureType) {
    where.push(`ne.geocoded_feature_type ILIKE ${ctx.addParam(`%${f.geocodedFeatureType}%`)}`);
    ctx.addApplied('geocoding', 'geocodedFeatureType', f.geocodedFeatureType);
  }

  if (e.geocodedProvider && f.geocodedProvider) {
    where.push(`ne.geocoded_provider ILIKE ${ctx.addParam(`%${f.geocodedProvider}%`)}`);
    ctx.addApplied('geocoding', 'geocodedProvider', f.geocodedProvider);
  }

  if (e.geocodedConfidenceMin && f.geocodedConfidenceMin !== undefined) {
    where.push(`ne.geocoded_confidence >= ${ctx.addParam(f.geocodedConfidenceMin)}`);
    ctx.addApplied('geocoding', 'geocodedConfidenceMin', f.geocodedConfidenceMin);
  }

  if (e.geocodedConfidenceMax && f.geocodedConfidenceMax !== undefined) {
    where.push(`ne.geocoded_confidence <= ${ctx.addParam(f.geocodedConfidenceMax)}`);
    ctx.addApplied('geocoding', 'geocodedConfidenceMax', f.geocodedConfidenceMax);
  }

  // --- Observation & Activity Counts ---

  if (e.uniqueDaysMin && f.uniqueDaysMin !== undefined) {
    where.push(`ne.unique_days >= ${ctx.addParam(f.uniqueDaysMin)}`);
    ctx.addApplied('quality', 'uniqueDaysMin', f.uniqueDaysMin);
  }
  if (e.uniqueDaysMax && f.uniqueDaysMax !== undefined) {
    where.push(`ne.unique_days <= ${ctx.addParam(f.uniqueDaysMax)}`);
    ctx.addApplied('quality', 'uniqueDaysMax', f.uniqueDaysMax);
  }

  if (e.uniqueLocationsMin && f.uniqueLocationsMin !== undefined) {
    where.push(`ne.unique_locations >= ${ctx.addParam(f.uniqueLocationsMin)}`);
    ctx.addApplied('quality', 'uniqueLocationsMin', f.uniqueLocationsMin);
  }
  if (e.uniqueLocationsMax && f.uniqueLocationsMax !== undefined) {
    where.push(`ne.unique_locations <= ${ctx.addParam(f.uniqueLocationsMax)}`);
    ctx.addApplied('quality', 'uniqueLocationsMax', f.uniqueLocationsMax);
  }

  // --- Extended Threat & ML Score Filters ---

  if (e.ruleBasedScoreMin && f.ruleBasedScoreMin !== undefined) {
    where.push(`ne.rule_based_score >= ${ctx.addParam(f.ruleBasedScoreMin)}`);
    ctx.addApplied('threat', 'ruleBasedScoreMin', f.ruleBasedScoreMin);
  }
  if (e.ruleBasedScoreMax && f.ruleBasedScoreMax !== undefined) {
    where.push(`ne.rule_based_score <= ${ctx.addParam(f.ruleBasedScoreMax)}`);
    ctx.addApplied('threat', 'ruleBasedScoreMax', f.ruleBasedScoreMax);
  }

  if (e.mlThreatScoreMin && f.mlThreatScoreMin !== undefined) {
    where.push(`ne.ml_threat_score >= ${ctx.addParam(f.mlThreatScoreMin)}`);
    ctx.addApplied('threat', 'mlThreatScoreMin', f.mlThreatScoreMin);
  }
  if (e.mlThreatScoreMax && f.mlThreatScoreMax !== undefined) {
    where.push(`ne.ml_threat_score <= ${ctx.addParam(f.mlThreatScoreMax)}`);
    ctx.addApplied('threat', 'mlThreatScoreMax', f.mlThreatScoreMax);
  }

  if (e.mlWeightMin && f.mlWeightMin !== undefined) {
    where.push(`ne.ml_weight >= ${ctx.addParam(f.mlWeightMin)}`);
    ctx.addApplied('threat', 'mlWeightMin', f.mlWeightMin);
  }
  if (e.mlWeightMax && f.mlWeightMax !== undefined) {
    where.push(`ne.ml_weight <= ${ctx.addParam(f.mlWeightMax)}`);
    ctx.addApplied('threat', 'mlWeightMax', f.mlWeightMax);
  }

  if (e.mlBoostMin && f.mlBoostMin !== undefined) {
    where.push(`ne.ml_boost >= ${ctx.addParam(f.mlBoostMin)}`);
    ctx.addApplied('threat', 'mlBoostMin', f.mlBoostMin);
  }
  if (e.mlBoostMax && f.mlBoostMax !== undefined) {
    where.push(`ne.ml_boost <= ${ctx.addParam(f.mlBoostMax)}`);
    ctx.addApplied('threat', 'mlBoostMax', f.mlBoostMax);
  }

  if (e.modelVersion && Array.isArray(f.modelVersion) && f.modelVersion.length > 0) {
    where.push(`ne.model_version = ANY(${ctx.addParam(f.modelVersion)})`);
    ctx.addApplied('threat', 'modelVersion', f.modelVersion);
  }

  // --- Extended Spatial & Metadata ---

  if (e.maxDistanceMetersMin && f.maxDistanceMetersMin !== undefined) {
    where.push(`ne.max_distance_meters >= ${ctx.addParam(f.maxDistanceMetersMin)}`);
    ctx.addApplied('spatial', 'maxDistanceMetersMin', f.maxDistanceMetersMin);
  }
  if (e.maxDistanceMetersMax && f.maxDistanceMetersMax !== undefined) {
    where.push(`ne.max_distance_meters <= ${ctx.addParam(f.maxDistanceMetersMax)}`);
    ctx.addApplied('spatial', 'maxDistanceMetersMax', f.maxDistanceMetersMax);
  }

  if (e.wigleV3LastImportBefore && f.wigleV3LastImportBefore) {
    if (options.addUnsupportedWigleIgnored) {
      ctx.addIgnored('quality', 'wigleV3LastImportBefore', 'unsupported_page');
    } else {
      where.push(
        `ne.wigle_v3_last_import_at <= ${ctx.addParam(f.wigleV3LastImportBefore)}::timestamptz`
      );
      ctx.addApplied('quality', 'wigleV3LastImportBefore', f.wigleV3LastImportBefore);
    }
  }
  if (e.wigleV3LastImportAfter && f.wigleV3LastImportAfter) {
    if (options.addUnsupportedWigleIgnored) {
      ctx.addIgnored('quality', 'wigleV3LastImportAfter', 'unsupported_page');
    } else {
      where.push(
        `ne.wigle_v3_last_import_at >= ${ctx.addParam(f.wigleV3LastImportAfter)}::timestamptz`
      );
      ctx.addApplied('quality', 'wigleV3LastImportAfter', f.wigleV3LastImportAfter);
    }
  }

  return where;
}
