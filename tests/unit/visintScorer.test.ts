export {};

import { queryCorrelatedObservations } from '../../server/src/services/visint/visintScorer';
import { describeIfIntegration } from '../helpers/integrationEnv';

const TIMESTAMP = '2024-06-01T12:00:00.000Z';
const BASE_MS = new Date(TIMESTAMP).getTime();

describe('queryCorrelatedObservations', () => {
  test('passes lon/lat/timestamp/radius/window/limit as correct param positions', async () => {
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await queryCorrelatedObservations(queryFn, -122.4, 37.8, TIMESTAMP, 100, 3, 10);

    const params = queryFn.mock.calls[0][1];
    expect(params[0]).toBe(-122.4); // $1 lon
    expect(params[1]).toBe(37.8); // $2 lat
    expect(params[2]).toBe(TIMESTAMP); // $3 timestamp
    expect(params[3]).toBe(100); // $4 radiusMeters
    expect(params[6]).toBe(10); // $7 limit
  });

  test('calculates startTime as timestamp minus windowHours', async () => {
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await queryCorrelatedObservations(queryFn, 0, 0, TIMESTAMP, 50, 2, 5);

    const params = queryFn.mock.calls[0][1];
    const startTime = new Date(params[4]).getTime();
    expect(startTime).toBe(BASE_MS - 2 * 60 * 60 * 1000);
  });

  test('calculates endTime as timestamp plus windowHours', async () => {
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await queryCorrelatedObservations(queryFn, 0, 0, TIMESTAMP, 50, 2, 5);

    const params = queryFn.mock.calls[0][1];
    const endTime = new Date(params[5]).getTime();
    expect(endTime).toBe(BASE_MS + 2 * 60 * 60 * 1000);
  });

  test('window is symmetric around timestamp', async () => {
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await queryCorrelatedObservations(queryFn, 0, 0, TIMESTAMP, 50, 4, 5);

    const params = queryFn.mock.calls[0][1];
    const startTime = new Date(params[4]).getTime();
    const endTime = new Date(params[5]).getTime();
    const center = (startTime + endTime) / 2;
    expect(center).toBe(BASE_MS);
    expect(endTime - startTime).toBe(8 * 60 * 60 * 1000); // 2 * 4h
  });

  test('uses default radiusMeters=50, windowHours=2, limit=5 when not specified', async () => {
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await queryCorrelatedObservations(queryFn, 0, 0, TIMESTAMP);

    const params = queryFn.mock.calls[0][1];
    expect(params[3]).toBe(50); // radiusMeters
    expect(params[6]).toBe(5); // limit
    const windowMs = new Date(params[5]).getTime() - new Date(params[4]).getTime();
    expect(windowMs).toBe(4 * 60 * 60 * 1000); // 2h each side = 4h total
  });

  test('returns the rows array from queryFn result', async () => {
    const mockRows = [{ id: 1, bssid: 'AA:BB:CC:DD:EE:FF', detection_score: 4 }];
    const queryFn = jest.fn().mockResolvedValue({ rows: mockRows });
    const result = await queryCorrelatedObservations(queryFn, 0, 0, TIMESTAMP);
    expect(result).toBe(mockRows);
  });

  test('SQL contains correct parameter placeholders $1–$7', async () => {
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await queryCorrelatedObservations(queryFn, 0, 0, TIMESTAMP);

    const sql: string = queryFn.mock.calls[0][0];
    for (let i = 1; i <= 7; i++) {
      expect(sql).toContain(`$${i}`);
    }
  });

  test('SQL orders by delta_minutes ASC then detection_score DESC', async () => {
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await queryCorrelatedObservations(queryFn, 0, 0, TIMESTAMP);

    const sql: string = queryFn.mock.calls[0][0];
    const orderIdx = sql.indexOf('ORDER BY');
    expect(orderIdx).toBeGreaterThan(-1);
    const orderClause = sql.slice(orderIdx);
    expect(orderClause).toMatch(/delta_minutes\s+ASC/);
    expect(orderClause).toMatch(/detection_score\s+DESC/);
  });

  test('ST_DWithin uses geom::geography so radius $4 is evaluated in metres via GiST index', async () => {
    // Regression: the previous form rebuilt a point from raw lon/lat columns
    // (ST_MakePoint(lon, lat)::geography) which bypasses the GiST index and
    // is redundant given the stored geom column. The fix is to use geom::geography
    // directly as the first ST_DWithin argument.
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await queryCorrelatedObservations(queryFn, -83.6895, 43.0147, TIMESTAMP, 50);

    const sql: string = queryFn.mock.calls[0][0];
    // Must use the indexed geom column cast to geography
    expect(sql).toMatch(/ST_DWithin\s*\(\s*geom::geography/);
    // Must NOT re-derive the observation point from raw lat/lon columns inside ST_DWithin
    expect(sql).not.toMatch(/ST_DWithin\s*\(\s*ST_SetSRID\s*\(\s*ST_MakePoint\s*\(\s*lon/);
  });

  test('ST_DWithin candidate point is built from $1/$2 parameters cast to geography', async () => {
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await queryCorrelatedObservations(queryFn, -83.6895, 43.0147, TIMESTAMP, 50);

    const sql: string = queryFn.mock.calls[0][0];
    // The media-origin point must remain parameterised via $1/$2 and cast to geography
    expect(sql).toMatch(
      /ST_SetSRID\s*\(\s*ST_MakePoint\s*\(\s*\$1\s*,\s*\$2\s*\)\s*,\s*4326\s*\)::geography/
    );
  });
});

// ─── Integration tests — require RUN_INTEGRATION_TESTS=true + live shadowcheck_test DB ───
// Anchor observations are seeded by tests/fixtures/seed_integration_anchors.sql.
// Run that script after any shadowcheck_test refresh before running this suite.

describeIfIntegration('queryCorrelatedObservations — live DB score assignments', () => {
  // Synthetic anchor location from seed_integration_anchors.sql
  // BSSIDs: 02:SC:TE:ST:xx:xx — locally administered, clearly synthetic
  const ANCHOR_LON = -83.697;
  const ANCHOR_LAT = 43.0234;
  const ANCHOR_TIMESTAMP = '2024-06-01T12:00:00.000Z';
  const RADIUS = 200;

  let queryFn: (sql: string, params: any[]) => Promise<any>;

  beforeAll(() => {
    const { pool } = require('../../server/src/config/database');
    queryFn = (sql: string, params: any[]) => pool.query(sql, params);
  });

  test('score 4 — Flock BLE UUID match returns detection_score=4 and FLOCK_SAFETY_CAMERA', async () => {
    const rows = await queryCorrelatedObservations(
      queryFn,
      ANCHOR_LON,
      ANCHOR_LAT,
      ANCHOR_TIMESTAMP,
      RADIUS,
      2,
      20
    );
    const hit = rows.find((r: any) => r.bssid === '02:SC:TE:ST:00:04');
    expect(hit).toBeDefined();
    expect(hit.detection_score).toBe(4);
    expect(hit.device_type).toBe('FLOCK_SAFETY_CAMERA');
  });

  test('score 3 — 10-digit SSID returns detection_score=3 and FLOCK_SAFETY_CAMERA', async () => {
    const rows = await queryCorrelatedObservations(
      queryFn,
      ANCHOR_LON,
      ANCHOR_LAT,
      ANCHOR_TIMESTAMP,
      RADIUS,
      2,
      20
    );
    const hit = rows.find((r: any) => r.bssid === '02:SC:TE:ST:00:03');
    expect(hit).toBeDefined();
    expect(hit.detection_score).toBe(3);
    expect(hit.device_type).toBe('FLOCK_SAFETY_CAMERA');
  });

  test('score 1 — BLE ssid="4" returns detection_score=1 and FLOCK_SAFETY_CAMERA', async () => {
    const rows = await queryCorrelatedObservations(
      queryFn,
      ANCHOR_LON,
      ANCHOR_LAT,
      ANCHOR_TIMESTAMP,
      RADIUS,
      2,
      20
    );
    const hit = rows.find((r: any) => r.bssid === '02:SC:TE:ST:00:01');
    expect(hit).toBeDefined();
    expect(hit.detection_score).toBe(1);
    expect(hit.device_type).toBe('FLOCK_SAFETY_CAMERA');
  });

  test('score 0 — plain WiFi returns detection_score=0 and null device_type', async () => {
    const rows = await queryCorrelatedObservations(
      queryFn,
      ANCHOR_LON,
      ANCHOR_LAT,
      ANCHOR_TIMESTAMP,
      RADIUS,
      2,
      20
    );
    const hit = rows.find((r: any) => r.bssid === '02:SC:TE:ST:00:00');
    expect(hit).toBeDefined();
    expect(hit.detection_score).toBe(0);
    expect(hit.device_type).toBeNull();
  });

  test('results ordered by delta_minutes ASC', async () => {
    const rows = await queryCorrelatedObservations(
      queryFn,
      ANCHOR_LON,
      ANCHOR_LAT,
      ANCHOR_TIMESTAMP,
      RADIUS,
      2,
      20
    );
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i].delta_minutes)).toBeGreaterThanOrEqual(
        Number(rows[i - 1].delta_minutes)
      );
    }
  });

  test('respects limit — result count does not exceed limit', async () => {
    const rows = await queryCorrelatedObservations(
      queryFn,
      ANCHOR_LON,
      ANCHOR_LAT,
      ANCHOR_TIMESTAMP,
      RADIUS,
      2,
      2
    );
    expect(rows.length).toBeLessThanOrEqual(2);
  });

  test('tight radius excludes anchor when outside bounds', async () => {
    // 1m radius centered 500m away — anchors should not appear
    const rows = await queryCorrelatedObservations(
      queryFn,
      ANCHOR_LON + 0.01,
      ANCHOR_LAT + 0.01,
      ANCHOR_TIMESTAMP,
      1,
      2,
      20
    );
    const anchor = rows.find((r: any) => (r.bssid as string).startsWith('02:SC:TE:ST:'));
    expect(anchor).toBeUndefined();
  });
});
