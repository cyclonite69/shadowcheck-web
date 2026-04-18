export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { buildFastPathSupplementalPredicates } from '../../server/src/services/filterQueryBuilder/modules/networkFastPathSupplementalPredicates';
import { buildObservationSecurityTemporalPredicates } from '../../server/src/services/filterQueryBuilder/modules/observationSecurityTemporalPredicates';
import { SqlFragmentLibrary } from '../../server/src/services/filterQueryBuilder/SqlFragmentLibrary';

describe('networkFastPathSupplementalPredicates Coverage Expansion', () => {
  test('covers all basic quality and spatial filters', () => {
    const ctx = new FilterBuildContext(
      {
        observationCountMax: 10,
        wigle_v3_observation_count_min: 5,
        wigle_v3_observation_count_max: 20,
        gpsAccuracyMax: 50,
        excludeInvalidCoords: true,
        distanceFromHomeMin: 1,
        distanceFromHomeMax: 10,
        stationaryConfidenceMin: 0.5,
        stationaryConfidenceMax: 0.9,
      },
      {
        observationCountMax: true,
        wigle_v3_observation_count_min: true,
        wigle_v3_observation_count_max: true,
        gpsAccuracyMax: true,
        excludeInvalidCoords: true,
        distanceFromHomeMin: true,
        distanceFromHomeMax: true,
        stationaryConfidenceMin: true,
        stationaryConfidenceMax: true,
      }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });

    expect(where).toContain('ne.observations <= $1');
    expect(where).toContain('ne.wigle_v3_observation_count >= $2');
    expect(where).toContain('ne.wigle_v3_observation_count <= $3');
    expect(where).toContain(
      'ne.accuracy_meters IS NOT NULL AND ne.accuracy_meters > 0 AND ne.accuracy_meters <= $4'
    );
    expect(where).toContain('ne.lat IS NOT NULL');
    expect(where).toContain('ne.distance_from_home_km >= $5');
    expect(where).toContain('ne.distance_from_home_km <= $6');
    expect(where).toContain('ne.stationary_confidence >= $7');
    expect(where).toContain('ne.stationary_confidence <= $8');
  });

  test('covers threat filters and categories', () => {
    const ctx = new FilterBuildContext(
      {
        threatScoreMax: 80,
        threatCategories: ['high', 'critical'],
      },
      {
        threatScoreMax: true,
        threatCategories: true,
      }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });
    expect(where.some((w) => w.includes('ne.threat_score <= $1'))).toBe(true);
    expect(where.some((w) => w.includes('ne.threat_level = ANY'))).toBe(true);
  });

  test('covers timeframe absolute and scopes', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: {
          type: 'absolute',
          startTimestamp: '2023-01-01T00:00:00Z',
          endTimestamp: '2023-12-31T23:59:59Z',
        },
        temporalScope: 'first_seen',
      },
      { timeframe: true, temporalScope: true }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });
    expect(where).toContain('ne.first_seen >= $1::timestamptz');
    expect(where).toContain('ne.first_seen <= $2::timestamptz');
  });

  test('covers timeframe last_seen', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: { type: 'relative', relativeWindow: '30d' },
        temporalScope: 'last_seen',
      },
      { timeframe: true, temporalScope: true }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });
    expect(where).toContain('ne.last_seen >= NOW() - $1::interval');
  });

  test('covers network_lifetime absolute scope', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: {
          type: 'absolute',
          startTimestamp: '2023-01-01T00:00:00Z',
          endTimestamp: '2023-12-31T23:59:59Z',
        },
        temporalScope: 'network_lifetime',
      },
      { timeframe: true, temporalScope: true }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });
    expect(where).toContain('ne.last_seen >= $1::timestamptz');
    expect(where).toContain('ne.first_seen <= $2::timestamptz');
  });

  test('covers network_lifetime relative scope', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: { type: 'relative', relativeWindow: '7d' },
        temporalScope: 'network_lifetime',
      },
      { timeframe: true, temporalScope: true }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });
    expect(where).toContain('ne.last_seen >= NOW() - $1::interval');
  });

  test('covers observationCountMin and WiGLE min count on fast path', () => {
    const ctx = new FilterBuildContext(
      {
        observationCountMin: 5,
        wigle_v3_observation_count_min: 10,
      },
      {
        observationCountMin: true,
        wigle_v3_observation_count_min: true,
      }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });
    expect(where).toContain('ne.observations >= $1');
    expect(where).toContain('ne.wigle_v3_observation_count >= $2');
  });

  test('covers threat_window warning', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: { type: 'relative', relativeWindow: '30d' },
        temporalScope: 'threat_window',
      },
      { timeframe: true, temporalScope: true }
    );

    buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: true });
    expect(ctx.state.warnings()).toContain(
      'Threat window scope mapped to observation_time on fast path.'
    );
  });

  test('covers geocoding filters', () => {
    const ctx = new FilterBuildContext(
      {
        geocodedAddress: '123 Main St',
        geocodedCity: 'Springfield',
        geocodedState: 'IL',
        geocodedPostalCode: '62704',
        geocodedCountry: 'USA',
        geocodedPoiName: 'Starbucks',
        geocodedPoiCategory: 'Cafe',
        geocodedFeatureType: 'poi',
        geocodedProvider: 'mapbox',
        geocodedConfidenceMin: 0.8,
        geocodedConfidenceMax: 1.0,
      },
      {
        geocodedAddress: true,
        geocodedCity: true,
        geocodedState: true,
        geocodedPostalCode: true,
        geocodedCountry: true,
        geocodedPoiName: true,
        geocodedPoiCategory: true,
        geocodedFeatureType: true,
        geocodedProvider: true,
        geocodedConfidenceMin: true,
        geocodedConfidenceMax: true,
      }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });
    expect(where).toContain('ne.geocoded_address ILIKE $1');
    expect(where).toContain('ne.geocoded_city ILIKE $2');
    expect(where).toContain('UPPER(ne.geocoded_state) = UPPER($3)');
    expect(where).toContain('ne.geocoded_postal_code ILIKE $4');
    expect(where).toContain('UPPER(ne.geocoded_country) = UPPER($5)');
    expect(where).toContain('ne.geocoded_poi_name ILIKE $6');
    expect(where).toContain('ne.geocoded_poi_category ILIKE $7');
    expect(where).toContain('ne.geocoded_feature_type ILIKE $8');
    expect(where).toContain('ne.geocoded_provider ILIKE $9');
    expect(where).toContain('ne.geocoded_confidence >= $10');
    expect(where).toContain('ne.geocoded_confidence <= $11');
  });

  test('covers unique counts and ML scores', () => {
    const ctx = new FilterBuildContext(
      {
        uniqueDaysMin: 5,
        uniqueDaysMax: 10,
        uniqueLocationsMin: 2,
        uniqueLocationsMax: 5,
        ruleBasedScoreMin: 10,
        ruleBasedScoreMax: 50,
        mlThreatScoreMin: 20,
        mlThreatScoreMax: 60,
        mlWeightMin: 0.1,
        mlWeightMax: 0.5,
        mlBoostMin: 1.1,
        mlBoostMax: 2.0,
        modelVersion: ['v1', 'v2'],
      },
      {
        uniqueDaysMin: true,
        uniqueDaysMax: true,
        uniqueLocationsMin: true,
        uniqueLocationsMax: true,
        ruleBasedScoreMin: true,
        ruleBasedScoreMax: true,
        mlThreatScoreMin: true,
        mlThreatScoreMax: true,
        mlWeightMin: true,
        mlWeightMax: true,
        mlBoostMin: true,
        mlBoostMax: true,
        modelVersion: true,
      }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });
    expect(where).toContain('ne.unique_days >= $1');
    expect(where).toContain('ne.unique_days <= $2');
    expect(where).toContain('ne.unique_locations >= $3');
    expect(where).toContain('ne.unique_locations <= $4');
    expect(where).toContain('ne.rule_based_score >= $5');
    expect(where).toContain('ne.rule_based_score <= $6');
    expect(where).toContain('ne.ml_threat_score >= $7');
    expect(where).toContain('ne.ml_threat_score <= $8');
    expect(where).toContain('ne.ml_weight >= $9');
    expect(where).toContain('ne.ml_weight <= $10');
    expect(where).toContain('ne.ml_boost >= $11');
    expect(where).toContain('ne.ml_boost <= $12');
    expect(where).toContain('ne.model_version = ANY($13)');
  });

  test('covers extended spatial and WiGLE import filters', () => {
    const ctx = new FilterBuildContext(
      {
        maxDistanceMetersMin: 100,
        maxDistanceMetersMax: 500,
        wigleV3LastImportBefore: '2023-01-01T00:00:00Z',
        wigleV3LastImportAfter: '2022-01-01T00:00:00Z',
      },
      {
        maxDistanceMetersMin: true,
        maxDistanceMetersMax: true,
        wigleV3LastImportBefore: true,
        wigleV3LastImportAfter: true,
      }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: false });
    expect(where).toContain('ne.max_distance_meters >= $1');
    expect(where).toContain('ne.max_distance_meters <= $2');
    expect(where).toContain('ne.wigle_v3_last_import_at <= $3::timestamptz');
    expect(where).toContain('ne.wigle_v3_last_import_at >= $4::timestamptz');
  });

  test('covers WiGLE ignored branches', () => {
    const ctx = new FilterBuildContext(
      {
        wigle_v3_observation_count_max: 20,
        wigleV3LastImportBefore: '2023-01-01T00:00:00Z',
        wigleV3LastImportAfter: '2022-01-01T00:00:00Z',
      },
      {
        wigle_v3_observation_count_max: true,
        wigleV3LastImportBefore: true,
        wigleV3LastImportAfter: true,
      }
    );

    const where = buildFastPathSupplementalPredicates(ctx, { addUnsupportedWigleIgnored: true });
    expect(where).toEqual([]);
    expect(ctx.state.ignoredFilters()).toHaveLength(3);
  });
});

