import { ENRICHED_CANDIDATES_SQL } from '../../../server/src/repositories/surveillanceDetectionRepositorySql';
import { scoreSurveillanceCandidates } from '../../../server/src/services/backgroundJobs/surveillanceScoring';
import type { CandidateRow } from '../../../server/src/repositories/surveillanceDetectionRepository';

function makeRow(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    bssid: 'AA:BB:CC:DD:EE:01',
    ssid: 'TestNetwork',
    type: 'E',
    bestlevel: -65,
    service: null,
    mfgrid: null,
    device_type: 'FLOCK_SAFETY_CAMERA',
    base_likelihood: 80,
    match_quality: 'STRONG',
    detection_method: 'ble_name_pattern',
    matched_signals: {},
    priority: 6,
    obs_count: 5,
    duration_seconds: 600,
    unique_days: 3,
    min_rssi: -70,
    max_rssi: -60,
    avg_rssi: -65,
    unique_positions: 4,
    first_seen: '2026-01-01T00:00:00Z',
    last_seen: '2026-05-01T00:00:00Z',
    tier_hit_count: 1,
    ...overrides,
  };
}

describe('Phase 2 Flock Fingerprint Extensions', () => {
  describe('A. Pigvision BLE Name Rejection and Deferred Migration Contract', () => {
    test('Tier 6 regex excludes pigvision and preserves existing supported BLE names', () => {
      // Extract Tier 6 SQL chunk
      const tier6Match = ENRICHED_CANDIDATES_SQL.match(
        /-- 6\. BLE device name patterns[\s\S]*?(?=UNION ALL)/
      );
      expect(tier6Match).toBeDefined();
      const tier6Sql = tier6Match![0];

      // Verify regex does NOT include pigvision
      expect(tier6Sql).not.toContain('pigvision');
      expect(tier6Sql).toMatch(
        /n\.ssid ~\*\s*'\^\(fs ext battery\|flock\|falcon\|raven\|sparrow\|condor\|penguin\)'/
      );

      // Verify base likelihood is uniformly 70 (no pigvision branch)
      expect(tier6Sql).toContain("70, 'PARTIAL', 'ble_name_pattern'");

      // Verify Tier 6 documents that Pigvision is deferred pending schema migration
      expect(tier6Sql).toContain('PIGVISION_SYSTEM');
      expect(tier6Sql).toContain('deferred pending a schema migration');
    });

    test.each([
      ['pigvision', false],
      ['Pigvision', false],
      ['PIGVISION', false],
      ['PigVision_01', false],
      ['pigvision-cam', false],
      ['penguin', true],
      ['Flock-123', true],
      ['falcon', true],
      ['fs ext battery', true],
      ['raven-sensor', true],
      ['sparrow-01', true],
      ['condor-unit', true],
      ['random_device', false],
    ])('evaluates Tier 6 pattern for "%s" as %s', (ssid, expectedMatch) => {
      const pattern = /^(fs ext battery|flock|falcon|raven|sparrow|condor|penguin)/i;
      expect(pattern.test(ssid)).toBe(expectedMatch);
    });

    test('verifies Pigvision is NOT classified as FLOCK_SAFETY_CAMERA in Tier 6', () => {
      const pattern = /^(fs ext battery|flock|falcon|raven|sparrow|condor|penguin)/i;
      const pigvisionSsid = 'Pigvision_01';
      expect(pattern.test(pigvisionSsid)).toBe(false);
    });
  });

  describe('B. Raven UUID Recognition SQL Contract', () => {
    test('Tier 21 is defined as priority 21 with RAVEN_GUNSHOT_DETECTOR and uuid_match', () => {
      const tier21Match = ENRICHED_CANDIDATES_SQL.match(
        /-- 21\. Raven gunshot detector BLE service UUIDs[\s\S]*?(?=(?:UNION ALL\s+-- 22|\),\s*obs_stats AS))/
      );
      expect(tier21Match).toBeDefined();
      const tier21Sql = tier21Match![0];

      expect(tier21Sql).toContain("'RAVEN_GUNSHOT_DETECTOR'");
      expect(tier21Sql).toContain("'uuid_match'");
      expect(tier21Sql).toContain('21'); // priority 21
      expect(tier21Sql).toContain("n.type IN ('E', 'B')");
      expect(tier21Sql).toContain('matched_custom_uuid_count');
      expect(tier21Sql).toContain('matched_custom_uuids');
      expect(tier21Sql).toContain('has_legacy_pair');
      expect(tier21Sql).toContain('firmware_version');
      expect(tier21Sql).toContain('research-derived signature');
    });

    test('validates Raven UUID logic with mock candidate scoring', () => {
      // 2+ custom UUIDs
      const ravenMulti = makeRow({
        bssid: 'RA:VE:00:00:00:01',
        device_type: 'RAVEN_GUNSHOT_DETECTOR',
        base_likelihood: 90,
        match_quality: 'EXACT',
        detection_method: 'uuid_match',
        matched_signals: {
          service: '00003100-0000-1000-8000-00805f9b34fb 00003200-0000-1000-8000-00805f9b34fb',
          matched_custom_uuid_count: 2,
          matched_custom_uuids: [
            '00003100-0000-1000-8000-00805f9b34fb',
            '00003200-0000-1000-8000-00805f9b34fb',
          ],
          has_legacy_pair: false,
          firmware_version: '1.2.x (inferred)',
        },
        priority: 21,
      });

      // 1 custom UUID
      const ravenSingle = makeRow({
        bssid: 'RA:VE:00:00:00:02',
        device_type: 'RAVEN_GUNSHOT_DETECTOR',
        base_likelihood: 70,
        match_quality: 'PARTIAL',
        detection_method: 'uuid_match',
        matched_signals: {
          service: '00003100-0000-1000-8000-00805f9b34fb',
          matched_custom_uuid_count: 1,
          matched_custom_uuids: ['00003100-0000-1000-8000-00805f9b34fb'],
          has_legacy_pair: false,
          firmware_version: '1.2.x+ (partial, inferred)',
        },
        priority: 21,
      });

      // Legacy pair
      const ravenLegacy = makeRow({
        bssid: 'RA:VE:00:00:00:03',
        device_type: 'RAVEN_GUNSHOT_DETECTOR',
        base_likelihood: 60,
        match_quality: 'PARTIAL',
        detection_method: 'uuid_match',
        matched_signals: {
          service: '00001809-0000-1000-8000-00805f9b34fb 00001819-0000-1000-8000-00805f9b34fb',
          matched_custom_uuid_count: 0,
          matched_custom_uuids: [],
          has_legacy_pair: true,
          firmware_version: '1.1.x (legacy, inferred)',
        },
        priority: 21,
      });

      const results = scoreSurveillanceCandidates([ravenMulti, ravenSingle, ravenLegacy]);
      expect(results).toHaveLength(3);

      const multiRes = results.find((r) => r.bssid === 'RA:VE:00:00:00:01')!;
      expect(multiRes.device_type).toBe('RAVEN_GUNSHOT_DETECTOR');
      expect(multiRes.confidence).toBeGreaterThan(0.9); // 90 base + exact bonus

      const singleRes = results.find((r) => r.bssid === 'RA:VE:00:00:00:02')!;
      expect(singleRes.device_type).toBe('RAVEN_GUNSHOT_DETECTOR');
      expect(singleRes.confidence).toBeLessThan(multiRes.confidence);

      const legacyRes = results.find((r) => r.bssid === 'RA:VE:00:00:00:03')!;
      expect(legacyRes.device_type).toBe('RAVEN_GUNSHOT_DETECTOR');
      expect(legacyRes.confidence).toBeLessThan(singleRes.confidence);
    });
  });

  describe('C. Raven Candidate Precedence Rules', () => {
    const bssid = 'B4:1E:52:AA:BB:CC';

    test('Case 1: Profile 1 (EXACT: 2+ custom UUIDs) overrides generic Tier 20 (RESIDENTIAL_CAMERA)', () => {
      const tier20Row = makeRow({
        bssid,
        device_type: 'RESIDENTIAL_CAMERA',
        base_likelihood: 72,
        match_quality: 'STRONG',
        detection_method: 'manufacturer_oui_match',
        priority: 20,
      });
      const tier21Row = makeRow({
        bssid,
        device_type: 'RAVEN_GUNSHOT_DETECTOR',
        base_likelihood: 90,
        match_quality: 'EXACT',
        detection_method: 'uuid_match',
        priority: 21,
      });

      const results = scoreSurveillanceCandidates([tier20Row, tier21Row]);
      expect(results).toHaveLength(1);
      expect(results[0].device_type).toBe('RAVEN_GUNSHOT_DETECTOR');
      expect(results[0].matched_signals.match_quality).toBe('EXACT');
    });

    test('Case 2: Profile 1 (EXACT: 2+ custom UUIDs) overrides Tier 5 Xuntong (FLOCK_SAFETY_CAMERA default)', () => {
      const tier5Row = makeRow({
        bssid,
        device_type: 'FLOCK_SAFETY_CAMERA',
        base_likelihood: 80,
        match_quality: 'STRONG',
        detection_method: 'mfgrid_match',
        priority: 5,
      });
      const tier21Row = makeRow({
        bssid,
        device_type: 'RAVEN_GUNSHOT_DETECTOR',
        base_likelihood: 90,
        match_quality: 'EXACT',
        detection_method: 'uuid_match',
        priority: 21,
      });

      const results = scoreSurveillanceCandidates([tier5Row, tier21Row]);
      expect(results).toHaveLength(1);
      expect(results[0].device_type).toBe('RAVEN_GUNSHOT_DETECTOR');
      expect(results[0].matched_signals.match_quality).toBe('EXACT');
    });

    test('Case 3: Profile 2 (PARTIAL: legacy pair) does NOT override generic Tier 20 (RESIDENTIAL_CAMERA)', () => {
      const tier20Row = makeRow({
        bssid,
        device_type: 'RESIDENTIAL_CAMERA',
        base_likelihood: 72,
        match_quality: 'STRONG',
        detection_method: 'manufacturer_oui_match',
        priority: 20,
      });
      const tier21Row = makeRow({
        bssid,
        device_type: 'RAVEN_GUNSHOT_DETECTOR',
        base_likelihood: 60,
        match_quality: 'PARTIAL',
        detection_method: 'uuid_match',
        priority: 21,
      });

      const results = scoreSurveillanceCandidates([tier20Row, tier21Row]);
      expect(results).toHaveLength(1);
      expect(results[0].device_type).toBe('RESIDENTIAL_CAMERA');
    });

    test('Case 4: Profile 2 (PARTIAL: legacy pair) does NOT override Tier 5 Xuntong defaulting to FLOCK_SAFETY_CAMERA', () => {
      const tier5Row = makeRow({
        bssid,
        device_type: 'FLOCK_SAFETY_CAMERA',
        base_likelihood: 80,
        match_quality: 'STRONG',
        detection_method: 'mfgrid_match',
        priority: 5,
      });
      const tier21Row = makeRow({
        bssid,
        device_type: 'RAVEN_GUNSHOT_DETECTOR',
        base_likelihood: 60,
        match_quality: 'PARTIAL',
        detection_method: 'uuid_match',
        priority: 21,
      });

      const results = scoreSurveillanceCandidates([tier5Row, tier21Row]);
      expect(results).toHaveLength(1);
      expect(results[0].device_type).toBe('FLOCK_SAFETY_CAMERA');
    });

    test('Case 5: Profile 3 (PARTIAL: 1 custom UUID) does NOT override Tier 20 or Tier 5', () => {
      const tier20Row = makeRow({
        bssid,
        device_type: 'RESIDENTIAL_CAMERA',
        base_likelihood: 72,
        match_quality: 'STRONG',
        detection_method: 'manufacturer_oui_match',
        priority: 20,
      });
      const tier21Partial = makeRow({
        bssid,
        device_type: 'RAVEN_GUNSHOT_DETECTOR',
        base_likelihood: 70,
        match_quality: 'PARTIAL',
        detection_method: 'uuid_match',
        priority: 21,
      });

      // Against Tier 20
      const results20 = scoreSurveillanceCandidates([tier20Row, tier21Partial]);
      expect(results20).toHaveLength(1);
      expect(results20[0].device_type).toBe('RESIDENTIAL_CAMERA');

      // Against Tier 5
      const tier5Row = makeRow({
        bssid,
        device_type: 'FLOCK_SAFETY_CAMERA',
        base_likelihood: 80,
        match_quality: 'STRONG',
        detection_method: 'mfgrid_match',
        priority: 5,
      });
      const results5 = scoreSurveillanceCandidates([tier5Row, tier21Partial]);
      expect(results5).toHaveLength(1);
      expect(results5[0].device_type).toBe('FLOCK_SAFETY_CAMERA');
    });

    test('Case 6: Standard 0x180A alone does not establish Raven identity, and unrelated candidate ordering is preserved', () => {
      // Standard 0x180A alone does not match Tier 21 SQL (Tier 21 only matches custom UUIDs or legacy pair)
      const tier21Match = ENRICHED_CANDIDATES_SQL.match(
        /-- 21\. Raven gunshot detector BLE service UUIDs[\s\S]*?(?=\),\s*obs_stats AS)/
      );
      expect(tier21Match![0]).not.toContain('0000180a-0000-1000-8000-00805f9b34fb');

      // Unrelated candidate ordering: Tier 6 (ble_name_pattern, priority 6) vs Tier 21 EXACT (priority 21)
      // Tier 6 is not an overridable target (only Tier 20 and Tier 5 Flock defaults are overridden)
      const tier6Row = makeRow({
        bssid,
        ssid: 'flock-safety-device',
        device_type: 'FLOCK_SAFETY_CAMERA',
        base_likelihood: 70,
        match_quality: 'PARTIAL',
        detection_method: 'ble_name_pattern',
        priority: 6,
      });
      const tier21Exact = makeRow({
        bssid,
        device_type: 'RAVEN_GUNSHOT_DETECTOR',
        base_likelihood: 90,
        match_quality: 'EXACT',
        detection_method: 'uuid_match',
        priority: 21,
      });

      const results = scoreSurveillanceCandidates([tier6Row, tier21Exact]);
      expect(results).toHaveLength(1);
      expect(results[0].device_type).toBe('FLOCK_SAFETY_CAMERA');
      expect(results[0].matched_signals.tiers_hit[0].tier).toBe(6);
    });
  });

  describe('D. Wi-Fi Flock Scoring Exclusion Narrowing', () => {
    test('canonical Flock-[hex6] Wi-Fi network survives scoring', () => {
      const row = makeRow({
        bssid: 'B4:1E:52:11:22:33',
        ssid: 'Flock-a1b2c3',
        type: 'W',
        device_type: 'FLOCK_SAFETY_CAMERA',
        base_likelihood: 90,
        match_quality: 'EXACT',
        detection_method: 'multi_signal',
        priority: 1,
      });

      const [result] = scoreSurveillanceCandidates([row]);
      expect(result).toBeDefined();
      expect(result.bssid).toBe('B4:1E:52:11:22:33');
      expect(result.device_type).toBe('FLOCK_SAFETY_CAMERA');
      expect(result.threat_score).toBeGreaterThan(70);
    });

    test('test_flck dev SSID Wi-Fi network survives scoring', () => {
      const row = makeRow({
        bssid: 'B4:1E:52:44:55:66',
        ssid: 'test_flck',
        type: 'W',
        device_type: 'FLOCK_SAFETY_CAMERA',
        base_likelihood: 90,
        match_quality: 'EXACT',
        detection_method: 'ssid_exact',
        priority: 2,
      });

      const [result] = scoreSurveillanceCandidates([row]);
      expect(result).toBeDefined();
      expect(result.bssid).toBe('B4:1E:52:44:55:66');
      expect(result.device_type).toBe('FLOCK_SAFETY_CAMERA');
    });

    test('uppercase TEST_FLCK Wi-Fi network does NOT survive scoring (exact lowercase match required)', () => {
      const row = makeRow({
        bssid: 'B4:1E:52:77:88:99',
        ssid: 'TEST_FLCK',
        type: 'W',
        device_type: 'FLOCK_SAFETY_CAMERA',
        base_likelihood: 90,
        match_quality: 'EXACT',
        detection_method: 'ssid_exact',
        priority: 2,
      });

      const results = scoreSurveillanceCandidates([row]);
      expect(results).toHaveLength(0);
    });

    test('generic OUI-only Wi-Fi networks (null or arbitrary SSID) remain excluded', () => {
      const nullSsid = makeRow({
        bssid: 'B4:1E:52:00:00:01',
        ssid: null,
        type: 'W',
        device_type: 'FLOCK_SAFETY_CAMERA',
      });
      const arbitrarySsid = makeRow({
        bssid: 'B4:1E:52:00:00:02',
        ssid: 'MyHomeNetwork',
        type: 'W',
        device_type: 'FLOCK_SAFETY_CAMERA',
      });
      const genericFlockWord = makeRow({
        bssid: 'B4:1E:52:00:00:03',
        ssid: 'flock_guest',
        type: 'W',
        device_type: 'FLOCK_SAFETY_CAMERA',
      });

      const results = scoreSurveillanceCandidates([nullSsid, arbitrarySsid, genericFlockWord]);
      expect(results).toHaveLength(0);
    });

    test('BLE Flock candidates are preserved regardless of SSID', () => {
      const bleFlock = makeRow({
        bssid: 'B4:1E:52:00:00:04',
        ssid: '任意BLE名前',
        type: 'E',
        device_type: 'FLOCK_SAFETY_CAMERA',
      });

      const results = scoreSurveillanceCandidates([bleFlock]);
      expect(results).toHaveLength(1);
      expect(results[0].bssid).toBe('B4:1E:52:00:00:04');
    });
  });

  describe('E. Dashcam, Residential Camera, and Commercial Camera SQL Contracts', () => {
    test('Tier 19 (Dashcam) pattern covers major dashcam brands and excludes false positives', () => {
      const tier19Match = ENRICHED_CANDIDATES_SQL.match(
        /-- 19\. Dashcam SSID patterns[\s\S]*?(?=UNION ALL\s+-- 20)/
      );
      expect(tier19Match).toBeDefined();
      const sql = tier19Match![0];
      expect(sql).toContain("'DASHCAM'");
      expect(sql).toContain('19');
      expect(sql).toContain('vantrue');
      expect(sql).toContain('rove');
      expect(sql).toContain('redtiger');
      expect(sql).toContain('ddpai');
      expect(sql).toContain('provider|provision|grover|improvement|yukon');
    });

    test('Tier 20 (Residential Camera) identifies consumer cameras and excludes non-camera devices', () => {
      const tier20Match = ENRICHED_CANDIDATES_SQL.match(
        /-- 20\. Residential\/consumer camera OUI[\s\S]*?(?=UNION ALL\s+-- 21)/
      );
      expect(tier20Match).toBeDefined();
      const sql = tier20Match![0];
      expect(sql).toContain("'RESIDENTIAL_CAMERA'");
      expect(sql).toContain('20');
      expect(sql).toContain('ring setup');
      expect(sql).toContain('blink');
      expect(sql).toContain('echo|firetv|kindle|router|guest|mesh');
    });

    test('Tier 22 (Commercial Camera) is defined with priority 22 and matches commercial CCTV/NVR vendors', () => {
      const tier22Match = ENRICHED_CANDIDATES_SQL.match(
        /-- 22\. Commercial\/enterprise security camera match[\s\S]*?(?=\),\s*obs_stats AS)/
      );
      expect(tier22Match).toBeDefined();
      const sql = tier22Match![0];
      expect(sql).toContain("'COMMERCIAL_CAMERA'");
      expect(sql).toContain('22');
      expect(sql).toContain('Axis Communications');
      expect(sql).toContain('Hikvision');
      expect(sql).toContain('Dahua');
      expect(sql).toContain('Verkada');
      expect(sql).toContain('Reolink');
    });
  });
});
