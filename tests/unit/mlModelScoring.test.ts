export {};

import {
  computeProbability,
  determineThreatLevel,
  scoreNetworkWithModel,
} from '../../server/src/services/ml/modelScoring';

describe('ml model scoring helpers', () => {
  it('maps threat levels from score thresholds', () => {
    expect(determineThreatLevel(85)).toBe('CRITICAL');
    expect(determineThreatLevel(65)).toBe('HIGH');
    expect(determineThreatLevel(45)).toBe('MED');
    expect(determineThreatLevel(25)).toBe('LOW');
    expect(determineThreatLevel(5)).toBe('NONE');
  });

  it('clamps extreme logits to finite probabilities', () => {
    expect(computeProbability(999)).toBe(1);
    expect(computeProbability(-999)).toBe(0);
  });

  it('scores a network using normalized features and rule-score blending', () => {
    const result = scoreNetworkWithModel(
      {
        bssid: 'AA',
        max_distance_km: 9.29,
        unique_days: 222,
        observation_count: 2260,
        max_signal: 127,
        unique_locations: 213,
        seen_at_home: true,
        seen_away_from_home: true,
        live_rule_result: { score: 10, flags: { suspicious: true } },
      },
      {
        coefficients: [1, 1, 1, 1, 1, 1],
        featureNames: [
          'distance_range_km',
          'unique_days',
          'observation_count',
          'max_signal',
          'unique_locations',
          'seen_both_locations',
        ],
        intercept: 0,
        overwriteFinal: true,
        modelVersion: '1.2.3',
      }
    );

    expect(result.bssid).toBe('AA');
    expect(result.ml_primary_class).toBe('THREAT');
    expect(result.ml_threat_probability).toBeGreaterThan(0.9);
    expect(result.final_threat_score).toBeGreaterThan(result.rule_based_score);
    expect(result.model_version).toBe('1.2.3');
  });
});
