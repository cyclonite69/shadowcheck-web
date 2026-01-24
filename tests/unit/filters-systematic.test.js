/**
 * Systematic Filter Testing - Phase 1: Core Filters
 * Testing untested filters one by one
 */

const {
  UniversalFilterQueryBuilder,
  validateFilterPayload,
} = require('../../src/services/filterQueryBuilder');

describe('Systematic Filter Testing', () => {
  // ============================================================================
  // PHASE 1: IDENTITY FILTERS
  // ============================================================================

  describe('bssid filter', () => {
    test('full MAC address', () => {
      const filters = { bssid: 'AA:BB:CC:DD:EE:FF' };
      const enabled = { bssid: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where).toContain('o.bssid = $1');
      expect(builder.params).toContain('AA:BB:CC:DD:EE:FF');
    });

    test('partial MAC (prefix)', () => {
      const filters = { bssid: 'AA:BB:CC' };
      const enabled = { bssid: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('LIKE'))).toBe(true);
    });
  });

  describe('manufacturer filter', () => {
    test('by name', () => {
      const filters = { manufacturer: 'Apple' };
      const enabled = { manufacturer: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.joins.some((j) => j.includes('radio_manufacturers'))).toBe(true);
    });

    test('by OUI', () => {
      const filters = { manufacturer: 'AABBCC' };
      const enabled = { manufacturer: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      builder.buildObservationFilters();

      expect(builder.appliedFilters[0].field).toBe('manufacturerOui');
    });
  });

  // ============================================================================
  // PHASE 2: RADIO FILTERS
  // ============================================================================

  describe('radioTypes filter', () => {
    test('WiFi only', () => {
      const filters = { radioTypes: ['W'] };
      const enabled = { radioTypes: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('= ANY'))).toBe(true);
      expect(builder.params).toContainEqual(['W']);
    });
  });

  describe('frequencyBands filter', () => {
    test('2.4GHz band', () => {
      const filters = { frequencyBands: ['2.4GHz'] };
      const enabled = { frequencyBands: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('2412 AND 2484'))).toBe(true);
    });
  });

  describe('channel filters', () => {
    test('channelMin', () => {
      const filters = { channelMin: 1 };
      const enabled = { channelMin: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('>= $'))).toBe(true);
      expect(builder.params).toContain(1);
    });

    test('channelMax', () => {
      const filters = { channelMax: 11 };
      const enabled = { channelMax: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('<= $'))).toBe(true);
      expect(builder.params).toContain(11);
    });
  });

  describe('RSSI filters', () => {
    test('rssiMin validation', () => {
      const { errors } = validateFilterPayload({ rssiMin: -100 }, { rssiMin: true });
      expect(errors).toContain('RSSI minimum below noise floor (-95 dBm).');
    });

    test('rssiMax validation', () => {
      const { errors } = validateFilterPayload({ rssiMax: 10 }, { rssiMax: true });
      expect(errors).toContain('RSSI maximum above 0 dBm.');
    });

    test('rssiMin/Max range validation', () => {
      const { errors } = validateFilterPayload(
        { rssiMin: -30, rssiMax: -70 },
        { rssiMin: true, rssiMax: true }
      );
      expect(errors).toContain('RSSI minimum greater than maximum.');
    });
  });

  // ============================================================================
  // PHASE 3: SECURITY FILTERS
  // ============================================================================

  describe('authMethods filter', () => {
    test('PSK authentication', () => {
      const filters = { authMethods: ['PSK'] };
      const enabled = { authMethods: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      // authMethods uses SECURITY_EXPR with IN clause, not = ANY
      expect(result.where.some((w) => w.includes('IN ('))).toBe(true);
      expect(builder.appliedFilters).toContainEqual({
        type: 'security',
        field: 'authMethods',
        value: ['PSK'],
      });
    });
  });

  describe('insecureFlags filter', () => {
    test('open networks', () => {
      const filters = { insecureFlags: ['open'] };
      const enabled = { insecureFlags: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('OPEN'))).toBe(true);
    });
  });

  describe('securityFlags filter', () => {
    test('enterprise networks', () => {
      const filters = { securityFlags: ['enterprise'] };
      const enabled = { securityFlags: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('WPA2-E'))).toBe(true);
    });
  });

  // ============================================================================
  // PHASE 4: TEMPORAL FILTERS
  // ============================================================================

  describe('temporalScope filter', () => {
    test('observation_time scope', () => {
      const filters = {
        timeframe: { type: 'relative', relativeWindow: '7d' },
        temporalScope: 'observation_time',
      };
      const enabled = { timeframe: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('o.time'))).toBe(true);
    });

    test('network_lifetime scope', () => {
      const filters = {
        timeframe: { type: 'relative', relativeWindow: '30d' },
        temporalScope: 'network_lifetime',
      };
      const enabled = { timeframe: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.joins.some((j) => j.includes('access_points'))).toBe(true);
    });
  });

  // ============================================================================
  // PHASE 5: QUALITY FILTERS - CRITICAL ISSUE
  // ============================================================================

  describe('observationCountMin filter - CRITICAL', () => {
    test('works in network query', () => {
      const filters = { observationCountMin: 10 };
      const enabled = { observationCountMin: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const query = builder.buildNetworkListQuery();

      expect(query.appliedFilters).toContainEqual({
        type: 'quality',
        field: 'observationCountMin',
        value: 10,
      });
    });

    test('SQL generation correct', () => {
      const filters = { observationCountMin: 5 };
      const enabled = { observationCountMin: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const query = builder.buildNetworkListQuery();

      expect(query.sql).toContain('ne.observations >=');
      expect(builder.params).toContain(5);
    });
  });

  describe('observationCountMax filter', () => {
    test('works in network query', () => {
      const filters = { observationCountMax: 100 };
      const enabled = { observationCountMax: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const query = builder.buildNetworkListQuery();

      expect(query.appliedFilters).toContainEqual({
        type: 'quality',
        field: 'observationCountMax',
        value: 100,
      });
    });
  });

  describe('gpsAccuracyMax filter', () => {
    test('valid accuracy', () => {
      const filters = { gpsAccuracyMax: 50 };
      const enabled = { gpsAccuracyMax: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('o.accuracy'))).toBe(true);
    });

    test('validation - too high', () => {
      const { errors } = validateFilterPayload({ gpsAccuracyMax: 2000 }, { gpsAccuracyMax: true });
      expect(errors).toContain('GPS accuracy limit too high (>1000m).');
    });
  });

  describe('excludeInvalidCoords filter', () => {
    test('applies coordinate checks', () => {
      const filters = { excludeInvalidCoords: true };
      const enabled = { excludeInvalidCoords: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where).toContain('o.lat IS NOT NULL');
      expect(result.where).toContain('o.lon IS NOT NULL');
      expect(result.where).toContain('o.lat BETWEEN -90 AND 90');
      expect(result.where).toContain('o.lon BETWEEN -180 AND 180');
    });
  });

  // ============================================================================
  // PHASE 6: SPATIAL FILTERS
  // ============================================================================

  describe('distanceFromHome filters', () => {
    test('distanceFromHomeMin', () => {
      const filters = { distanceFromHomeMin: 1000 };
      const enabled = { distanceFromHomeMin: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(builder.requiresHome).toBe(true);
      expect(result.where.some((w) => w.includes('ST_Distance'))).toBe(true);
    });

    test('distanceFromHomeMax', () => {
      const filters = { distanceFromHomeMax: 5000 };
      const enabled = { distanceFromHomeMax: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(builder.requiresHome).toBe(true);
    });
  });

  describe('boundingBox filter', () => {
    test('valid bounding box', () => {
      const filters = {
        boundingBox: { north: 40.9, south: 40.5, east: -73.7, west: -74.3 },
      };
      const enabled = { boundingBox: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('o.lat <='))).toBe(true);
      expect(result.where.some((w) => w.includes('o.lat >='))).toBe(true);
      expect(result.where.some((w) => w.includes('o.lon <='))).toBe(true);
      expect(result.where.some((w) => w.includes('o.lon >='))).toBe(true);
    });
  });

  describe('radiusFilter filter', () => {
    test('valid radius', () => {
      const filters = {
        radiusFilter: { latitude: 40.7589, longitude: -73.9851, radiusMeters: 1000 },
      };
      const enabled = { radiusFilter: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const result = builder.buildObservationFilters();

      expect(result.where.some((w) => w.includes('ST_DWithin'))).toBe(true);
      expect(builder.params).toContain(40.7589);
      expect(builder.params).toContain(-73.9851);
      expect(builder.params).toContain(1000);
    });
  });

  // ============================================================================
  // PHASE 7: THREAT FILTERS
  // ============================================================================

  describe('threatScore filters', () => {
    test('threatScoreMin', () => {
      const filters = { threatScoreMin: 70 };
      const enabled = { threatScoreMin: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const query = builder.buildNetworkListQuery();

      expect(query.appliedFilters).toContainEqual({
        type: 'threat',
        field: 'threatScoreMin',
        value: 70,
      });
    });

    test('threatScoreMax', () => {
      const filters = { threatScoreMax: 90 };
      const enabled = { threatScoreMax: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const query = builder.buildNetworkListQuery();

      expect(query.appliedFilters).toContainEqual({
        type: 'threat',
        field: 'threatScoreMax',
        value: 90,
      });
    });

    test('validation - out of range', () => {
      const { errors } = validateFilterPayload({ threatScoreMin: 150 }, { threatScoreMin: true });
      expect(errors).toContain('Threat score minimum out of range (0-100).');
    });
  });

  describe('threatCategories filter', () => {
    test('critical category', () => {
      // Valid categories: critical, high, medium, low (mapped to HIGH, HIGH, MED, LOW)
      const filters = { threatCategories: ['critical'] };
      const enabled = { threatCategories: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const query = builder.buildNetworkListQuery();

      expect(query.appliedFilters).toContainEqual({
        type: 'threat',
        field: 'threatCategories',
        value: ['critical'],
      });
    });
  });

  describe('stationaryConfidence filters', () => {
    test('stationaryConfidenceMin', () => {
      const filters = { stationaryConfidenceMin: 0.8 };
      const enabled = { stationaryConfidenceMin: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const query = builder.buildNetworkListQuery();

      expect(query.appliedFilters).toContainEqual({
        type: 'threat',
        field: 'stationaryConfidenceMin',
        value: 0.8,
      });
    });

    test('stationaryConfidenceMax', () => {
      const filters = { stationaryConfidenceMax: 0.5 };
      const enabled = { stationaryConfidenceMax: true };
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const query = builder.buildNetworkListQuery();

      expect(query.appliedFilters).toContainEqual({
        type: 'threat',
        field: 'stationaryConfidenceMax',
        value: 0.5,
      });
    });

    test('validation - out of range', () => {
      const { errors } = validateFilterPayload(
        { stationaryConfidenceMin: 1.5 },
        { stationaryConfidenceMin: true }
      );
      expect(errors).toContain('Stationary confidence minimum out of range (0.0-1.0).');
    });
  });
});
