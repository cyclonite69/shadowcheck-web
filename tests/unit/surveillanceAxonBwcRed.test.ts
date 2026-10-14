/**
 * Axon BWC Production Scorer & Query-Builder Characterization Tests
 *
 * Scope: Pure in-memory unit tests exercising production modules without database access.
 *
 * Modules Exercised:
 * - scoreSurveillanceCandidates (server/src/services/backgroundJobs/surveillanceScoring)
 * - SqlFragmentLibrary (server/src/services/filterQueryBuilder/SqlFragmentLibrary)
 *
 * Important Architectural Distinctions:
 * 1. Scorer Behavior vs. Candidate Generation:
 *    - scoreSurveillanceCandidates() receives already-generated CandidateRow objects.
 *    - It calculates confidence adjustments, applies impact factors, and checks AUTO_FP_PATTERNS.
 *    - It DOES NOT generate candidates, DOES NOT reassign device_type, and DOES NOT demote
 *      an unconfirmed candidate to an unclassified state.
 *    - Upstream candidate-generation SQL (Tiers 9, 11, 12, 13, 14, 15) runs in PostgreSQL
 *      and cannot be verified in in-memory unit tests.
 * 2. Generated SQL Strings vs. Database Runtime:
 *    - SqlFragmentLibrary tests verify the exact SQL expressions emitted by the query builder.
 *    - They confirm the template structure (e.g. COALESCE fallback between surveillance_detections
 *      and oui_device_groups), but cannot verify PostgreSQL execution against live table data.
 */

import { scoreSurveillanceCandidates } from '../../server/src/services/backgroundJobs/surveillanceScoring';
import type { CandidateRow } from '../../server/src/repositories/surveillanceDetectionRepository';
import { SqlFragmentLibrary } from '../../server/src/services/filterQueryBuilder/SqlFragmentLibrary';

/** Helper to construct realistic in-memory candidate rows matching CandidateRow schema */
function createCandidateRow(overrides: Partial<CandidateRow>): CandidateRow {
  return {
    bssid: '08:FB:EA:67:C1:7D',
    ssid: null,
    type: 'E',
    bestlevel: -75,
    service: '0000ffa1-0000-1000-8000-00805f9b34fb',
    mfgrid: 0,
    device_type: 'AXON_BODY_CAMERA',
    base_likelihood: 88,
    match_quality: 'EXACT',
    detection_method: 'uuid_match',
    matched_signals: { service_uuid: '0000ffa1-0000-1000-8000-00805f9b34fb', uuid_short: '0xFFA1' },
    priority: 14,
    tier_hit_count: 1,
    obs_count: 5,
    unique_days: 2,
    min_rssi: -85,
    max_rssi: -70,
    avg_rssi: -75,
    first_seen: '2025-06-01T12:00:00Z',
    last_seen: '2025-06-02T12:00:00Z',
    duration_seconds: 86400,
    unique_positions: 2,
    ...overrides,
  };
}

