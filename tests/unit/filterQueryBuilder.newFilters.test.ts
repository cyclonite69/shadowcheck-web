import { UniversalFilterQueryBuilder } from '../../server/src/services/filterQueryBuilder';

describe('UniversalFilterQueryBuilder - New MV Filters', () => {
  describe('Geocoding Filters', () => {
    test('geocodedAddress applies full ILIKE match', () => {
      const result = new UniversalFilterQueryBuilder(
        { geocodedAddress: 'Main St' },
        { geocodedAddress: true }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('ne.geocoded_address ILIKE $1');
      expect(result.params).toContain('%Main St%');
    });

    test('geocodedCity applies prefix ILIKE match', () => {
      const result = new UniversalFilterQueryBuilder(
        { geocodedCity: 'Detroit' },
        { geocodedCity: true }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('ne.geocoded_city ILIKE $1');
      expect(result.params).toContain('Detroit%');
    });

    test('geocodedState applies exact uppercase match', () => {
      const result = new UniversalFilterQueryBuilder(
        { geocodedState: 'mi' },
        { geocodedState: true }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('UPPER(ne.geocoded_state) = UPPER($1)');
      expect(result.params).toContain('mi');
    });

    test('geocodedConfidence range applies min/max bounds', () => {
      const result = new UniversalFilterQueryBuilder(
        { geocodedConfidenceMin: 0.5, geocodedConfidenceMax: 0.9 },
        { geocodedConfidenceMin: true, geocodedConfidenceMax: true }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('ne.geocoded_confidence >= $1');
      expect(result.sql).toContain('ne.geocoded_confidence <= $2');
      expect(result.params[0]).toBe(0.5);
      expect(result.params[1]).toBe(0.9);
    });
  });

  describe('Forensic Activity Filters', () => {
    test('uniqueDays range applies min/max bounds', () => {
      const result = new UniversalFilterQueryBuilder(
        { uniqueDaysMin: 5, uniqueDaysMax: 10 },
        { uniqueDaysMin: true, uniqueDaysMax: true }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('ne.unique_days >= $1');
      expect(result.sql).toContain('ne.unique_days <= $2');
      expect(result.params[0]).toBe(5);
      expect(result.params[1]).toBe(10);
    });

    test('uniqueLocations range applies min/max bounds', () => {
      const result = new UniversalFilterQueryBuilder(
        { uniqueLocationsMin: 2, uniqueLocationsMax: 20 },
        { uniqueLocationsMin: true, uniqueLocationsMax: true }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('ne.unique_locations >= $1');
      expect(result.sql).toContain('ne.unique_locations <= $2');
      expect(result.params[0]).toBe(2);
      expect(result.params[1]).toBe(20);
    });

    test('maxDistanceMeters range applies min/max bounds', () => {
      const result = new UniversalFilterQueryBuilder(
        { maxDistanceMetersMin: 100, maxDistanceMetersMax: 5000 },
        { maxDistanceMetersMin: true, maxDistanceMetersMax: true }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('ne.max_distance_meters >= $1');
      expect(result.sql).toContain('ne.max_distance_meters <= $2');
      expect(result.params[0]).toBe(100);
      expect(result.params[1]).toBe(5000);
    });
  });

  describe('ML & Scoring Filters', () => {
    test('mlThreatScore range applies min/max bounds', () => {
      const result = new UniversalFilterQueryBuilder(
        { mlThreatScoreMin: 70, mlThreatScoreMax: 95 },
        { mlThreatScoreMin: true, mlThreatScoreMax: true }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('ne.ml_threat_score >= $1');
      expect(result.sql).toContain('ne.ml_threat_score <= $2');
      expect(result.params[0]).toBe(70);
      expect(result.params[1]).toBe(95);
    });

    test('modelVersion applies ANY array match', () => {
      const result = new UniversalFilterQueryBuilder(
        { modelVersion: ['1.0.0', 'legacy'] },
        { modelVersion: true }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('ne.model_version = ANY($1)');
      expect(result.params[0]).toEqual(['1.0.0', 'legacy']);
    });
  });

  describe('WiGLE Persistence Filters', () => {
    test('wigleV3LastImportBefore/After apply timestamptz casts', () => {
      const result = new UniversalFilterQueryBuilder(
        { wigleV3LastImportAfter: '2024-01-01', wigleV3LastImportBefore: '2024-12-31' },
        { wigleV3LastImportAfter: true, wigleV3LastImportBefore: true }
      ).buildNetworkListQuery();
      // Fast path applies "Before" then "After" based on insertion order in buildFastPathSupplementalPredicates
      expect(result.sql).toContain('ne.wigle_v3_last_import_at <= $1::timestamptz');
      expect(result.sql).toContain('ne.wigle_v3_last_import_at >= $2::timestamptz');
      expect(result.params[0]).toBe('2024-12-31');
      expect(result.params[1]).toBe('2024-01-01');
    });

    test('wigle_v3_observation_count_max applies max bound on wigle page', () => {
      const result = new UniversalFilterQueryBuilder(
        { wigle_v3_observation_count_max: 50 },
        { wigle_v3_observation_count_max: true },
        { pageType: 'wigle' }
      ).buildNetworkListQuery();
      expect(result.sql).toContain('ne.wigle_v3_observation_count <= $1');
      expect(result.params).toContain(50);
    });
  });
});
