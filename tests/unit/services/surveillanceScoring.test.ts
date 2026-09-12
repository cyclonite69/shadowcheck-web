export {};

import {
  scoreSurveillanceCandidates,
  IMPACT_FACTORS,
  MATCH_QUALITY_BONUS,
} from '../../../server/src/services/backgroundJobs/surveillanceScoring';
import type { CandidateRow } from '../../../server/src/repositories/surveillanceDetectionRepository';

/** Minimal valid candidate row */
function makeRow(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    bssid: 'AA:BB:CC:DD:EE:FF',
    ssid: 'TestNet',
    type: 'E',
    bestlevel: -65,
    service: null,
    mfgrid: null,
    device_type: 'FLOCK_SAFETY_CAMERA',
    base_likelihood: 80,
    match_quality: 'STRONG',
    detection_method: 'oui_match',
    matched_signals: {},
    priority: 1,
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

describe('scoreSurveillanceCandidates', () => {
  test('returns empty array for empty input', () => {
    expect(scoreSurveillanceCandidates([])).toEqual([]);
  });

  test('excludes WiFi Flock candidates while preserving BLE Flock candidates', () => {
    const wifi = makeRow({ bssid: 'AA:BB:CC:DD:EE:01', type: 'W' });
    const ble = makeRow({ bssid: 'AA:BB:CC:DD:EE:02', type: 'E' });

    const results = scoreSurveillanceCandidates([wifi, ble]);

    expect(results.map((result) => result.bssid)).toEqual(['AA:BB:CC:DD:EE:02']);
  });

  test('produces one result per unique bssid', () => {
    const rows = [
      makeRow({ bssid: 'AA:BB:CC:DD:EE:01' }),
      makeRow({ bssid: 'AA:BB:CC:DD:EE:02' }),
      makeRow({ bssid: 'AA:BB:CC:DD:EE:01', detection_method: 'ssid_pattern' }),
    ];
    const results = scoreSurveillanceCandidates(rows);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.bssid).sort()).toEqual(['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02']);
  });

  test('applies FLOCK_SAFETY_CAMERA impact factor 1.2', () => {
    const row = makeRow({
      device_type: 'FLOCK_SAFETY_CAMERA',
      base_likelihood: 80,
      match_quality: 'STRONG',
      bestlevel: -65,
      obs_count: 5,
      duration_seconds: 600,
    });
    const [result] = scoreSurveillanceCandidates([row]);
    expect(result.device_type).toBe('FLOCK_SAFETY_CAMERA');
    // threat_score = base * impact * confidence * crossMultiplier, capped at 100
    expect(result.threat_score).toBeGreaterThan(0);
    expect(result.threat_score).toBeLessThanOrEqual(100);
  });

  test('RSSI excellent (>-50) adds 0.1 confidence bonus', () => {
    // Use base_likelihood=50 so bonuses are visible without hitting the 1.0 cap
    const weak = makeRow({
      base_likelihood: 50,
      bestlevel: -85,
      obs_count: 5,
      duration_seconds: 600,
    });
    const strong = makeRow({
      base_likelihood: 50,
      bestlevel: -45,
      obs_count: 5,
      duration_seconds: 600,
    });
    const [weakResult] = scoreSurveillanceCandidates([weak]);
    const [strongResult] = scoreSurveillanceCandidates([strong]);
    expect(strongResult.confidence).toBeGreaterThan(weakResult.confidence);
  });

  test('single detection with short duration reduces confidence', () => {
    const persistent = makeRow({ obs_count: 5, duration_seconds: 600 });
    const fleeting = makeRow({ obs_count: 1, duration_seconds: 10 });
    const [persistentResult] = scoreSurveillanceCandidates([persistent]);
    const [fleetingResult] = scoreSurveillanceCandidates([fleeting]);
    expect(persistentResult.confidence).toBeGreaterThan(fleetingResult.confidence);
  });

  test('multi-indicator (tier_hit_count >= 2) adds 0.2 confidence bonus', () => {
    // Use base_likelihood=50 so the 0.2 bonus is visible without hitting the 1.0 cap
    const single = makeRow({ base_likelihood: 50, tier_hit_count: 1 });
    const multi = makeRow({ base_likelihood: 50, tier_hit_count: 2 });
    const [singleResult] = scoreSurveillanceCandidates([single]);
    const [multiResult] = scoreSurveillanceCandidates([multi]);
    expect(multiResult.confidence).toBeGreaterThan(singleResult.confidence);
  });

  test('cross-protocol WiFi+BLE adds 0.3 confidence bonus', () => {
    // Use base_likelihood=40 so the 0.3 bonus is visible without hitting the 1.0 cap
    const wifiOnly = [
      makeRow({
        bssid: 'AA:BB:CC:DD:EE:01',
        type: 'W',
        device_type: 'FS_EXT_BATTERY',
        base_likelihood: 40,
      }),
    ];
    const crossProtocol = [
      makeRow({
        bssid: 'AA:BB:CC:DD:EE:02',
        type: 'W',
        device_type: 'FS_EXT_BATTERY',
        base_likelihood: 40,
      }),
      makeRow({
        bssid: 'AA:BB:CC:DD:EE:02',
        type: 'E',
        device_type: 'FS_EXT_BATTERY',
        base_likelihood: 40,
        detection_method: 'ble_name_pattern',
      }),
    ];
    const [wifiResult] = scoreSurveillanceCandidates(wifiOnly);
    const [crossResult] = scoreSurveillanceCandidates(crossProtocol);
    expect(crossResult.confidence).toBeGreaterThan(wifiResult.confidence);
  });

  test('auto-FP: PAS-RIG SSID with Cradlepoint OUI sets false_positive=true', () => {
    const row = makeRow({
      bssid: '08:3A:88:11:22:33',
      ssid: 'PAS-RIG-001',
    });
    const [result] = scoreSurveillanceCandidates([row]);
    expect(result.false_positive).toBe(true);
    expect(result.fp_reason).toMatch(/Cradlepoint/i);
  });

  test('auto-FP: ClickShare SSID sets false_positive=true regardless of OUI', () => {
    const row = makeRow({ ssid: 'ClickShare-ABC123' });
    const [result] = scoreSurveillanceCandidates([row]);
    expect(result.false_positive).toBe(true);
  });

  test('auto-FP: PAS-RIG on non-Cradlepoint OUI does NOT set false_positive', () => {
    const row = makeRow({
      bssid: 'AA:BB:CC:11:22:33', // not 08:3A:88
      ssid: 'PAS-RIG-001',
    });
    const [result] = scoreSurveillanceCandidates([row]);
    expect(result.false_positive).toBe(false);
  });

  test('penalty pattern: WS-RV55 SSID reduces confidence', () => {
    const normal = makeRow({ ssid: 'FlockCamera-001' });
    const ambiguous = makeRow({ ssid: 'WS-RV55-XYZ' });
    const [normalResult] = scoreSurveillanceCandidates([normal]);
    const [ambiguousResult] = scoreSurveillanceCandidates([ambiguous]);
    expect(ambiguousResult.confidence).toBeLessThan(normalResult.confidence);
  });

  test('MATCH_QUALITY_BONUS EXACT adds 0.15, WEAK subtracts 0.1', () => {
    const exact = makeRow({ match_quality: 'EXACT', tier_hit_count: 1 });
    const weak = makeRow({ match_quality: 'WEAK', tier_hit_count: 1 });
    const [exactResult] = scoreSurveillanceCandidates([exact]);
    const [weakResult] = scoreSurveillanceCandidates([weak]);
    expect(exactResult.confidence).toBeGreaterThan(weakResult.confidence);
    expect(MATCH_QUALITY_BONUS['EXACT']).toBe(0.15);
    expect(MATCH_QUALITY_BONUS['WEAK']).toBe(-0.1);
  });

  test('confidence is clamped between 0.1 and 1.0', () => {
    // Pile on negatives: WEAK match, single detection, very weak RSSI
    const row = makeRow({
      match_quality: 'WEAK',
      obs_count: 1,
      duration_seconds: 5,
      bestlevel: -95,
      tier_hit_count: 1,
    });
    const [result] = scoreSurveillanceCandidates([row]);
    expect(result.confidence).toBeGreaterThanOrEqual(0.1);
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });

  test('threat_score is capped at 100', () => {
    // Max everything out
    const row = makeRow({
      base_likelihood: 100,
      device_type: 'FLOCK_SAFETY_CAMERA', // impact 1.2
      match_quality: 'EXACT',
      bestlevel: -45,
      obs_count: 10,
      duration_seconds: 1000,
      tier_hit_count: 3,
    });
    const [result] = scoreSurveillanceCandidates([row]);
    expect(result.threat_score).toBeLessThanOrEqual(100);
  });

  test('cross-domain multiplier: OUI + BLE hit applies 1.3x', () => {
    const withCross = [
      makeRow({ bssid: 'AA:BB:CC:DD:EE:01', detection_method: 'oui_match' }),
      makeRow({ bssid: 'AA:BB:CC:DD:EE:01', detection_method: 'mfgrid_match' }),
    ];
    const withoutCross = [makeRow({ bssid: 'AA:BB:CC:DD:EE:02', detection_method: 'oui_match' })];
    const [crossResult] = scoreSurveillanceCandidates(withCross);
    const [noCrossResult] = scoreSurveillanceCandidates(withoutCross);
    expect(crossResult.threat_score).toBeGreaterThan(noCrossResult.threat_score);
  });

  test('matched_signals includes confidence_adjustments and scoring_version', () => {
    const row = makeRow();
    const [result] = scoreSurveillanceCandidates([row]);
    expect(result.matched_signals).toHaveProperty('confidence_adjustments');
    expect(result.matched_signals).toHaveProperty('scoring_version', '2.0');
    expect(result.matched_signals).toHaveProperty('tiers_hit');
    expect(Array.isArray(result.matched_signals.tiers_hit)).toBe(true);
  });

  test('IMPACT_FACTORS exports expected device types', () => {
    expect(IMPACT_FACTORS).toHaveProperty('FLOCK_SAFETY_CAMERA', 1.2);
    expect(IMPACT_FACTORS).toHaveProperty('AXON_BODY_CAMERA', 1.0);
    expect(IMPACT_FACTORS).toHaveProperty('DEI_BWC', 1.0);
    expect(IMPACT_FACTORS).toHaveProperty('BT_IMAGING_DEVICE', 0.9);
    expect(IMPACT_FACTORS).toHaveProperty('DASHCAM', 1.0);
    expect(IMPACT_FACTORS).toHaveProperty('RESIDENTIAL_CAMERA', 0.8);
  });

  test('unknown device_type defaults to impact factor 1.0', () => {
    const known = makeRow({ device_type: 'FLOCK_SAFETY_CAMERA', base_likelihood: 80 }); // 1.2
    const unknown = makeRow({ device_type: 'UNKNOWN_DEVICE', base_likelihood: 80 }); // 1.0
    const [knownResult] = scoreSurveillanceCandidates([known]);
    const [unknownResult] = scoreSurveillanceCandidates([unknown]);
    // Same base, same adjustments — Flock should score higher due to 1.2 impact
    expect(knownResult.threat_score).toBeGreaterThan(unknownResult.threat_score);
  });

  test('penalizes (does not exclude) AXON_BODY_CAMERA candidate with a stationary signature', () => {
    const rows: CandidateRow[] = [
      {
        bssid: 'AA:BB:CC:DD:EE:01',
        ssid: 'X_HPprint',
        type: 'B',
        bestlevel: null,
        service: null,
        mfgrid: 0,
        device_type: 'AXON_BODY_CAMERA',
        base_likelihood: 82,
        match_quality: 'STRONG',
        detection_method: 'ssid_pattern',
        matched_signals: {},
        priority: 13,
        tier_hit_count: 1,
        obs_count: 40,
        unique_days: 12,
        min_rssi: -60,
        max_rssi: -50,
        avg_rssi: -55,
        first_seen: '2026-08-01T00:00:00Z',
        last_seen: '2026-08-13T00:00:00Z',
        duration_seconds: 1036800,
        unique_positions: 1,
      },
    ];

    const [result] = scoreSurveillanceCandidates(rows);

    // still detected — not silently dropped
    expect(result.device_type).toBe('AXON_BODY_CAMERA');
    expect(result.false_positive).toBe(false);

    // but no longer allowed to coast to near-max confidence off one SSID regex
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.matched_signals.confidence_adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factor: 'stationary_signature_penalty',
          value: expect.any(Number),
        }),
      ])
    );
  });

  test('does not penalize stationary residential cameras', () => {
    const [result] = scoreSurveillanceCandidates([
      makeRow({
        device_type: 'RESIDENTIAL_CAMERA',
        base_likelihood: 72,
        unique_positions: 1,
      }),
    ]);

    expect(result.device_type).toBe('RESIDENTIAL_CAMERA');
    expect(result.matched_signals.confidence_adjustments).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factor: 'stationary_signature_penalty' }),
      ])
    );
  });

  test.each([
    ['Fanvil V64', 'Fanvil VoIP phone'],
    ['Yealink T46U', 'Yealink VoIP phone'],
    ['HP-Print-1234', 'HP printer'],
  ])('marks %s as an automatic false positive', (ssid, reason) => {
    const [result] = scoreSurveillanceCandidates([
      makeRow({ ssid, device_type: 'AXON_BODY_CAMERA' }),
    ]);

    expect(result.false_positive).toBe(true);
    expect(result.fp_reason).toBe(reason);
  });
});
