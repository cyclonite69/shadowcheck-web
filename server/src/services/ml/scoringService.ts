/**
 * ML Scoring Service
 * Handles network threat scoring with ML models
 */

const { query } = require('../../config/database');
const logger = require('../../logging/logger');
const { validateIntegerRange } = require('../../validation/schemas');

export {};

import { scoreNetworkWithModel } from './modelScoring';

const DEFAULT_SCORE_LIMIT = parseInt(process.env.ML_SCORE_LIMIT || '100', 10);
const DEFAULT_MODEL_VERSION = process.env.ML_MODEL_VERSION || '1.0.0';
const MAX_SCORE_LIMIT = 200000;

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
        jsonb_build_object(
          'score', COALESCE(nts.rule_based_score, 0),
          'flags', COALESCE(nts.rule_based_flags, '{}'::jsonb)
        ) as live_rule_result
      FROM app.access_points ap
      LEFT JOIN app.api_network_explorer_mv mv ON ap.bssid = mv.bssid
      LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(ap.bssid)
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
      scores.push(
        scoreNetworkWithModel(net, {
          coefficients,
          featureNames,
          intercept,
          overwriteFinal,
          modelVersion: DEFAULT_MODEL_VERSION,
        })
      );
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

export async function getNetworksForBehavioralScoring(
  limit: number,
  minObservations: number,
  maxBssidLength: number
): Promise<any[]> {
  const { rows } = await query(
    `SELECT
       ap.bssid,
       COUNT(DISTINCT obs.id) as observation_count,
       COUNT(DISTINCT DATE(obs.observed_at)) as unique_days,
       COALESCE(MAX(ABS(obs.lon - (-79.3832)) + ABS(obs.lat - 43.6532)) * 111, 0) as max_distance_km
     FROM app.access_points ap
     LEFT JOIN app.observations obs ON ap.bssid = obs.bssid
     WHERE ap.bssid IS NOT NULL
       AND obs.id IS NOT NULL
       AND LENGTH(ap.bssid) <= $1
       AND obs.lon IS NOT NULL
       AND obs.lat IS NOT NULL
     GROUP BY ap.bssid
     HAVING COUNT(DISTINCT obs.id) > $2
     LIMIT $3`,
    [maxBssidLength, minObservations, limit]
  );
  return rows;
}

export async function bulkUpsertThreatScores(scores: any[]): Promise<number> {
  let inserted = 0;
  for (const score of scores) {
    await query(
      `INSERT INTO app.network_threat_scores
         (bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
          rule_based_score, final_threat_score, final_threat_level, model_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (bssid) DO UPDATE SET
         ml_threat_score = EXCLUDED.ml_threat_score,
         ml_threat_probability = EXCLUDED.ml_threat_probability,
         final_threat_score = EXCLUDED.final_threat_score,
         final_threat_level = EXCLUDED.final_threat_level,
         model_version = EXCLUDED.model_version,
         updated_at = NOW()`,
      [
        score.bssid,
        score.ml_threat_score,
        score.ml_threat_probability,
        score.ml_primary_class,
        score.rule_based_score,
        score.final_threat_score,
        score.final_threat_level,
        score.model_version,
      ]
    );
    inserted++;
  }
  return inserted;
}

module.exports.getMLModelStatus = getMLModelStatus;
module.exports.getMLTrainingData = getMLTrainingData;
module.exports.getMLScoreForNetwork = getMLScoreForNetwork;
module.exports.getNetworksByThreatLevel = getNetworksByThreatLevel;
module.exports.getNetworksForBehavioralScoring = getNetworksForBehavioralScoring;
module.exports.bulkUpsertThreatScores = bulkUpsertThreatScores;