describe('observationSecurityTemporalPredicates Coverage Expansion', () => {
  test('covers all encryption types and normalized WEP', () => {
    const allTypes = [
      'OPEN',
      'wep_128',
      'WPA',
      'WPA2-P',
      'WPA2-E',
      'WPA2',
      'WPA3-P',
      'WPA3-E',
      'WPA3',
      'OWE',
      'WPS',
      'UNKNOWN',
      'MIXED',
    ];
    const ctx = new FilterBuildContext({ encryptionTypes: allTypes }, { encryptionTypes: true });

    const where = buildObservationSecurityTemporalPredicates(ctx);
    expect(where).toHaveLength(1);
    const clause = where[0];
    expect(clause).toContain("= 'OPEN'");
    expect(clause).toContain("= 'WEP'");
    expect(clause).toContain("= 'WPA'");
    expect(clause).toContain("= 'WPA2-P'");
    expect(clause).toContain("= 'WPA2-E'");
    expect(clause).toContain("IN ('WPA2', 'WPA2-P', 'WPA2-E')");
    expect(clause).toContain("= 'WPA3-P'");
    expect(clause).toContain("= 'WPA3-E'");
    expect(clause).toContain("IN ('WPA3', 'WPA3-P', 'WPA3-E', 'OWE')");
    expect(clause).toContain("= 'OWE'");
    expect(clause).toContain("= 'WPS'");
    expect(clause).toContain("= 'UNKNOWN'");
    expect(clause).toContain(
      "IN ('WPA', 'WPA2', 'WPA2-P', 'WPA2-E', 'WPA3', 'WPA3-P', 'WPA3-E', 'OWE')"
    );
  });

  test('covers security flags and relative timeframe with default window', () => {
    const ctx = new FilterBuildContext(
      {
        securityFlags: ['insecure', 'deprecated', 'enterprise', 'personal', 'unknown'],
        timeframe: { type: 'relative' } as any,
      },
      { securityFlags: true, timeframe: true }
    );

    const where = buildObservationSecurityTemporalPredicates(ctx);
    expect(where.some((w) => w.includes("IN ('OPEN', 'WEP', 'WPS')"))).toBe(true);
    expect(where.some((w) => w.includes("= 'WEP'"))).toBe(true);
    expect(where.some((w) => w.includes("IN ('WPA2-E', 'WPA3-E')"))).toBe(true);
    expect(where.some((w) => w.includes("IN ('WPA', 'WPA2', 'WPA2-P', 'WPA3', 'WPA3-P')"))).toBe(
      true
    );
    expect(where.some((w) => w.includes("= 'UNKNOWN'"))).toBe(true);
    expect(where).toContain('o.time >= NOW() - $1::interval');
    expect(ctx.getParams()).toEqual(['30 days']);
  });

  test('covers timeframe absolute start only', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: { type: 'absolute', startTimestamp: '2023-01-01T00:00:00Z' },
      },
      { timeframe: true }
    );

    const where = buildObservationSecurityTemporalPredicates(ctx);
    expect(where).toContain('o.time >= $1::timestamptz');
  });

  test('covers timeframe absolute end only', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: { type: 'absolute', endTimestamp: '2023-12-31T23:59:59Z' },
      },
      { timeframe: true }
    );

    const where = buildObservationSecurityTemporalPredicates(ctx);
    expect(where).toContain('o.time <= $1::timestamptz');
  });

  test('covers timeframe first_seen/last_seen for observations', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: { type: 'absolute', startTimestamp: '2023-01-01T00:00:00Z' },
        temporalScope: 'first_seen',
      },
      { timeframe: true, temporalScope: true }
    );
    const where1 = buildObservationSecurityTemporalPredicates(ctx);
    expect(where1).toContain('ne.first_seen >= $1::timestamptz');

    const ctx2 = new FilterBuildContext(
      {
        timeframe: { type: 'absolute', endTimestamp: '2023-12-31T23:59:59Z' },
        temporalScope: 'last_seen',
      },
      { timeframe: true, temporalScope: true }
    );
    const where2 = buildObservationSecurityTemporalPredicates(ctx2);
    expect(where2).toContain('ne.last_seen <= $1::timestamptz');
  });

  test('covers network_lifetime for observations', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: {
          type: 'absolute',
          startTimestamp: '2023-01-01T00:00:00Z',
          endTimestamp: '2023-12-31T23:59:59Z',
        },
        temporalScope: 'network_lifetime',
      },
      { timeframe: true, temporalScope: true }
    );
    const where = buildObservationSecurityTemporalPredicates(ctx);
    expect(where).toContain('ne.last_seen >= $1::timestamptz');
    expect(where).toContain('ne.first_seen <= $2::timestamptz');

    const ctx2 = new FilterBuildContext(
      {
        timeframe: { type: 'relative', relativeWindow: '7d' },
        temporalScope: 'network_lifetime',
      },
      { timeframe: true, temporalScope: true }
    );
    const where2 = buildObservationSecurityTemporalPredicates(ctx2);
    expect(where2).toContain('ne.last_seen >= NOW() - $1::interval');
  });

  test('covers individual security flags to improve branch coverage', () => {
    const ctx = new FilterBuildContext({ securityFlags: ['insecure'] }, { securityFlags: true });
    expect(buildObservationSecurityTemporalPredicates(ctx)[0]).toContain(
      "IN ('OPEN', 'WEP', 'WPS')"
    );

    const ctx2 = new FilterBuildContext({ securityFlags: ['deprecated'] }, { securityFlags: true });
    expect(buildObservationSecurityTemporalPredicates(ctx2)[0]).toContain("= 'WEP'");

    const ctx3 = new FilterBuildContext({ securityFlags: ['enterprise'] }, { securityFlags: true });
    expect(buildObservationSecurityTemporalPredicates(ctx3)[0]).toContain(
      "IN ('WPA2-E', 'WPA3-E')"
    );

    const ctx4 = new FilterBuildContext({ securityFlags: ['personal'] }, { securityFlags: true });
    expect(buildObservationSecurityTemporalPredicates(ctx4)[0]).toContain(
      "IN ('WPA', 'WPA2', 'WPA2-P', 'WPA3', 'WPA3-P')"
    );

    const ctx5 = new FilterBuildContext({ securityFlags: ['unknown'] }, { securityFlags: true });
    expect(buildObservationSecurityTemporalPredicates(ctx5)[0]).toContain("= 'UNKNOWN'");
  });

  test('covers default timeframe scope and falsy window', () => {
    const ctx = new FilterBuildContext(
      { timeframe: { type: 'relative', relativeWindow: 'all' } },
      { timeframe: true }
    );
    const where = buildObservationSecurityTemporalPredicates(ctx);
    expect(where).toHaveLength(0); // 'all' returns null window, so no predicate added
  });

  test('covers threat_window warning for observations', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: { type: 'relative', relativeWindow: '30d' },
        temporalScope: 'threat_window',
      },
      { timeframe: true, temporalScope: true }
    );
    buildObservationSecurityTemporalPredicates(ctx);
    expect(ctx.state.warnings()).toContain(
      'Threat window scope mapped to observation_time on slow path.'
    );
  });
});

