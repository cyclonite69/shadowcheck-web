import { query } from '../../server/src/config/database';

describe('GET /api/v2/networks/:bssid/media - Integration', () => {
  const BSSID = 'AA:BB:CC:DD:EE:FF';
  const repo = require('../../server/src/repositories/adminNetworkMediaRepository');

  beforeAll(async () => {
    // Ensure test BSSID network exists with all required NOT NULL fields
    await query(
      `INSERT INTO app.networks 
       (bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid, lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon)
       VALUES ($1, 'Test Network', 'W', 2437, '', '', '', 0, ${Date.now()}, 40.7128, -74.0060, -45, 40.7128, -74.0060)
       ON CONFLICT (bssid) DO NOTHING`,
      [BSSID]
    );
  });

  afterAll(async () => {
    // Clean up
    await query('DELETE FROM app.network_media WHERE bssid = $1', [BSSID]);
    await query('DELETE FROM app.networks WHERE bssid = $1', [BSSID]);
  });

  test('returns direct media when v_sibling_group_media view does not exist', async () => {
    // Insert direct media for the BSSID (media_data is bytea, use empty bytea)
    await query(
      `INSERT INTO app.network_media (bssid, media_type, filename, mime_type, file_size, media_data)
       VALUES ($1, 'image', 'direct.jpg', 'image/jpeg', 1024, E'\\x')`,
      [BSSID]
    );

    const res = await query("SELECT to_regclass('app.v_sibling_group_media')");
    const viewExists = res.rows[0]?.to_regclass !== null;

    if (!viewExists) {
      console.log('✓ v_sibling_group_media view does not exist in shadowcheck_test (expected)');
    }

    // Test the repository function
    const media = await repo.selectRelatedNetworkMediaForBssid(BSSID);

    expect(media.length).toBeGreaterThan(0);
    const found = media.find((m: any) => m.filename === 'direct.jpg');
    expect(found).toBeDefined();
    expect(found?.is_direct).toBe(true);
    expect(found?.source_kind).toBe('direct');
  });
});
