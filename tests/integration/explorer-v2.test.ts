/**
 * Integration Tests: Explorer V2 Endpoint
 * Validates that /api/explorer/networks-v2 is a strict superset of v1
 */

const { runIntegration } = require('../helpers/integrationEnv');

const describeIfIntegration = runIntegration ? describe : describe.skip;

let request;
let express;
let explorerRouter;
let app;

if (runIntegration) {
  request = require('supertest');
  express = require('express');
  explorerRouter = require('../../server/src/api/routes/v1/explorer');
  app = express();
  app.use('/api/explorer', explorerRouter);
}

describeIfIntegration('Explorer V2 Endpoint Integration Tests', () => {
  if (!runIntegration) {
    test.skip('requires RUN_INTEGRATION_TESTS', () => {});
    return;
  }

  let v1Response;
  let v2Response;

  // ============================================================================
  // Setup: Fetch both endpoints
  // ============================================================================
  beforeAll(async () => {
    // Fetch V1
    const v1Res = await request(app)
      .get('/api/explorer/networks')
      .query({ limit: 10, sort: 'last_seen', order: 'desc' });
    v1Response = v1Res.body;

    // Fetch V2
    const v2Res = await request(app)
      .get('/api/explorer/networks-v2')
      .query({ limit: 10, sort: 'last_seen', order: 'desc' });
    v2Response = v2Res.body;
  }, 30000); // 30s timeout for DB queries

  // ============================================================================
  // Test 1: Response structure
  // ============================================================================
  describe('Response Structure', () => {
    test('V1 should return total and rows', () => {
      expect(v1Response).toHaveProperty('total');
      expect(v1Response).toHaveProperty('rows');
      expect(Array.isArray(v1Response.rows)).toBe(true);
    });

    test('V2 should return total and rows', () => {
      expect(v2Response).toHaveProperty('total');
      expect(v2Response).toHaveProperty('rows');
      expect(Array.isArray(v2Response.rows)).toBe(true);
    });

    test('Both should return same number of rows', () => {
      expect(v2Response.rows.length).toBe(v1Response.rows.length);
    });

    test('Both should have rows if data exists', () => {
      if (v1Response.total > 0) {
        expect(v1Response.rows.length).toBeGreaterThan(0);
        expect(v2Response.rows.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Test 2: Legacy field contract (MUST preserve all fields)
  // ============================================================================
  describe('Legacy Field Contract', () => {
    const requiredFields = [
      'bssid',
      'ssid',
      'observed_at',
      'signal',
      'lat',
      'lon',
      'observations',
      'first_seen',
      'last_seen',
      'is_5ghz',
      'is_6ghz',
      'is_hidden',
      'type',
      'frequency',
      'capabilities',
      'security',
      'distance_from_home_km',
      'accuracy_meters',
    ];

    test.each(requiredFields)('V2 should have legacy field: %s', (field) => {
      if (v2Response.rows.length > 0) {
        expect(v2Response.rows[0]).toHaveProperty(field);
      }
    });

    test('V2 legacy fields should match V1 exactly', () => {
      if (v1Response.rows.length > 0 && v2Response.rows.length > 0) {
        // Sort both by BSSID for comparison
        const v1Sorted = [...v1Response.rows].sort((a, b) => a.bssid.localeCompare(b.bssid));
        const v2Sorted = [...v2Response.rows].sort((a, b) => a.bssid.localeCompare(b.bssid));

        // Extract legacy fields
        const extractLegacy = (row) => ({
          bssid: row.bssid,
          ssid: row.ssid,
          observed_at: row.observed_at,
          signal: row.signal,
          lat: row.lat,
          lon: row.lon,
          observations: row.observations,
          first_seen: row.first_seen,
          last_seen: row.last_seen,
          is_5ghz: row.is_5ghz,
          is_6ghz: row.is_6ghz,
          is_hidden: row.is_hidden,
          type: row.type,
          frequency: row.frequency,
          capabilities: row.capabilities,
          security: row.security,
          distance_from_home_km: row.distance_from_home_km,
          accuracy_meters: row.accuracy_meters,
        });

        const v1Legacy = v1Sorted.map(extractLegacy);
        const v2Legacy = v2Sorted.map(extractLegacy);

        expect(v2Legacy).toEqual(v1Legacy);
      }
    });
  });

  // ============================================================================
  // Test 3: New enrichment fields (additive, non-breaking)
  // ============================================================================
  describe('New Enrichment Fields', () => {
    const newFields = [
      'manufacturer',
      'manufacturer_address',
      'min_altitude_m',
      'max_altitude_m',
      'altitude_span_m',
      'max_distance_meters',
      'last_altitude_m',
      'is_sentinel',
    ];

    test.each(newFields)('V2 should have new field: %s', (field) => {
      if (v2Response.rows.length > 0) {
        expect(v2Response.rows[0]).toHaveProperty(field);
      }
    });

    test('V1 should NOT have new fields (ensures non-breaking)', () => {
      if (v1Response.rows.length > 0) {
        expect(v1Response.rows[0]).not.toHaveProperty('manufacturer');
        expect(v1Response.rows[0]).not.toHaveProperty('max_distance_meters');
      }
    });
  });

  // ============================================================================
  // Test 4: Field types and validation
  // ============================================================================
  describe('Field Types and Validation', () => {
    test('BSSID should be uppercase MAC address', () => {
      if (v2Response.rows.length > 0) {
        const bssid = v2Response.rows[0].bssid;
        expect(bssid).toMatch(/^[0-9A-F:]{17}$/);
        expect(bssid).toEqual(bssid.toUpperCase());
      }
    });

    test('SSID should have (hidden) fallback for empty', () => {
      if (v2Response.rows.length > 0) {
        const ssid = v2Response.rows[0].ssid;
        expect(typeof ssid).toBe('string');
        expect(ssid.length).toBeGreaterThan(0); // Never empty
      }
    });

    test('Type should be valid WiGLE type', () => {
      if (v2Response.rows.length > 0) {
        const type = v2Response.rows[0].type;
        const validTypes = ['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'];
        expect(validTypes).toContain(type);
      }
    });

    test('Security should be valid classification', () => {
      if (v2Response.rows.length > 0) {
        const security = v2Response.rows[0].security;
        const validSecurity = [
          'OPEN',
          'WPA',
          'WPA2-P',
          'WPA2-E',
          'WPA3-P',
          'WPA3-E',
          'WEP',
          'WPS',
          'Unknown',
        ];
        expect(validSecurity).toContain(security);
      }
    });

    test('Boolean flags should be actual booleans', () => {
      if (v2Response.rows.length > 0) {
        const row = v2Response.rows[0];
        expect(typeof row.is_5ghz).toBe('boolean');
        expect(typeof row.is_6ghz).toBe('boolean');
        expect(typeof row.is_hidden).toBe('boolean');
        expect(typeof row.is_sentinel).toBe('boolean');
      }
    });

    test('Timestamps should be valid or null', () => {
      if (v2Response.rows.length > 0) {
        const row = v2Response.rows[0];

        ['first_seen', 'last_seen', 'observed_at'].forEach((field) => {
          if (row[field] !== null) {
            const date = new Date(row[field]);
            expect(date.getTime()).toBeGreaterThan(new Date('2000-01-01').getTime());
          }
        });
      }
    });
  });

  // ============================================================================
  // Test 5: Query parameters
  // ============================================================================
  describe('Query Parameters', () => {
    test('Should support limit parameter', async () => {
      const res = await request(app).get('/api/explorer/networks-v2').query({ limit: 5 });
      expect(res.status).toBe(200);
      expect(res.body.rows.length).toBeLessThanOrEqual(5);
    });

    test('Should support sort and order parameters', async () => {
      const res = await request(app)
        .get('/api/explorer/networks-v2')
        .query({ limit: 10, sort: 'ssid', order: 'asc' });
      expect(res.status).toBe(200);
      // Should be sorted alphabetically
      if (res.body.rows.length > 1) {
        const ssids = res.body.rows.map((r) => r.ssid);
        const sorted = [...ssids].sort();
        expect(ssids).toEqual(sorted);
      }
    });

    test('Should support search parameter', async () => {
      const res = await request(app)
        .get('/api/explorer/networks-v2')
        .query({ limit: 10, search: 'test' });
      expect(res.status).toBe(200);
      // Results should contain 'test' in ssid, bssid, or manufacturer
      if (res.body.rows.length > 0) {
        const hasMatch = res.body.rows.some(
          (row) =>
            row.ssid.toLowerCase().includes('test') ||
            row.bssid.toLowerCase().includes('test') ||
            (row.manufacturer && row.manufacturer.toLowerCase().includes('test'))
        );
        expect(hasMatch).toBe(true);
      }
    });
  });

  // ============================================================================
  // Test 6: Performance
  // ============================================================================
  describe('Performance', () => {
    test('V2 should respond in reasonable time (< 5s for 500 rows)', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/explorer/networks-v2').query({ limit: 500 });
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(5000); // 5 seconds max
    }, 10000);
  });
});