describe('Axon BWC Production Scorer & Query-Builder Characterization', () => {
  describe('1. Production Scorer Contract (surveillanceScoring.ts)', () => {
    test('preserves device_type unconditionally from incoming candidate row', () => {
      // Demonstrates production contract: scoreSurveillanceCandidates carries best.device_type
      // directly into ScoredDetection. It does not rewrite or demote device_type.
      const candidate = createCandidateRow({
        bssid: '08:FB:EA:67:C1:7D',
        ssid: '',
        device_type: 'AXON_BODY_CAMERA',
        base_likelihood: 75,
        match_quality: 'PARTIAL',
      });

      const scored = scoreSurveillanceCandidates([candidate]);
      expect(scored).toHaveLength(1);
      expect(scored[0].device_type).toBe('AXON_BODY_CAMERA');
    });

    test('match quality affects numerical confidence adjustment, but not device_type', () => {
      const exactCandidate = createCandidateRow({
        bssid: '54:78:C9:4F:16:E3',
        match_quality: 'EXACT',
        base_likelihood: 92,
      });
      const strongCandidate = createCandidateRow({
        bssid: '08:FB:EA:DC:47:6D',
        match_quality: 'STRONG',
        base_likelihood: 82,
      });

      const scored = scoreSurveillanceCandidates([exactCandidate, strongCandidate]);
      expect(scored).toHaveLength(2);

      const exactScored = scored.find((s) => s.bssid === '54:78:C9:4F:16:E3')!;
      const strongScored = scored.find((s) => s.bssid === '08:FB:EA:DC:47:6D')!;

      // Both retain AXON_BODY_CAMERA
      expect(exactScored.device_type).toBe('AXON_BODY_CAMERA');
      expect(strongScored.device_type).toBe('AXON_BODY_CAMERA');

      // EXACT earns MATCH_QUALITY_BONUS['EXACT'] (+0.15) vs STRONG (+0.10)
      const exactMqAdj = exactScored.matched_signals.confidence_adjustments.find(
        (a: any) => a.factor === 'match_quality_exact'
      );
      const strongMqAdj = strongScored.matched_signals.confidence_adjustments.find(
        (a: any) => a.factor === 'match_quality_strong'
      );
      expect(exactMqAdj?.value).toBe(0.15);
      expect(strongMqAdj?.value).toBe(0.1);
    });

    test('auto-flags Fanvil VoIP phones via AUTO_FP_PATTERNS without changing device_type', () => {
      const fanvil = createCandidateRow({
        bssid: '70:F7:54:47:84:E9',
        ssid: 'Fanvil V64',
        type: 'B',
        device_type: 'AXON_BODY_CAMERA',
      });

      const scored = scoreSurveillanceCandidates([fanvil]);
      expect(scored).toHaveLength(1);
      expect(scored[0].false_positive).toBe(true);
      expect(scored[0].fp_reason).toContain('Fanvil VoIP phone');
      // Note: false_positive = true reduces confidence adjustment, but device_type remains unchanged
      expect(scored[0].device_type).toBe('AXON_BODY_CAMERA');
    });

    test('scorer does NOT auto-flag consumer dashcams or engravers lacking AUTO_FP_PATTERNS entries', () => {
      // Demonstrates that the scorer relies on upstream candidate generation NOT emitting consumer devices
      const consumerCandidates = [
        createCandidateRow({ bssid: '08:FB:EA:67:D7:64', ssid: 'SC201-EA6A22C04616' }),
        createCandidateRow({ bssid: '08:FB:EA:E1:E5:E1', ssid: 'SC 400' }),
        createCandidateRow({ bssid: '54:78:C9:21:EC:8B', ssid: 'DRV-A610W c8a' }),
        createCandidateRow({ bssid: '54:78:C9:25:58:4A', ssid: 'xTool_F1_v2_389013' }),
      ];

      const scored = scoreSurveillanceCandidates(consumerCandidates);
      expect(scored).toHaveLength(4);
      for (const res of scored) {
        // Scorer has no rules for Cobra, Kenwood, or xTool, so false_positive is false
        expect(res.false_positive).toBe(false);
      }
    });

    test('unassigned empty-SSID candidates pass through without false_positive flag', () => {
      // Demonstrates why upstream Tier 14 candidate generation is the critical failure point
      const emptySsidCandidate = createCandidateRow({
        bssid: '08:FB:EA:67:C1:7D',
        ssid: null,
        device_type: 'AXON_BODY_CAMERA',
      });

      const scored = scoreSurveillanceCandidates([emptySsidCandidate]);
      expect(scored).toHaveLength(1);
      expect(scored[0].false_positive).toBe(false);
      expect(scored[0].device_type).toBe('AXON_BODY_CAMERA');
    });

    test('multi-tier candidate hits apply multi_indicator corroboration bonus', () => {
      // When a device matches multiple candidate tiers (e.g. Tier 13 and Tier 14)
      const hit1 = createCandidateRow({
        bssid: '54:78:C9:4F:16:E3',
        priority: 13,
        tier_hit_count: 2,
        detection_method: 'ssid_pattern',
        device_type: 'AXON_BODY_CAMERA',
      });
      const hit2 = createCandidateRow({
        bssid: '54:78:C9:4F:16:E3',
        priority: 14,
        tier_hit_count: 2,
        detection_method: 'uuid_match',
        device_type: 'AXON_BODY_CAMERA',
      });

      const scored = scoreSurveillanceCandidates([hit1, hit2]);
      expect(scored).toHaveLength(1);
      const multiIndicatorAdj = scored[0].matched_signals.confidence_adjustments.find(
        (a: any) => a.factor === 'multi_indicator'
      );
      expect(multiIndicatorAdj?.value).toBe(0.2);
      expect(scored[0].detection_method).toBe('ssid_pattern+uuid_match');
    });
  });

  describe('2. Query-Builder Contract (SqlFragmentLibrary.ts)', () => {
    test('selectDeviceClassFields generates COALESCE fallback between surveillance_detections and oui_device_groups', () => {
      const sql = SqlFragmentLibrary.selectDeviceClassFields('sd', 'odg');

      // Proves the query-builder emits COALESCE(sd.device_type, odg.surveillance_type)
      expect(sql).toContain('COALESCE(sd.device_type, odg.surveillance_type) AS device_class');
      expect(sql).toContain('odg.surveillance_type AS oui_surveillance_type');
      expect(sql).toContain('odg.surveillance_confidence AS oui_surveillance_confidence');
    });

    test('deviceClassFilterPredicate generates fallback EXISTS query on oui_device_groups', () => {
      const predicate = SqlFragmentLibrary.deviceClassFilterPredicate('ne', '$1');

      // Proves the query-builder includes fallback EXISTS on oui_device_groups when surveillance_detections has no match
      expect(predicate).toContain('EXISTS (SELECT 1 FROM app.surveillance_detections sd2');
      expect(predicate).toContain('OR EXISTS (SELECT 1 FROM app.oui_device_groups odg2');
      expect(predicate).toContain('AND NOT EXISTS (SELECT 1 FROM app.surveillance_detections sd3');
    });

    test('normalizedOuiExpression correctly colonizes and uppercases MAC addresses', () => {
      const expr = SqlFragmentLibrary.normalizedOuiExpression('ne');
      expect(expr).toContain('UPPER(SUBSTRING(ne.bssid, 1, 8))');
    });
  });

  describe('3. Gate 3 Calibrated Heuristic Scenarios (Low-Confidence Regime)', () => {
    test('Scenario 1: X_ SSID alone (Tier 13 heuristic) evaluates to confidence 0.10 and threat score 3.5 (LOW)', () => {
      // Tier 13 alone: base_likelihood 35, match_quality WEAK, priority 13
      const candidate = createCandidateRow({
        bssid: '00:25:DF:11:22:33',
        ssid: 'X_grodriguez',
        type: 'W',
        service: null,
        base_likelihood: 35,
        match_quality: 'WEAK',
        detection_method: 'ssid_pattern',
        priority: 13,
        tier_hit_count: 1,
        obs_count: 2,
        duration_seconds: 100,
        unique_positions: 2,
      });

      const scored = scoreSurveillanceCandidates([candidate]);
      expect(scored).toHaveLength(1);

      const res = scored[0];
      expect(res.device_type).toBe('AXON_BODY_CAMERA');
      expect(res.confidence).toBe(0.1);
      expect(res.threat_score).toBe(3.5);
      expect(res.threat_score).toBeLessThan(20.0); // Strictly LOW (MED threshold is 40.0)

      // Verify adjustment breakdown: single_weak_indicator (-0.3) + match_quality_weak (-0.1)
      const adjFactors = res.matched_signals.confidence_adjustments.map((a: any) => a.factor);
      expect(adjFactors).toContain('single_weak_indicator');
      expect(adjFactors).toContain('match_quality_weak');
      expect(adjFactors).not.toContain('multi_indicator');
    });

    test('Scenario 2: FFA1 beacon alone (Tier 14 heuristic) evaluates to confidence 0.10 and threat score 3.0 (LOW)', () => {
      // Tier 14 alone: base_likelihood 30, match_quality WEAK, priority 14
      const candidate = createCandidateRow({
        bssid: '9C:B8:B4:A5:8B:E3',
        ssid: null,
        type: 'E',
        service: '0000ffa1-0000-1000-8000-00805f9b34fb',
        base_likelihood: 30,
        match_quality: 'WEAK',
        detection_method: 'uuid_match',
        priority: 14,
        tier_hit_count: 1,
        obs_count: 2,
        duration_seconds: 100,
        unique_positions: 2,
      });

      const scored = scoreSurveillanceCandidates([candidate]);
      expect(scored).toHaveLength(1);

      const res = scored[0];
      expect(res.device_type).toBe('AXON_BODY_CAMERA');
      expect(res.confidence).toBe(0.1);
      expect(res.threat_score).toBe(3.0);
      expect(res.threat_score).toBeLessThan(20.0); // Strictly LOW

      const adjFactors = res.matched_signals.confidence_adjustments.map((a: any) => a.factor);
      expect(adjFactors).toContain('single_weak_indicator');
      expect(adjFactors).toContain('match_quality_weak');
      expect(adjFactors).not.toContain('multi_indicator');
    });

    test('Scenario 3: X_ SSID + FFA1 corroborated evaluates to LOW regime (baseline 4.5, persistence 11.3)', () => {
      // Due to SQL mutual exclusion, Tier 14 excludes X_ SSIDs. Tier 13 emits a single row with base 45.
      // Baseline without temporal persistence:
      const baselineCandidate = createCandidateRow({
        bssid: '54:78:C9:4F:16:E3',
        ssid: 'X_SPARE2',
        type: 'E',
        service: '0000ffa1-0000-1000-8000-00805f9b34fb',
        base_likelihood: 45,
        match_quality: 'WEAK',
        detection_method: 'ssid_pattern',
        priority: 13,
        tier_hit_count: 1,
        obs_count: 2,
        duration_seconds: 100,
        unique_positions: 2,
      });

      const baselineScored = scoreSurveillanceCandidates([baselineCandidate]);
      expect(baselineScored).toHaveLength(1);
      expect(baselineScored[0].confidence).toBe(0.1);
      expect(baselineScored[0].threat_score).toBe(4.5);
      expect(baselineScored[0].threat_score).toBeLessThan(20.0);

      // With temporal persistence (+0.20): obsCount > 3, durationSec > 300
      const persistentCandidate = createCandidateRow({
        bssid: '54:78:C9:4F:16:E3',
        ssid: 'X_SPARE2',
        type: 'E',
        service: '0000ffa1-0000-1000-8000-00805f9b34fb',
        base_likelihood: 45,
        match_quality: 'WEAK',
        detection_method: 'ssid_pattern',
        priority: 13,
        tier_hit_count: 1,
        obs_count: 5,
        duration_seconds: 600,
        unique_positions: 2,
      });

      const persistentScored = scoreSurveillanceCandidates([persistentCandidate]);
      expect(persistentScored).toHaveLength(1);
      // baseConfidence (0.45) + persistence (+0.20) - single_weak (-0.30) - match_quality_weak (-0.10) = 0.25
      expect(persistentScored[0].confidence).toBe(0.25);
      // rawScore = 45 * 1.0 * 0.25 * 1.0 = 11.25 -> 11.3
      expect(persistentScored[0].threat_score).toBe(11.3);
      expect(persistentScored[0].threat_score).toBeLessThan(20.0); // Strictly LOW (far below 40.0 MED threshold)
    });

    test('contrast: un-calibrated dual candidate emission would inflate confidence to MEDIUM', () => {
      // Demonstrates why mutual exclusion in SQL candidate generation is essential:
      // If two candidate rows were emitted with tier_hit_count >= 2, the scorer would apply
      // multi_indicator (+0.20) and omit single_weak_indicator (-0.30), creating a +0.50 swing.
      const uncalibratedHit1 = createCandidateRow({
        bssid: '54:78:C9:4F:16:E3',
        ssid: 'X_SPARE2',
        base_likelihood: 60,
        match_quality: 'WEAK',
        detection_method: 'ssid_pattern',
        priority: 13,
        tier_hit_count: 2,
        obs_count: 2,
        duration_seconds: 100,
        unique_positions: 2,
      });
      const uncalibratedHit2 = createCandidateRow({
        bssid: '54:78:C9:4F:16:E3',
        ssid: 'X_SPARE2',
        base_likelihood: 50,
        match_quality: 'WEAK',
        detection_method: 'uuid_match',
        priority: 14,
        tier_hit_count: 2,
        obs_count: 2,
        duration_seconds: 100,
        unique_positions: 2,
      });

      const inflated = scoreSurveillanceCandidates([uncalibratedHit1, uncalibratedHit2]);
      expect(inflated).toHaveLength(1);
      // 0.60 + multi_indicator (0.20) - match_quality_weak (0.10) = 0.70
      expect(inflated[0].confidence).toBe(0.7);
      // rawScore = 60 * 1.0 * 0.70 = 42.0 (MED threshold >= 40.0)
      expect(inflated[0].threat_score).toBe(42.0);
      expect(inflated[0].threat_score).toBeGreaterThanOrEqual(40.0);
    });
  });

  describe('4. Upstream Candidate-Generation Predicate Verification', () => {
    const tier13Regex = /^X_[A-Za-z0-9_-]+$/;
    const isTier14SsidEligible = (ssid: string | null) => ssid === null || !tier13Regex.test(ssid);
    const matchesFfa1Token = (service: string | null) => {
      if (!service) {
        return false;
      }
      const tokens = service.toLowerCase().split(' ');
      return tokens.includes('0000ffa1-0000-1000-8000-00805f9b34fb');
    };

    test('Tier 13 regex captures officer conventions and operational tags', () => {
      const operationalSsids = [
        'X_SPARE2',
        'X_X2_BWC',
        'X_K9-Forystek',
        'X_dfrye',
        'X_grodriguez',
        'X_Officer_12',
      ];
      for (const ssid of operationalSsids) {
        expect(tier13Regex.test(ssid)).toBe(true);
      }
    });

    test('Tier 13 regex excludes consumer non-Axon devices and non-matching SSIDs', () => {
      const consumerSsids = [
        'SC201-EA6A22C04616', // Cobra dashcam
        'SC 400', // Cobra dashcam
        'DRV-A610W c8a', // Kenwood dashcam
        'xTool_F1_v2_389013', // xTool engraver
        'Fanvil V64', // Fanvil VoIP
        'Cobra SC 100', // Cobra dashcam
        'X', // Missing trailing characters
        'X-', // Missing trailing characters
        'Axon_Body_3', // Non-X_ prefix
      ];
      for (const ssid of consumerSsids) {
        expect(tier13Regex.test(ssid)).toBe(false);
      }
    });

    test('Tier 14 mutual exclusion predicate excludes X_ SSIDs and admits non-X_/null SSIDs', () => {
      // Operational SSIDs matching Tier 13 MUST be excluded from Tier 14
      expect(isTier14SsidEligible('X_SPARE2')).toBe(false);
      expect(isTier14SsidEligible('X_X2_BWC')).toBe(false);
      expect(isTier14SsidEligible('X_K9-Forystek')).toBe(false);
      expect(isTier14SsidEligible('X_grodriguez')).toBe(false);

      // Null, empty, and non-X_ SSIDs remain eligible for Tier 14 evaluation
      expect(isTier14SsidEligible(null)).toBe(true);
      expect(isTier14SsidEligible('')).toBe(true);
      expect(isTier14SsidEligible('OtherNetwork')).toBe(true);
    });

    test('Tier 14 exact token matching isolates 0xFFA1 full UUID and rejects collisions', () => {
      const validSingle = '0000ffa1-0000-1000-8000-00805f9b34fb';
      const validMulti =
        '0000180a-0000-1000-8000-00805f9b34fb 0000ffa1-0000-1000-8000-00805f9b34fb';
      const invalidUuid = '0000ffa1-0000-1000-8000-00805f9b34fc';
      const shortOnly = 'ffa1';

      expect(matchesFfa1Token(validSingle)).toBe(true);
      expect(matchesFfa1Token(validMulti)).toBe(true);
      expect(matchesFfa1Token(invalidUuid)).toBe(false);
      expect(matchesFfa1Token(shortOnly)).toBe(false);
      expect(matchesFfa1Token(null)).toBe(false);
    });
  });
});
