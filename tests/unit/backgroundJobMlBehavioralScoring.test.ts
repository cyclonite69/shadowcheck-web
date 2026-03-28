export {};

import {
  scoreBehavioralThreats,
  toThreatLevel,
} from '../../server/src/services/backgroundJobs/mlBehavioralScoring';

describe('background job behavioral ML scoring helpers', () => {
  it('classifies threat levels using shared thresholds', () => {
    expect(toThreatLevel(85)).toBe('CRITICAL');
    expect(toThreatLevel(65)).toBe('HIGH');
    expect(toThreatLevel(45)).toBe('MED');
    expect(toThreatLevel(25)).toBe('LOW');
    expect(toThreatLevel(10)).toBe('NONE');
  });

  it('suppresses scores for FALSE_POSITIVE feedback', () => {
    const { scores } = scoreBehavioralThreats(
      [{ bssid: 'AA', max_distance_km: 6, unique_days: 8 }],
      [{ bssid: 'AA', threat_tag: 'FALSE_POSITIVE', threat_confidence: 1 }]
    );

    expect(scores[0].ml_threat_score).toBe(72);
    expect(scores[0].final_threat_score).toBeCloseTo(7.2);
    expect(scores[0].feedback_applied).toBe(true);
    expect(scores[0].manual_tag).toBe('FALSE_POSITIVE');
  });

  it('boosts scores for THREAT feedback using confidence', () => {
    const { scores } = scoreBehavioralThreats(
      [{ bssid: 'BB', max_distance_km: 6, unique_days: 8 }],
      [{ bssid: 'BB', threat_tag: 'THREAT', threat_confidence: 0.5 }]
    );

    expect(scores[0].ml_threat_score).toBe(72);
    expect(scores[0].final_threat_score).toBeCloseTo(82.8);
    expect(scores[0].final_threat_level).toBe('CRITICAL');
  });

  it('leaves untagged network scores unchanged', () => {
    const { scores, tagMap } = scoreBehavioralThreats(
      [{ bssid: 'CC', max_distance_km: 0.2, unique_days: 2 }],
      []
    );

    expect(scores[0].ml_threat_score).toBe(0);
    expect(scores[0].final_threat_score).toBe(0);
    expect(scores[0].feedback_applied).toBe(false);
    expect(tagMap.size).toBe(0);
  });
});
