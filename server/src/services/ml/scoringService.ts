/**
 * ML Scoring Service
 * Handles network threat scoring with ML models
 */

const { query } = require('../../config/database');
const logger = require('../../logging/logger');
const { validateIntegerRange } = require('../../validation/schemas');

export {};

const DEFAULT_SCORE_LIMIT = parseInt(process.env.ML_SCORE_LIMIT, 10) || 100;
const DEFAULT_MODEL_VERSION = process.env.ML_MODEL_VERSION || '1.0.0';
const MAX_SCORE_LIMIT = 200000;

const determineThreatLevel = (score: number): string => {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MED';
  if (score >= 20) return 'LOW';
  return 'NONE';
};

export const scoreAllNetworks = async ({
  limit,
  overwriteFinal,
}: {
  limit?: number;
  overwriteFinal?: boolean;
}) => {
  const limitValidation = validateIntegerRange(
    limit || DEFAULT_SCORE_LIMIT,
    1,
    MAX_SCORE_LIMIT,
    'limit'
  );
  if (!limitValidation.valid) {
    throw new Error(limitValidation.error);
  }

  logger.info('[ML] Scoring networks', {
    limit: limitValidation.value,
    overwriteFinal,
  });

  const modelResult = await query(
    `SELECT coefficients, intercept, feature_names
     FROM app.ml_model_config
     WHERE model_type = 'threat_logistic_regression'`
  );

  if (!modelResult.rows.length) {
    throw new Error('No trained model found. Train first with POST /api/ml/train');
  }

  const model = modelResult.rows[0];
  const coefficients = Array.isArray(model.coefficients)
    ? model.coefficients.map((c: any) => parseFloat(c))
    : JSON.parse(JSON.stringify(model.coefficients)).map((c: any) => parseFloat(c));
  const intercept = parseFloat(model.intercept) || 0;
  const featureNames = Array.isArray(model.feature_names)
    ? model.feature_names
    : JSON.parse(JSON.stringify(model.feature_names));

  const networkResult = await query(
    `
      SELECT 
        ap.bssid,
        mv.observations as observation_count,
        mv.unique_days,
        mv.unique_locations,
        mv.signal as max_signal,
        mv.max_distance_meters / 1000.0 as max_distance_km,
        mv.distance_from_home_km,
        (mv.distance_from_home_km < 0.1) as seen_at_home,
        (mv.distance_from_home_km > 0.5) as seen_away_from_home,
        calculate_threat_score_v3(ap.bssid) as live_rule_result
      FROM app.access_points ap
      LEFT JOIN app.api_network_explorer_mv mv ON ap.bssid = mv.bssid
      WHERE ap.bssid IS NOT NULL
        AND mv.observations > 0
      ORDER BY ap.bssid
      LIMIT $1
    `,
    [limitValidation.value]
  );

  const networks = networkResult.rows;
  const scores = [];

  for (const net of networks) {
    try {
      const featureStats = {
        distance_range_km: { min: 0, max: 9.29 },
        unique_days: { min: 1, max: 222 },
        observation_count: { min: 1, max: 2260 },
        max_signal: { min: -149, max: 127 },
        unique_locations: { min: 1, max: 213 },
        seen_both_locations: { min: 0, max: 1 },
      };

      const normalize = (value: number, min: number, max: number) => {
        if (max === min) return 0;
        return (value - min) / (max - min);
      };

      const rawFeatures = {
        distance_range_km: parseFloat(net.max_distance_km || 0),
        unique_days: parseInt(net.unique_days || 0),
        observation_count: parseInt(net.observation_count || 0),
        max_signal: parseInt(net.max_signal || -100),
        unique_locations: parseInt(net.unique_locations || 0),
        seen_both_locations: net.seen_at_home && net.seen_away_from_home ? 1 : 0,
      };

      const features: Record<string, number> = {};
      for (const [key, value] of Object.entries(rawFeatures)) {
        const stats = featureStats[key as keyof typeof featureStats];
        features[key] = stats ? normalize(value, stats.min, stats.max) : value;
      }

      let z = intercept;
      for (let i = 0; i < coefficients.length && i < featureNames.length; i++) {
        const featureName = featureNames[i];
        const featureValue = features[featureName] || 0;
        if (!isNaN(featureValue)) {
          z += coefficients[i] * featureValue;
        }
      }

      let probability;
      if (z > 500) {
        probability = 1.0;
      } else if (z < -500) {
        probability = 0.0;
      } else {
        probability = 1 / (1 + Math.exp(-z));
      }

      if (isNaN(probability) || !isFinite(probability)) {
        probability = 0.5;
      }

      const threatScore = probability * 100;
      const ruleResult = net.live_rule_result || {};
      const ruleScore = parseFloat(ruleResult.score || 0);

      const obsCount = parseInt(net.observation_count || 0);
      const uniqueDays = parseInt(net.unique_days || 0);
      const uniqueLocs = parseInt(net.unique_locations || 0);

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
      const finalScore = overwriteFinal ? hybridScore : ruleScore;
      const threatLevel = determineThreatLevel(finalScore);

      scores.push({
        bssid: net.bssid,
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
        final_threat_level: threatLevel,
        model_version: DEFAULT_MODEL_VERSION,
      });
    } catch (netError: any) {
      logger.warn(`[ML] Error scoring network ${net.bssid}: ${netError.message}`);
    }
  }

  if (scores.length > 0) {
    if (overwriteFinal) {
      for (const score of scores) {
        await query(
          `
          INSERT INTO app.network_threat_scores 
            (bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
             ml_feature_values, rule_based_score, rule_based_flags, final_threat_score, final_threat_level, model_version)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (bssid) DO UPDATE SET
            ml_threat_score = EXCLUDED.ml_threat_score,
            ml_threat_probability = EXCLUDED.ml_threat_probability,
            ml_primary_class = EXCLUDED.ml_primary_class,
            ml_feature_values = EXCLUDED.ml_feature_values,
            rule_based_score = EXCLUDED.rule_based_score,
            rule_based_flags = EXCLUDED.rule_based_flags,
            final_threat_score = EXCLUDED.final_threat_score,
            final_threat_level = EXCLUDED.final_threat_level,
            model_version = EXCLUDED.model_version,
            scored_at = NOW(),
            updated_at = NOW()
        `,
          [
            score.bssid,
            score.ml_threat_score,
            score.ml_threat_probability,
            score.ml_primary_class,
            JSON.stringify(score.ml_feature_values),
            score.rule_based_score,
            JSON.stringify(score.rule_based_flags),
            score.final_threat_score,
            score.final_threat_level,
            score.model_version,
          ]
        );
      }
    } else {
      for (const score of scores) {
        await query(
          `
          INSERT INTO app.network_threat_scores 
            (bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
             ml_feature_values, rule_based_score, rule_based_flags, final_threat_score, final_threat_level)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (bssid) DO UPDATE SET
            ml_threat_score = EXCLUDED.ml_threat_score,
            ml_threat_probability = EXCLUDED.ml_threat_probability,
            ml_primary_class = EXCLUDED.ml_primary_class,
            ml_feature_values = EXCLUDED.ml_feature_values,
            rule_based_score = EXCLUDED.rule_based_score,
            rule_based_flags = EXCLUDED.rule_based_flags,
            updated_at = NOW()
        `,
          [
            score.bssid,
            score.ml_threat_score,
            score.ml_threat_probability,
            score.ml_primary_class,
            JSON.stringify(score.ml_feature_values),
            score.rule_based_score,
            JSON.stringify(score.rule_based_flags),
            score.final_threat_score,
            score.final_threat_level,
          ]
        );
      }
    }
  }

  logger.info(`[ML] Scored ${scores.length} networks`, {
    overwriteFinal,
  });

  return {
    scored: scores.length,
  };
};

