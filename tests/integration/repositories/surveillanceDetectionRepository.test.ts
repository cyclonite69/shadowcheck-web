import { query, closePool } from '../../../server/src/config/database';
import {
  getEnrichedCandidates,
  bulkUpsertDetections,
  ScoredDetectionType,
} from '../../../server/src/repositories/surveillanceDetectionRepository';
import secretsManager from '../../../server/src/services/secretsManager';

/**
 * Integration tests for SurveillanceDetectionRepository.
 * Uses a live PostgreSQL/PostGIS database.
 */
describe('SurveillanceDetectionRepository Integration', () => {
  // Use admin user for setup and running tests
  const originalDbUser = process.env.DB_USER;

  beforeAll(async () => {
    process.env.DB_USER = 'shadowcheck_admin';
    process.env.DB_PASSWORD = ''; // Locally trusted in Docker
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';

    // Ensure secretsManager is loaded so database.ts can get db_password
    // Even if it's empty, getEnvOverride will fallback to DB_PASSWORD env var.
    try {
      await secretsManager.load();
    } catch {
      // In some test envs this might fail if AWS is totally blocked,
      // but we only need it to NOT throw if DB_PASSWORD is provided.
    }
  });

  afterAll(async () => {
    process.env.DB_USER = originalDbUser;
    await closePool();
  });

  async function cleanup() {
    const testBssids = [
      'B8:35:32:AA:BB:CC',
      'B8:35:32:00:00:01',
      'B8:35:32:FF:FF:FF',
      'TEST:AXON:01',
      'TEST:DEI:01',
    ];
    await query(
      "DELETE FROM app.surveillance_detections WHERE bssid = ANY($1) OR bssid LIKE 'TEST%'",
      [testBssids]
    );
    await query("DELETE FROM app.observations WHERE bssid = ANY($1) OR bssid LIKE 'TEST%'", [
      testBssids,
    ]);
    await query("DELETE FROM app.networks WHERE bssid = ANY($1) OR bssid LIKE 'TEST%'", [
      testBssids,
    ]);
  }

  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  test('Tier 1 & 3: Flock Safety WiFi (OUI + SSID pattern)', async () => {
    const bssid = 'B8:35:32:AA:BB:CC'; // B8:35:32 is a High-conf OUI
    const ssid = 'Flock-123456';

    await query(
      `
      INSERT INTO app.networks (bssid, ssid, type, frequency, capabilities, lasttime_ms, lastlat, lastlon)
      VALUES ($1, $2, 'W', 2412, 'WPA2', 1700000000000, 34.0, -118.0)
    `,
      [bssid, ssid]
    );

    const candidates = await getEnrichedCandidates(query);
    const match = candidates.find((c) => c.bssid === bssid);

    expect(match).toBeDefined();
    expect(match?.device_type).toBe('FLOCK_SAFETY_CAMERA');
    expect(match?.base_likelihood).toBe(90); // SSID pattern match boost
    expect(match?.detection_method).toBe('multi_signal');
    expect(match?.matched_signals).toMatchObject({
      tier: 'HIGH',
      ssid: ssid,
    });
  });

  test('Tier 13: Axon Body Camera (Officer Assignment SSID Pattern)', async () => {
    const bssid = 'TEST:AXON:01';
    const ssid = 'X_jdoe'; // Pattern: X_[initial][surname]

    await query(
      `
      INSERT INTO app.networks (bssid, ssid, type, frequency, capabilities, lasttime_ms, lastlat, lastlon)
      VALUES ($1, $2, 'B', 0, '', 1700000000000, 34.0, -118.0)
    `,
      [bssid, ssid]
    );

    const candidates = await getEnrichedCandidates(query);
    const match = candidates.find((c) => c.bssid === bssid);

    expect(match).toBeDefined();
    expect(match?.device_type).toBe('AXON_BODY_CAMERA');
    expect(match?.base_likelihood).toBe(82);
    expect(match?.detection_method).toBe('ssid_pattern');
    expect(match?.matched_signals).toMatchObject({
      pattern: '^X_[A-Za-z][A-Za-z]+$',
      note: 'officer_assignment_ssid',
    });
  });

  test('Tier 17: DEI Body Camera (SSID Pattern + UUID boost)', async () => {
    const bssid = 'TEST:DEI:01';
    const ssid = 'DEI-1234567';
    const uuid = 'b4520100-a308-4e56-8a52-536c2ad07147';

    await query(
      `
      INSERT INTO app.networks (bssid, ssid, type, frequency, capabilities, service, lasttime_ms, lastlat, lastlon)
      VALUES ($1, $2, 'E', 0, '', $3, 1700000000000, 34.0, -118.0)
    `,
      [bssid, ssid, uuid]
    );

    const candidates = await getEnrichedCandidates(query);
    const match = candidates.find((c) => c.bssid === bssid);

    expect(match).toBeDefined();
    expect(match?.device_type).toBe('DEI_BWC');
    expect(match?.base_likelihood).toBe(92); // Boosted from 84 because of UUID
    expect(match?.detection_method).toBe('ssid_pattern');
    expect(match?.matched_signals).toMatchObject({
      service_uuid: uuid,
    });
  });

  test('Observation Stats Integration', async () => {
    const bssid = 'B8:35:32:00:00:01';

    await query(
      `
      INSERT INTO app.networks (bssid, ssid, type, frequency, capabilities, lasttime_ms, lastlat, lastlon)
      VALUES ($1, 'Flock-TEST', 'W', 2412, 'WPA2', 1700000000000, 34.0, -118.0)
    `,
      [bssid]
    );

    // Insert 3 observations across 2 days
    const baseTime = new Date('2026-05-01T12:00:00Z');
    const day2 = new Date('2026-05-02T12:00:00Z');

    const obs = [
      { level: -60, lat: 34.001, lon: -118.001, time: baseTime },
      { level: -50, lat: 34.002, lon: -118.002, time: baseTime },
      { level: -70, lat: 34.003, lon: -118.003, time: day2 },
    ];

    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      await query(
        `
        INSERT INTO app.observations (bssid, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, mfgrid, source_tag, source_pk, device_id, geom)
        VALUES ($1, $2, $3, $4, 0, 10, $5, $6, $6, 0, 'test', $7, 's22', ST_SetSRID(ST_Point($4, $3), 4326))
      `,
        [bssid, o.level, o.lat, o.lon, o.time, o.time.getTime(), `pk-${i}`]
      );
    }

    const candidates = await getEnrichedCandidates(query);
    const match = candidates.find((c) => c.bssid === bssid);

    expect(match).toBeDefined();
    expect(match?.obs_count).toBe(3);
    expect(match?.unique_days).toBe(2);
    expect(Number(match?.min_rssi)).toBe(-70);
    expect(Number(match?.max_rssi)).toBe(-50);
    expect(match?.unique_positions).toBe(3);
  });

  test('bulkUpsertDetections and Conflict Handling', async () => {
    const bssid = 'B8:35:32:FF:FF:FF';

    // 1. Initial Insert
    const detection: ScoredDetectionType = {
      bssid,
      device_type: 'FLOCK_SAFETY_CAMERA',
      confidence: 0.85,
      threat_score: 75.0,
      detection_method: 'oui_match',
      matched_signals: { oui: 'B8:35:32' },
      false_positive: false,
      fp_reason: null,
    };

    // Need a network record first due to FK
    await query(
      `
      INSERT INTO app.networks (bssid, type, frequency, capabilities, lasttime_ms, lastlat, lastlon)
      VALUES ($1, 'W', 2412, 'WPA2', 1700000000000, 34.0, -118.0)
    `,
      [bssid]
    );

    const count1 = await bulkUpsertDetections(query, [detection]);
    expect(count1).toBe(1);

    const row1 = (
      await query('SELECT * FROM app.surveillance_detections WHERE bssid = $1', [bssid])
    ).rows[0];
    expect(Number(row1.threat_score)).toBe(75.0);
    expect(row1.false_positive).toBe(false);

    // 2. Update existing (Conflict)
    detection.threat_score = 80.0;
    const count2 = await bulkUpsertDetections(query, [detection]);
    expect(count2).toBe(1);

    const row2 = (
      await query('SELECT * FROM app.surveillance_detections WHERE bssid = $1', [bssid])
    ).rows[0];
    expect(Number(row2.threat_score)).toBe(80.0);

    // 3. Mark as False Positive
    detection.false_positive = true;
    detection.fp_reason = 'Known Friendly';
    await bulkUpsertDetections(query, [detection]);

    const row3 = (
      await query('SELECT * FROM app.surveillance_detections WHERE bssid = $1', [bssid])
    ).rows[0];
    expect(row3.false_positive).toBe(true);
    expect(row3.fp_reason).toBe('Known Friendly');

    // 4. Try to update a False Positive (should be ignored by WHERE clause in query)
    detection.threat_score = 99.0;
    detection.false_positive = false; // Try to "re-activate"
    await bulkUpsertDetections(query, [detection]);

    const row4 = (
      await query('SELECT * FROM app.surveillance_detections WHERE bssid = $1', [bssid])
    ).rows[0];
    // Should NOT have updated because of the WHERE clause:
    // WHERE app.surveillance_detections.false_positive = FALSE OR EXCLUDED.false_positive = TRUE
    expect(Number(row4.threat_score)).toBe(80.0);
    expect(row4.false_positive).toBe(true);
  });

  test('Candidate Shape: getEnrichedCandidates returns rows matching the stable CandidateRow structure', async () => {
    // Insert a valid network that matches a known category (Flock Safety WiFi OUI)
    const bssid = 'B8:35:32:FF:FF:FF';
    await query(
      `
      INSERT INTO app.networks (bssid, ssid, type, frequency, capabilities, lasttime_ms, lastlat, lastlon)
      VALUES ($1, 'Flock-TEST-SHAPE', 'W', 2412, 'WPA2', 1700000000000, 34.0, -118.0)
    `,
      [bssid]
    );

    const candidates = await getEnrichedCandidates(query);
    const match = candidates.find((c) => c.bssid === bssid);
    expect(match).toBeDefined();

    // Verify all CandidateRow interface fields are present with correct types
    expect(typeof match?.bssid).toBe('string');
    expect(typeof match?.ssid).toBe('string');
    expect(typeof match?.type).toBe('string');
    expect(typeof match?.device_type).toBe('string');
    expect(typeof match?.base_likelihood).toBe('number');
    expect(typeof match?.match_quality).toBe('string');
    expect(typeof match?.detection_method).toBe('string');
    expect(typeof match?.matched_signals).toBe('object');
    expect(typeof match?.priority).toBe('number');
    expect(typeof match?.tier_hit_count).toBe('number');
    expect(typeof match?.obs_count).toBe('number');
    expect(typeof match?.unique_days).toBe('number');
    expect(typeof match?.duration_seconds).toBe('number');
    expect(typeof match?.unique_positions).toBe('number');
  });
});
