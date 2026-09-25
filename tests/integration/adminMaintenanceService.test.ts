import { Client } from 'pg';
import { truncateAllData } from '../../server/src/services/adminMaintenanceService';
import { describeIfIntegration } from '../helpers/integrationEnv';

describeIfIntegration('admin maintenance network reset', () => {
  const normalBssid = '02:SC:FK:TE:ST:01';
  const sentinelBssid = 'VISINT_UNMATCHED';
  const sourceCode = 'admin-maintenance-fk-test';
  const secondBssid = '02:SC:FK:TE:ST:02';
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      user: process.env.DB_ADMIN_USER || 'shadowcheck_admin',
      password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: 'shadowcheck_test',
    });
    await client.connect();
  });

  const cleanup = async () => {
    await client.query('BEGIN');
    try {
      await client.query(
        `DELETE FROM app.observations
         WHERE source_tag = 'admin-maintenance'`
      );
      await client.query('DELETE FROM app.ssid_history WHERE bssid IN ($1, $2)', [
        normalBssid,
        secondBssid,
      ]);
      await client.query('DELETE FROM app.networks WHERE bssid IN ($1, $2)', [
        normalBssid,
        secondBssid,
      ]);
      await client.query('DELETE FROM app.device_sources WHERE code = $1', [sourceCode]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  };

  afterEach(async () => {
    try {
      await cleanup();
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
    }
  });

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await client.end();
    }
  });

  beforeEach(async () => {
    await cleanup();
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO app.device_sources (id, code, label, locale)
       VALUES (997, $1, 'Admin maintenance FK test', 'en_US')
       ON CONFLICT (code) DO NOTHING`,
      [sourceCode]
    );
    await client.query(
      `INSERT INTO app.networks (
         bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
         lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon, source_device, is_sentinel
       )
       VALUES
         ($1, 'FK TEST', 'W', 2412, '', '', '', 0, 1, 0, 0, 0, 0, 0, $3, false),
         ($2, 'FK TEST 2', 'W', 2412, '', '', '', 0, 1, 0, 0, 0, 0, 0, $3, false),
         ('VISINT_UNMATCHED', 'VISINT_UNMATCHED', 'W', 0, '', '', '', 0, 0, 0, 0, 0, 0, 0, $3, true)
       ON CONFLICT (bssid) DO UPDATE SET is_sentinel = EXCLUDED.is_sentinel`,
      [normalBssid, secondBssid, sourceCode]
    );
    await client.query(
      `INSERT INTO app.ssid_history (bssid, ssid, first_seen, last_seen)
       VALUES ($1, 'FK TEST', NOW(), NOW())`,
      [normalBssid]
    );
    await client.query(
      `INSERT INTO app.observations (
         device_id, bssid, ssid, level, lat, lon, altitude, accuracy, time,
         observed_at_ms, external, mfgrid, source_tag, source_pk, geom, time_ms
       )
       VALUES ($1, $2, 'FK TEST', -60, 0, 0, 0, 0, NOW(), 1, false, 0,
               'admin-maintenance', 'admin-maintenance-fk-test',
               ST_SetSRID(ST_MakePoint(0, 0), 4326), 1)`,
      [sourceCode, normalBssid]
    );
    await client.query(
      `INSERT INTO app.network_tags (bssid, threat_tag, notes)
       VALUES ($1, 'MANUAL', 'admin-maintenance-fk-test')`,
      [normalBssid]
    );
    await client.query(
      `INSERT INTO app.network_notes (bssid, content, note_type)
       VALUES ($1, 'admin-maintenance-fk-test', 'manual')`,
      [normalBssid]
    );
    await client.query(
      `INSERT INTO app.network_locations (bssid, centroid_lat, centroid_lon, weighted_lat, weighted_lon, obs_count)
       VALUES ($1, 0, 0, 0, 0, 1)`,
      [normalBssid]
    );
    await client.query(
      `INSERT INTO app.network_cooccurrence (
         bssid1, bssid2, cooccurrence_count, locations_count, first_seen, last_seen
       )
       VALUES ($1, $2, 1, 1, NOW(), NOW())`,
      [normalBssid, secondBssid]
    );
    await client.query(
      `INSERT INTO app.network_sibling_pairs (
         bssid1, bssid2, rule, confidence, d_last_octet, d_third_octet,
         ssid1, ssid2, frequency1, frequency2, distance_m, pair_strength, source,
         is_active, corroborating_rules
       )
       VALUES ($1, $2, 'fk-test', 0.99, 1, 1, 'FK TEST', 'FK TEST 2',
               2412, 2412, 10, 'candidate', 'test', true, ARRAY[]::text[])`,
      [normalBssid, secondBssid]
    );
    await client.query(
      `INSERT INTO app.network_sibling_overrides (
         bssid1, bssid2, relation, confidence, updated_by
       )
       VALUES ($1, $2, 'sibling', 1, 'test')`,
      [normalBssid, secondBssid]
    );
    await client.query(
      `INSERT INTO app.network_threat_scores (bssid, final_threat_score, final_threat_level)
       VALUES ($1, 50, 'MEDIUM')`,
      [normalBssid]
    );
    await client.query(
      `INSERT INTO app.threat_scores_cache (bssid, threat_score, threat_level, threat_summary)
       VALUES ($1, 50, 'MEDIUM', 'admin-maintenance-fk-test')
       ON CONFLICT (bssid) DO UPDATE SET
         threat_score = EXCLUDED.threat_score,
         threat_level = EXCLUDED.threat_level,
         threat_summary = EXCLUDED.threat_summary`,
      [normalBssid]
    );
    await client.query(
      `INSERT INTO app.surveillance_detections (
         bssid, detected_at, device_type, confidence, threat_score, detection_method,
         matched_signals, created_by
       )
       VALUES ($1, NOW(), 'TEST', 0.9, 50, 'test', '{}'::jsonb, 'test')`,
      [normalBssid]
    );
    await client.query('COMMIT');
  });

  it('deletes non-sentinel networks and every dependent row while preserving sentinel data', async () => {
    await expect(truncateAllData()).resolves.toBeUndefined();

    const tables = [
      ['networks', 'bssid'],
      ['observations', 'bssid'],
      ['ssid_history', 'bssid'],
      ['network_tags', 'bssid'],
      ['network_notes', 'bssid'],
      ['network_locations', 'bssid'],
      ['network_threat_scores', 'bssid'],
      ['threat_scores_cache', 'bssid'],
      ['surveillance_detections', 'bssid'],
      ['network_cooccurrence', 'bssid1'],
      ['network_sibling_pairs', 'bssid1'],
      ['network_sibling_overrides', 'bssid1'],
    ] as const;

    for (const [table, column] of tables) {
      const removed = await client.query(
        `SELECT count(*)::int AS count FROM app.${table} WHERE ${column} = $1`,
        [normalBssid]
      );
      expect(removed.rows[0].count).toBe(0);
    }

    const sentinel = await client.query(
      'SELECT count(*)::int AS count FROM app.networks WHERE bssid = $1',
      [sentinelBssid]
    );
    expect(sentinel.rows[0].count).toBe(1);

    const orphans = await client.query(`
      SELECT count(*)::int AS count
      FROM app.ssid_history h
      LEFT JOIN app.networks n ON n.bssid = h.bssid
      WHERE n.bssid IS NULL
    `);
    expect(orphans.rows[0].count).toBe(0);
  });
});
