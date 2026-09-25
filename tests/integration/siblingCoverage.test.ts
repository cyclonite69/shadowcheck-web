import { query, closePool } from '../../server/src/config/database';
import { describeIfIntegration } from '../helpers/integrationEnv';
import { SIBLING_COVERAGE_SQL } from '../../server/src/services/admin/siblingDetectionQueries';

describeIfIntegration('Sibling Coverage Stats Accounting', () => {
  const testBssids = ['00:00:00:00:00:0A', '00:00:00:00:00:0B', '00:00:00:00:00:0C'];

  beforeEach(async () => {
    // Clean up any stale data
    await query(
      'DELETE FROM app.network_sibling_pairs WHERE bssid1 = ANY($1) OR bssid2 = ANY($1)',
      [testBssids]
    );
    await query('DELETE FROM app.networks WHERE bssid = ANY($1)', [testBssids]);
  });

  afterAll(async () => {
    // Final cleanup
    await query(
      'DELETE FROM app.network_sibling_pairs WHERE bssid1 = ANY($1) OR bssid2 = ANY($1)',
      [testBssids]
    );
    await query('DELETE FROM app.networks WHERE bssid = ANY($1)', [testBssids]);
    await closePool();
  });

  test('correctly calculates sibling coverage treating pairs as undirected', async () => {
    // 1. Measure baseline
    const baseResult = await query(SIBLING_COVERAGE_SQL);
    const baseTotal = Number(baseResult.rows[0]?.total_wifi_bssids || 0);
    const baseSiblings = Number(baseResult.rows[0]?.bssids_with_siblings || 0);

    // 2. Insert test networks: A, B, C (all type 'W')
    await query(`
      INSERT INTO app.networks (bssid, ssid, type, frequency, capabilities, lasttime_ms, lastlat, lastlon, bestlat, bestlon)
      VALUES
        ('00:00:00:00:00:0A', 'Network-A', 'W', 2412, '', 1716500000000, 42.0, -83.0, 42.0, -83.0),
        ('00:00:00:00:00:0B', 'Network-B', 'W', 2412, '', 1716500000000, 42.0, -83.0, 42.0, -83.0),
        ('00:00:00:00:00:0C', 'Network-C', 'W', 2412, '', 1716500000000, 42.0, -83.0, 42.0, -83.0)
    `);

    // Verify networks are added, but no siblings yet
    const midResult = await query(SIBLING_COVERAGE_SQL);
    const midTotal = Number(midResult.rows[0]?.total_wifi_bssids || 0);
    const midSiblings = Number(midResult.rows[0]?.bssids_with_siblings || 0);

    expect(midTotal).toBe(baseTotal + 3);
    expect(midSiblings).toBe(baseSiblings);

    // 3. Insert active sibling pair: A ↔ B (A < B constraint)
    await query(`
      INSERT INTO app.network_sibling_pairs (bssid1, bssid2, rule, confidence, pair_strength, quality_scope, computed_at)
      VALUES ('00:00:00:00:00:0A', '00:00:00:00:00:0B', 'Class A', 0.900, 'strong', 'default', now())
    `);

    // 4. Measure after pair insertion
    const finalResult = await query(SIBLING_COVERAGE_SQL);
    const finalTotal = Number(finalResult.rows[0]?.total_wifi_bssids || 0);
    const finalSiblings = Number(finalResult.rows[0]?.bssids_with_siblings || 0);
    const finalPct = Number(finalResult.rows[0]?.coverage_pct || 0);

    expect(finalTotal).toBe(baseTotal + 3);
    // Both endpoints A and B must be counted as sibling-covered (undirected), so it should increase by 2!
    expect(finalSiblings).toBe(baseSiblings + 2);

    // If A, B, C are the only networks, coverage is 66.67%.
    // In the test database context, it will reflect the global ratio:
    const expectedPct = Math.round(((finalSiblings * 100.0) / finalTotal) * 100) / 100;
    expect(finalPct).toBeCloseTo(expectedPct, 2);
  });
});