// Additional ML service methods

/**
 * Get ML model status and statistics
 */
export async function getMLModelStatus(): Promise<any> {
  const modelRows = await query(
    `SELECT model_type, feature_names, created_at, updated_at
     FROM app.ml_model_config
     WHERE model_type = 'threat_logistic_regression'`
  );

  const tagRows = await query(
    `SELECT threat_tag as tag_type, COUNT(*) as count
     FROM app.network_tags
     WHERE threat_tag IN ('THREAT', 'FALSE_POSITIVE')
     GROUP BY threat_tag`
  );

  const scoreRows = await query('SELECT COUNT(*) as count FROM app.network_threat_scores');

  return {
    modelTrained: modelRows.rows.length > 0,
    modelInfo: modelRows.rows[0] || null,
    taggedNetworks: tagRows.rows,
    mlScoresCount: parseInt(scoreRows.rows[0]?.count || 0),
  };
}

/**
 * Get training data for ML model
 */
export async function getMLTrainingData(): Promise<any[]> {
  const { rows } = await query(`
    SELECT
      nt.bssid,
      nt.threat_tag as tag_type,
      mv.type,
      mv.security,
      mv.observations as observation_count,
      mv.unique_days,
      mv.unique_locations,
      mv.signal as max_signal,
      mv.max_distance_meters / 1000.0 as distance_range_km,
      (mv.distance_from_home_km < 0.1) as seen_at_home,
      (mv.distance_from_home_km > 0.5) as seen_away_from_home
    FROM app.network_tags nt
    JOIN app.api_network_explorer_mv mv ON nt.bssid = mv.bssid
    WHERE nt.threat_tag IN ('THREAT', 'FALSE_POSITIVE')
      AND mv.observations > 0
  `);
  return rows;
}

/**
 * Get ML score for a specific network
 */
export async function getMLScoreForNetwork(bssid: string): Promise<any | null> {
  const result = await query('SELECT * FROM app.network_threat_scores WHERE bssid = $1', [bssid]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get networks by threat level
 */
export async function getNetworksByThreatLevel(level: string, limit: number): Promise<any[]> {
  const result = await query(
    `
    SELECT bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
           final_threat_score, final_threat_level, scored_at
    FROM app.network_threat_scores
    WHERE final_threat_level = $1
    ORDER BY final_threat_score DESC
    LIMIT $2
  `,
    [level, limit]
  );
  return result.rows;
}

module.exports.getMLModelStatus = getMLModelStatus;
module.exports.getMLTrainingData = getMLTrainingData;
module.exports.getMLScoreForNetwork = getMLScoreForNetwork;
module.exports.getNetworksByThreatLevel = getNetworksByThreatLevel;
