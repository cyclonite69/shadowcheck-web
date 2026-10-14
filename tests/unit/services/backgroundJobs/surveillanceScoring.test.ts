import { scoreSurveillanceCandidates } from '../../../../server/src/services/backgroundJobs/surveillanceScoring';
import type { CandidateRow } from '../../../../server/src/repositories/surveillanceDetectionRepository';

function makeCandidate(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    bssid: '08:3A:88:D2:E1:60',
    ssid: null,
    type: 'E',
    bestlevel: -70,
    service: null,
    mfgrid: null,
    device_type: 'FLOCK_SAFETY_CAMERA',
    base_likelihood: 80,
    match_quality: 'PARTIAL',
    detection_method: 'oui_match',
    matched_signals: { oui: '08:3A:88', tier: 'HIGH' },
    priority: 1,
    tier_hit_count: 1,
    obs_count: 5,
    unique_days: 3,
    min_rssi: -80,
    max_rssi: -60,
    avg_rssi: -70,
    first_seen: '2025-06-01T00:00:00Z',
    last_seen: '2025-06-05T00:00:00Z',
    duration_seconds: 345600,
    unique_positions: 3,
    ...overrides,
  };
}

describe('surveillanceScoring', () => {
  describe('scoreSurveillanceCandidates', () => {
    it('excludes WiFi Flock candidates while preserving BLE Flock candidates', () => {
      const wifi = makeCandidate({ bssid: '08:3A:88:64:01:62', type: 'W' });
      const ble = makeCandidate({ bssid: '08:3A:88:64:01:63', type: 'E' });

      const results = scoreSurveillanceCandidates([wifi, ble]);

      expect(results.map((result) => result.bssid)).toEqual(['08:3A:88:64:01:63']);
      expect(results[0].device_type).toBe('FLOCK_SAFETY_CAMERA');
    });

    it('allows canonical Flock-[hex6] and test_flck WiFi candidates to survive scoring', () => {
      const canonicalWifi = makeCandidate({
        bssid: '08:3A:88:64:01:61',
        ssid: 'Flock-1a2b3c',
        type: 'W',
      });
      const testFlckWifi = makeCandidate({
        bssid: '08:3A:88:64:01:62',
        ssid: 'test_flck',
        type: 'W',
      });
      const genericWifi = makeCandidate({
        bssid: '08:3A:88:64:01:63',
        ssid: 'Generic-Router',
        type: 'W',
      });

      const results = scoreSurveillanceCandidates([canonicalWifi, testFlckWifi, genericWifi]);

      expect(results.map((r) => r.bssid).sort()).toEqual([
        '08:3A:88:64:01:61',
        '08:3A:88:64:01:62',
      ]);
      expect(results.every((r) => r.device_type === 'FLOCK_SAFETY_CAMERA')).toBe(true);
    });

    it('penalizes weak RSSI (-92 dBm) compared to strong RSSI (-45 dBm)', () => {
      const weak = makeCandidate({ bssid: 'AA:BB:CC:01:01:01', bestlevel: -92 });
      const strong = makeCandidate({ bssid: 'AA:BB:CC:02:02:02', bestlevel: -45 });

      const [weakResult] = scoreSurveillanceCandidates([weak]);
      const [strongResult] = scoreSurveillanceCandidates([strong]);

      expect(strongResult.confidence).toBeGreaterThan(weakResult.confidence);
      expect(strongResult.threat_score).toBeGreaterThan(weakResult.threat_score);
    });

    it('gives multi-indicator bonus when bssid hits multiple tiers', () => {
      const shared = {
        bestlevel: -75,
        obs_count: 2,
        unique_days: 1,
        duration_seconds: 60,
      };
      const mfgridHit = makeCandidate({
        ...shared,
        bssid: 'C1:AA:E8:07:22:D7',
        ssid: 'Penguin-3101300456',
        type: 'E',
        detection_method: 'mfgrid_match',
        base_likelihood: 80,
        match_quality: 'STRONG',
        priority: 5,
        tier_hit_count: 2,
        mfgrid: 2504,
      });
      const nameHit = makeCandidate({
        ...shared,
        bssid: 'C1:AA:E8:07:22:D7',
        ssid: 'Penguin-3101300456',
        type: 'E',
        detection_method: 'ble_name_pattern',
        base_likelihood: 70,
        match_quality: 'PARTIAL',
        priority: 6,
        tier_hit_count: 2,
      });
      const singleHit = makeCandidate({
        ...shared,
        bssid: 'DD:EE:FF:01:01:01',
        ssid: 'Penguin-0000000000',
        type: 'E',
        detection_method: 'mfgrid_match',
        base_likelihood: 80,
        match_quality: 'STRONG',
        priority: 5,
        tier_hit_count: 1,
        mfgrid: 2504,
      });

      const [multiResult] = scoreSurveillanceCandidates([mfgridHit, nameHit]);
      const [singleResult] = scoreSurveillanceCandidates([singleHit]);

      expect(multiResult.confidence).toBeGreaterThan(singleResult.confidence);
      expect(multiResult.detection_method).toContain('+');
    });

    it('auto-flags PAS-RIG on Cradlepoint OUI as false_positive', () => {
      const pasRig = makeCandidate({
        bssid: '08:3A:88:D2:E1:60',
        ssid: 'PAS-RIG',
        obs_count: 1,
        unique_days: 1,
        duration_seconds: 6,
      });

      const [result] = scoreSurveillanceCandidates([pasRig]);

      expect(result.false_positive).toBe(true);
      expect(result.fp_reason).toContain('ambulance');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('auto-flags PAS-317 (3-digit variant) as false_positive', () => {
      const pas317 = makeCandidate({
        bssid: '08:3A:88:D2:E1:66',
        ssid: 'PAS-317',
        obs_count: 1,
        unique_days: 1,
        duration_seconds: 15,
      });

      const [result] = scoreSurveillanceCandidates([pas317]);

      expect(result.false_positive).toBe(true);
      expect(result.fp_reason).toContain('ambulance');
    });

    it('penalizes WS-RV55 but does NOT auto-flag as false_positive', () => {
      const rv55 = makeCandidate({
        bssid: '08:3A:88:64:01:62',
        ssid: 'WS-RV55-5072',
      });

      const [result] = scoreSurveillanceCandidates([rv55]);

      expect(result.false_positive).toBe(false);
      expect(result.matched_signals.ambiguous_note).toContain('RV55');
      const baseline = makeCandidate({ bssid: 'AA:BB:CC:03:03:03' });
      const [baseResult] = scoreSurveillanceCandidates([baseline]);
      expect(result.confidence).toBeLessThan(baseResult.confidence);
    });

    it('auto-flags ClickShare, CFGF Board Room, and Insignia', () => {
      const devices = [
        makeCandidate({ bssid: '74:4C:A1:74:49:B7', ssid: 'ClickShare-1863008218' }),
        makeCandidate({ bssid: '24:B2:B9:F2:6B:ED', ssid: 'CFGF Board Room' }),
        makeCandidate({ bssid: 'E0:4F:43:9C:20:7C', ssid: 'Insignia-e04f439c207c' }),
      ];

      for (const d of devices) {
        const [result] = scoreSurveillanceCandidates([d]);
        expect(result.false_positive).toBe(true);
        expect(result.fp_reason).toBeTruthy();
      }
    });

    it('gives persistence bonus for 15 obs over 3 days', () => {
      const persistent = makeCandidate({
        bssid: 'AA:BB:CC:04:04:04',
        obs_count: 15,
        unique_days: 3,
        duration_seconds: 259200,
      });
      const transient = makeCandidate({
        bssid: 'AA:BB:CC:05:05:05',
        obs_count: 1,
        unique_days: 1,
        duration_seconds: 10,
      });

      const [persistResult] = scoreSurveillanceCandidates([persistent]);
      const [transientResult] = scoreSurveillanceCandidates([transient]);

      expect(persistResult.confidence).toBeGreaterThan(transientResult.confidence);
      const persistAdj = persistResult.matched_signals.confidence_adjustments;
      expect(persistAdj.some((a: any) => a.factor === 'persistence_strong')).toBe(true);
      const transientAdj = transientResult.matched_signals.confidence_adjustments;
      expect(transientAdj.some((a: any) => a.factor === 'single_detection')).toBe(true);
    });

    it('applies cross-protocol multiplier for WiFi+BLE corroboration', () => {
      const wifiHit = makeCandidate({
        bssid: 'FF:00:FF:01:01:01',
        type: 'W',
        device_type: 'FS_EXT_BATTERY',
        detection_method: 'oui_match',
        priority: 1,
        tier_hit_count: 2,
      });
      const bleHit = makeCandidate({
        bssid: 'FF:00:FF:01:01:01',
        type: 'E',
        device_type: 'FS_EXT_BATTERY',
        detection_method: 'mfgrid_match',
        base_likelihood: 80,
        priority: 5,
        tier_hit_count: 2,
        mfgrid: 2504,
      });

      const [result] = scoreSurveillanceCandidates([wifiHit, bleHit]);

      expect(result.matched_signals.cross_multiplier).toBe(1.3);
    });

    it('uses correct impact factors per device type', () => {
      const flock = makeCandidate({
        bssid: 'AA:BB:CC:06:06:06',
        device_type: 'FLOCK_SAFETY_CAMERA',
      });
      const battery = makeCandidate({
        bssid: 'AA:BB:CC:07:07:07',
        device_type: 'FS_EXT_BATTERY',
        base_likelihood: 80,
      });

      const [flockResult] = scoreSurveillanceCandidates([flock]);
      const [battResult] = scoreSurveillanceCandidates([battery]);

      expect(flockResult.matched_signals.impact_factor).toBe(1.2);
      expect(battResult.matched_signals.impact_factor).toBe(1.0);
    });

    it('stores full scoring breakdown in matched_signals', () => {
      const candidate = makeCandidate({
        bssid: 'AA:BB:CC:08:08:08',
        obs_count: 10,
        unique_days: 5,
        bestlevel: -55,
      });

      const [result] = scoreSurveillanceCandidates([candidate]);

      expect(result.matched_signals.scoring_version).toBe('2.0');
      expect(result.matched_signals.tiers_hit).toBeDefined();
      expect(result.matched_signals.observation_stats).toBeDefined();
      expect(result.matched_signals.confidence_adjustments).toBeInstanceOf(Array);
      expect(result.matched_signals.observation_stats.obs_count).toBe(10);
      expect(result.matched_signals.observation_stats.unique_days).toBe(5);
    });

    it('scores applegatelights honestly — persistence bonus, no FP flag', () => {
      const applegate = makeCandidate({
        bssid: 'EC:1B:BD:BD:6B:5F',
        ssid: 'applegatelights',
        device_type: 'FS_EXT_BATTERY',
        base_likelihood: 80,
        match_quality: 'PARTIAL',
        detection_method: 'oui_match',
        tier_hit_count: 1,
        obs_count: 9,
        unique_days: 8,
        duration_seconds: 16588817,
        bestlevel: -79,
      });

      const [result] = scoreSurveillanceCandidates([applegate]);

      expect(result.false_positive).toBe(false);
      expect(result.fp_reason).toBeNull();
      const adjs = result.matched_signals.confidence_adjustments;
      expect(adjs.some((a: any) => a.factor === 'persistence_strong')).toBe(true);
    });

    it('clamps confidence to [0.10, 1.00] range', () => {
      const terrible = makeCandidate({
        bssid: 'AA:BB:CC:09:09:09',
        ssid: 'PAS-RIG',
        bestlevel: -95,
        obs_count: 1,
        unique_days: 1,
        duration_seconds: 5,
        match_quality: 'WEAK',
        tier_hit_count: 1,
      });

      const [result] = scoreSurveillanceCandidates([terrible]);

      expect(result.confidence).toBeGreaterThanOrEqual(0.1);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });
});