describe('SqlFragmentLibrary Coverage Expansion v2', () => {
  test('covers all methods with default and custom aliases', () => {
    // Default aliases
    expect(SqlFragmentLibrary.selectManufacturerFields()).toContain('rm');
    expect(SqlFragmentLibrary.selectGeocodedFields()).toContain('ne');
    expect(SqlFragmentLibrary.selectThreatTagFields()).toContain('nt');
    expect(SqlFragmentLibrary.joinNetworkTagsLateral('ne')).toContain('nt');
    expect(SqlFragmentLibrary.joinNetworkLocations('ne', 'centroid')).toContain('nl');
    expect(SqlFragmentLibrary.selectLocationCoords('ne', 'centroid')).toContain('nl');
    expect(SqlFragmentLibrary.joinRadioManufacturers('ne')).toContain('rm');
    expect(SqlFragmentLibrary.joinExplorerMv('o')).toContain('ne');
    expect(SqlFragmentLibrary.selectObservationCoordinateFields()).toContain('o');

    // Custom aliases
    expect(SqlFragmentLibrary.selectManufacturerFields('custom_rm')).toContain('custom_rm');
    expect(SqlFragmentLibrary.selectGeocodedFields('custom_ne')).toContain('custom_ne');
    expect(SqlFragmentLibrary.selectThreatTagFields('custom_nt')).toContain('custom_nt');
    expect(SqlFragmentLibrary.joinNetworkTagsLateral('custom_ne', 'custom_nt')).toContain(
      'custom_nt'
    );
    expect(SqlFragmentLibrary.joinNetworkLocations('custom_ne', 'centroid', 'custom_nl')).toContain(
      'custom_nl'
    );
    expect(SqlFragmentLibrary.selectLocationCoords('custom_ne', 'centroid', 'custom_nl')).toContain(
      'custom_nl'
    );
    expect(
      SqlFragmentLibrary.selectLocationCoords('custom_ne', 'weighted_centroid', 'custom_nl')
    ).toContain('custom_nl');
    expect(SqlFragmentLibrary.joinRadioManufacturers('custom_l', 'custom_rm')).toContain(
      'custom_rm'
    );
    expect(SqlFragmentLibrary.joinExplorerMv('custom_s', 'custom_mv')).toContain('custom_mv');
    expect(SqlFragmentLibrary.selectObservationCoordinateFields('custom_o')).toContain('custom_o');
  });
});
