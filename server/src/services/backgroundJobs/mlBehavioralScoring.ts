export {};

import type {
  LegacyThreatLevel,
  ThreatBehavioralCandidate,
  ThreatManualTag,
} from '../threatScoring.types';

const MOBILITY_HIGH_KM = 5;
const MOBILITY_MED_KM = 1;
const PERSISTENCE_HIGH_DAYS = 7;
const PERSISTENCE_MED_DAYS = 3;
const THREAT_LEVEL_THRESHOLDS = {
  CRITICAL: 80,
  HIGH: 60,
  MED: 40,
  LOW: 20,
};
const FEEDBACK_MULTIPLIERS = {
  FALSE_POSITIVE: 0.1,
  THREAT_BOOST: 0.3,
  SUSPECT_BOOST: 0.15,
};

const toManualTagMap = (tagRows: ThreatManualTag[]) => {
  const tagMap = new Map<
    string,
    {
      tag: string;
      confidence: number;
      notes?: string | null;
    }
  >();

  for (const tag of tagRows) {
    tagMap.set(tag.bssid, {
      tag: tag.threat_tag,
      confidence: tag.threat_confidence || 1.0,
      notes: tag.notes,
    });
  }

  return tagMap;
};

const toThreatLevel = (finalScore: number): LegacyThreatLevel => {
  if (finalScore >= THREAT_LEVEL_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (finalScore >= THREAT_LEVEL_THRESHOLDS.HIGH) return 'HIGH';
  if (finalScore >= THREAT_LEVEL_THRESHOLDS.MED) return 'MED';
  if (finalScore >= THREAT_LEVEL_THRESHOLDS.LOW) return 'LOW';
  return 'NONE';
};

type LegacyBehavioralCandidate = Partial<ThreatBehavioralCandidate> & {
  bssid: string;
  max_distance_km?: number;
  unique_days?: number;
};

const scoreBehavioralThreats = (
  networks: LegacyBehavioralCandidate[],
  tagRows: ThreatManualTag[]
) => {
  const tagMap = toManualTagMap(tagRows);

  const scores = networks.map((net) => {
    const maxDistanceKm =
      typeof net.maxDistanceKm === 'number' ? net.maxDistanceKm : net.max_distance_km || 0;
    const uniqueDays = typeof net.uniqueDays === 'number' ? net.uniqueDays : net.unique_days || 0;
    const mobility =
      maxDistanceKm > MOBILITY_HIGH_KM ? 80 : maxDistanceKm > MOBILITY_MED_KM ? 40 : 0;
    const persistence =
      uniqueDays > PERSISTENCE_HIGH_DAYS
        ? 60
        : uniqueDays > PERSISTENCE_MED_DAYS
          ? 30
          : 0;
    const baseMlScore = mobility * 0.6 + persistence * 0.4;

    let finalScore = baseMlScore;
    let feedbackApplied = false;

    const tag = tagMap.get(net.bssid);
    if (tag) {
      feedbackApplied = true;
      switch (tag.tag) {
        case 'FALSE_POSITIVE':
          finalScore = baseMlScore * FEEDBACK_MULTIPLIERS.FALSE_POSITIVE;
          break;
        case 'THREAT':
          finalScore = baseMlScore * (1.0 + tag.confidence * FEEDBACK_MULTIPLIERS.THREAT_BOOST);
          break;
        case 'SUSPECT':
          finalScore = baseMlScore * (1.0 + tag.confidence * FEEDBACK_MULTIPLIERS.SUSPECT_BOOST);
          break;
        case 'INVESTIGATE':
          finalScore = baseMlScore;
          break;
      }
    }

    return {
      bssid: net.bssid,
      ml_threat_score: baseMlScore,
      ml_threat_probability: baseMlScore / 100.0,
      ml_primary_class: baseMlScore >= 60 ? 'THREAT' : 'LEGITIMATE',
      rule_based_score: 0,
      final_threat_score: finalScore,
      final_threat_level: toThreatLevel(finalScore),
      model_version: '2.0.0',
      feedback_applied: feedbackApplied,
      manual_tag: tag ? tag.tag : null,
    };
  });

  return { scores, tagMap };
};

export { scoreBehavioralThreats, toManualTagMap, toThreatLevel };
