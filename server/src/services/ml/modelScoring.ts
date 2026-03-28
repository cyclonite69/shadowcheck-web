export {};

const determineThreatLevel = (score: number): string => {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MED';
  if (score >= 20) return 'LOW';
  return 'NONE';
};

const FEATURE_STATS = {
  distance_range_km: { min: 0, max: 9.29 },
  unique_days: { min: 1, max: 222 },
  observation_count: { min: 1, max: 2260 },
  max_signal: { min: -149, max: 127 },
  unique_locations: { min: 1, max: 213 },
  seen_both_locations: { min: 0, max: 1 },
} as const;

type ModelInputs = {
  coefficients: number[];
  featureNames: string[];
  intercept: number;
  overwriteFinal?: boolean;
  modelVersion: string;
};

type NetworkRow = {
  bssid: string;
  max_distance_km?: number | string | null;
  unique_days?: number | string | null;
  observation_count?: number | string | null;
  max_signal?: number | string | null;
  unique_locations?: number | string | null;
  seen_at_home?: boolean;
  seen_away_from_home?: boolean;
  live_rule_result?: { score?: number | string; flags?: Record<string, unknown> } | null;
};

const normalize = (value: number, min: number, max: number) => {
  if (max === min) return 0;
  return (value - min) / (max - min);
};

const buildRawFeatures = (network: NetworkRow) => ({
  distance_range_km: parseFloat(String(network.max_distance_km || 0)),
  unique_days: parseInt(String(network.unique_days || 0), 10),
  observation_count: parseInt(String(network.observation_count || 0), 10),
  max_signal: parseInt(String(network.max_signal || -100), 10),
  unique_locations: parseInt(String(network.unique_locations || 0), 10),
  seen_both_locations: network.seen_at_home && network.seen_away_from_home ? 1 : 0,
});

const buildNormalizedFeatures = (rawFeatures: Record<string, number>) => {
  const features: Record<string, number> = {};

  for (const [key, value] of Object.entries(rawFeatures)) {
    const stats = FEATURE_STATS[key as keyof typeof FEATURE_STATS];
    features[key] = stats ? normalize(value, stats.min, stats.max) : value;
  }

  return features;
};

const computeProbability = (z: number) => {
  if (z > 500) return 1.0;
  if (z < -500) return 0.0;

  const probability = 1 / (1 + Math.exp(-z));
  if (isNaN(probability) || !isFinite(probability)) {
    return 0.5;
  }

  return probability;
};

const scoreNetworkWithModel = (network: NetworkRow, model: ModelInputs) => {
  const rawFeatures = buildRawFeatures(network);
  const features = buildNormalizedFeatures(rawFeatures);

  let z = model.intercept;
  for (let i = 0; i < model.coefficients.length && i < model.featureNames.length; i++) {
    const featureName = model.featureNames[i];
    const featureValue = features[featureName] || 0;
    if (!isNaN(featureValue)) {
      z += model.coefficients[i] * featureValue;
    }
  }

  const probability = computeProbability(z);
  const threatScore = probability * 100;
  const ruleResult = network.live_rule_result || {};
  const ruleScore = parseFloat(String(ruleResult.score || 0));

  const obsCount = parseInt(String(network.observation_count || 0), 10);
  const uniqueDays = parseInt(String(network.unique_days || 0), 10);
  const uniqueLocs = parseInt(String(network.unique_locations || 0), 10);

  let evidenceWeight = 0;
  if (obsCount >= 3 && uniqueDays >= 2) {
    evidenceWeight = Math.min(
      1.0,
      Math.log1p(obsCount) / Math.log1p(30),
      uniqueDays / 7.0,
      uniqueLocs / 5.0
    );
  }

  const mlConfidenceWeight = threatScore > 90 ? Math.max(evidenceWeight, 0.7) : evidenceWeight;
  const mlBoost = mlConfidenceWeight * Math.max(0, threatScore - ruleScore);
  const hybridScore = ruleScore + mlBoost;
  const finalScore = model.overwriteFinal ? hybridScore : ruleScore;

  return {
    bssid: network.bssid,
    ml_threat_score: parseFloat(threatScore.toFixed(2)),
    ml_threat_probability: parseFloat(probability.toFixed(3)),
    ml_primary_class: threatScore >= 50 ? 'THREAT' : 'LEGITIMATE',
    ml_feature_values: {
      rule_score: parseFloat(ruleScore.toFixed(2)),
      ml_score: parseFloat(threatScore.toFixed(2)),
      evidence_weight: parseFloat(evidenceWeight.toFixed(3)),
      ml_confidence_weight: parseFloat(mlConfidenceWeight.toFixed(3)),
      ml_boost: parseFloat(mlBoost.toFixed(2)),
      features: rawFeatures,
    },
    rule_based_score: ruleScore,
    rule_based_flags: ruleResult,
    final_threat_score: parseFloat(finalScore.toFixed(2)),
    final_threat_level: determineThreatLevel(finalScore),
    model_version: model.modelVersion,
  };
};

export {
  buildNormalizedFeatures,
  buildRawFeatures,
  computeProbability,
  determineThreatLevel,
  scoreNetworkWithModel,
};
