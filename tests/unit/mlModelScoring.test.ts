export {};

import {
  computeProbability,
  determineThreatLevel,
  scoreNetworkWithModel,
  buildRawFeatures,
  buildNormalizedFeatures,
} from '../../server/src/services/ml/modelScoring';

describe('ml model scoring helpers', () => {
  describe('determineThreatLevel', () => {
    it('maps threat levels from score thresholds', () => {
      expect(determineThreatLevel(85)).toBe('CRITICAL');
      expect(determineThreatLevel(80)).toBe('CRITICAL');
      expect(determineThreatLevel(65)).toBe('HIGH');
      expect(determineThreatLevel(60)).toBe('HIGH');
      expect(determineThreatLevel(45)).toBe('MED');
      expect(determineThreatLevel(40)).toBe('MED');
      expect(determineThreatLevel(25)).toBe('LOW');
      expect(determineThreatLevel(20)).toBe('LOW');
      expect(determineThreatLevel(15)).toBe('NONE');
      expect(determineThreatLevel(0)).toBe('NONE');
    });
  });

  describe('computeProbability', () => {
    it('clamps extreme logits to finite probabilities', () => {
      expect(computeProbability(999)).toBe(1);
      expect(computeProbability(501)).toBe(1);
      expect(computeProbability(-999)).toBe(0);
      expect(computeProbability(-501)).toBe(0);
    });

    it('calculates probability for moderate logits', () => {
      expect(computeProbability(0)).toBe(0.5);
      expect(computeProbability(2.197)).toBeCloseTo(0.9, 2);
      expect(computeProbability(-2.197)).toBeCloseTo(0.1, 2);
    });
  });

  describe('buildRawFeatures', () => {
    it('handles full network data', () => {
      const net = {
        bssid: 'AA',
        max_distance_km: 5.5,
        unique_days: 10,
        observation_count: 100,
        max_signal: -50,
        unique_locations: 5,
        seen_at_home: true,
        seen_away_from_home: true,
      };
      const raw = buildRawFeatures(net);
      expect(raw).toEqual({
        distance_range_km: 5.5,
        unique_days: 10,
        observation_count: 100,
        max_signal: -50,
        unique_locations: 5,
        seen_both_locations: 1,
      });
    });

    it('handles missing data with defaults', () => {
      const net = { bssid: 'AA' };
      const raw = buildRawFeatures(net);
      expect(raw).toEqual({
        distance_range_km: 0,
        unique_days: 0,
        observation_count: 0,
        max_signal: -100,
        unique_locations: 0,
        seen_both_locations: 0,
      });
    });

    it('handles partial seen status', () => {
      expect(buildRawFeatures({ bssid: 'A', seen_at_home: true }).seen_both_locations).toBe(0);
      expect(buildRawFeatures({ bssid: 'A', seen_away_from_home: true }).seen_both_locations).toBe(
        0
      );
    });
  });

  describe('buildNormalizedFeatures', () => {
    it('normalizes features based on FEATURE_STATS', () => {
      const raw = {
        distance_range_km: 0,
        unique_days: 222,
        observation_count: 1130.5, // middle of 1 and 2260 roughly
        max_signal: -149,
        unique_locations: 1,
        seen_both_locations: 1,
      };
      const normalized = buildNormalizedFeatures(raw);
      expect(normalized.distance_range_km).toBe(0);
      expect(normalized.unique_days).toBe(1);
      expect(normalized.max_signal).toBe(0);
      expect(normalized.unique_locations).toBe(0);
      expect(normalized.seen_both_locations).toBe(1);
    });

    it('handles features not in FEATURE_STATS', () => {
      const raw = { unknown_feat: 0.5 };
      const normalized = buildNormalizedFeatures(raw);
      expect(normalized.unknown_feat).toBe(0.5);
    });
  });

  describe('scoreNetworkWithModel', () => {
    const defaultModel = {
      coefficients: [20, 20],
      featureNames: ['unique_days', 'observation_count'],
      intercept: -10,
      overwriteFinal: true,
      modelVersion: '1.0.0',
    };

    it('scores a network as THREAT when probability is high', () => {
      const result = scoreNetworkWithModel(
        {
          bssid: 'AA',
          unique_days: 222,
          observation_count: 2260,
          live_rule_result: { score: 10 },
          seen_at_home: true,
          seen_away_from_home: true,
        },
        defaultModel
      );

      expect(result.ml_primary_class).toBe('THREAT');
      expect(result.ml_threat_score).toBeGreaterThan(90);
      expect(result.final_threat_score).toBeGreaterThan(10);
    });

    it('scores a network as LEGITIMATE when probability is low', () => {
      const result = scoreNetworkWithModel(
        {
          bssid: 'AA',
          unique_days: 0,
          observation_count: 0,
          live_rule_result: { score: 10 },
        },
        defaultModel
      );

      expect(result.ml_primary_class).toBe('LEGITIMATE');
      expect(result.ml_threat_score).toBeLessThan(10);
    });

    it('respects overwriteFinal = false', () => {
      const result = scoreNetworkWithModel(
        {
          bssid: 'AA',
          unique_days: 222,
          observation_count: 2260,
          live_rule_result: { score: 10 },
        },
        { ...defaultModel, overwriteFinal: false }
      );

      expect(result.final_threat_score).toBe(10);
    });

    it('calculates evidence weight correctly for high evidence', () => {
      const result = scoreNetworkWithModel(
        {
          bssid: 'AA',
          unique_days: 7,
          observation_count: 30,
          unique_locations: 5,
          live_rule_result: { score: 0 },
        },
        { ...defaultModel, intercept: 0 } // Prob will be > 0.5
      );

      expect(result.ml_feature_values.evidence_weight).toBe(1.0);
    });

    it('calculates evidence weight as 0 for low evidence', () => {
      const result = scoreNetworkWithModel(
        {
          bssid: 'AA',
          unique_days: 1,
          observation_count: 2,
          live_rule_result: { score: 0 },
        },
        defaultModel
      );

      expect(result.ml_feature_values.evidence_weight).toBe(0);
    });

    it('applies ml boost when ml score is higher than rule score', () => {
      const result = scoreNetworkWithModel(
        {
          bssid: 'AA',
          unique_days: 7,
          observation_count: 30,
          unique_locations: 5,
          live_rule_result: { score: 20 },
        },
        { ...defaultModel, intercept: 5 } // High ML score
      );

      expect(result.ml_threat_score).toBeGreaterThan(99);
      expect(result.ml_feature_values.ml_boost).toBeGreaterThan(0);
      expect(result.final_threat_score).toBeGreaterThan(20);
    });

    it('does not apply ml boost when ml score is lower than rule score', () => {
      const result = scoreNetworkWithModel(
        {
          bssid: 'AA',
          unique_days: 7,
          observation_count: 30,
          unique_locations: 5,
          live_rule_result: { score: 80 },
        },
        { ...defaultModel, intercept: -100 } // Low ML score
      );

      expect(result.ml_threat_score).toBeLessThan(1);
      expect(result.ml_feature_values.ml_boost).toBe(0);
      expect(result.final_threat_score).toBe(80);
    });

    it('handles missing live_rule_result', () => {
      const result = scoreNetworkWithModel({ bssid: 'AA' }, defaultModel);
      expect(result.rule_based_score).toBe(0);
      expect(result.rule_based_flags).toEqual({});
    });

    it('handles missing coefficients or feature names gracefully', () => {
      const result = scoreNetworkWithModel(
        { bssid: 'AA', unique_days: 10 },
        { ...defaultModel, coefficients: [1], featureNames: ['unique_days', 'other'] }
      );
      expect(result.ml_threat_score).toBeDefined();
    });
  });
});
