/**
 * Machine Learning Routes
 * Handles ML model training and scoring
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const logger = require('../../../logging/logger');
const mlTrainingLock = require('../../../services/mlTrainingLock');
const {
  validateBSSID,
  validateEnum,
  validateIntegerRange,
} = require('../../../validation/schemas');

const DEFAULT_SCORE_LIMIT = parseInt(process.env.ML_SCORE_LIMIT, 10) || 100;
const DEFAULT_AUTO_SCORE_LIMIT = parseInt(process.env.ML_AUTO_SCORE_LIMIT, 10) || 1000;
const DEFAULT_MODEL_VERSION = process.env.ML_MODEL_VERSION || '1.0.0';
const MAX_SCORE_LIMIT = 200000;

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const determineThreatLevel = (score) => {
  if (score >= 80) {
    return 'CRITICAL';
  }
  if (score >= 60) {
    return 'HIGH';
  }
  if (score >= 40) {
    return 'MED';
  }
  if (score >= 20) {
    return 'LOW';
  }
  return 'NONE';
};

const scoreAllNetworks = async ({ limit, overwriteFinal }) => {
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
    ? model.coefficients.map((c) => parseFloat(c))
    : JSON.parse(JSON.stringify(model.coefficients)).map((c) => parseFloat(c));
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

      const normalize = (value, min, max) => {
        if (max === min) {
          return 0;
        }
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

      const features = {};
      for (const [key, value] of Object.entries(rawFeatures)) {
        const stats = featureStats[key];
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

      // Use LIVE rule-based result instead of stale column
      const ruleResult = net.live_rule_result || {};
      const ruleScore = parseFloat(ruleResult.score || 0);

      // --- HYBRID GATED FORMULA ---
      // Baseline is the rule-based score.
      // NEW LOGIC: High-confidence ML (threatScore > 90) can override rule silence
      const obsCount = parseInt(net.observation_count || 0);
      const uniqueDays = parseInt(net.unique_days || 0);
      const uniqueLocs = parseInt(net.unique_locations || 0);

      // Evidence weight (0.0 to 1.0)
      let evidenceWeight = 0;
      if (obsCount >= 3 && uniqueDays >= 2) {
        evidenceWeight = Math.min(
          1.0,
          Math.log1p(obsCount) / Math.log1p(30),
          uniqueDays / 7.0,
          uniqueLocs / 5.0
        );
      }

      // If ML is absolutely certain (>90), we trust it more even with slightly lower evidence
      const mlConfidenceWeight = threatScore > 90 ? Math.max(evidenceWeight, 0.7) : evidenceWeight;

      // ML only boosts. It doesn't penalize a rule-based high threat.
      const mlBoost = mlConfidenceWeight * Math.max(0, threatScore - ruleScore);
      const hybridScore = ruleScore + mlBoost;

      // finalScore is the hybrid result if overwriteFinal is true, otherwise it's ruleScore (legacy behavior)
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
    } catch (netError) {
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

// Load ML model with error handling
let ThreatMLModel, mlModel;
try {
  ThreatMLModel = require('../../../../../scripts/ml/ml-trainer');
  mlModel = new ThreatMLModel();
  logger.info('ML model module loaded successfully');
} catch (err) {
  logger.warn(`ML model module not found or failed to load: ${err.message}`);
  mlModel = null;
}

// ============================================
// GET /api/ml/status - Model status
// ============================================
router.get('/ml/status', async (req, res, next) => {
  try {
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

    res.json({
      ok: true,
      modelTrained: modelRows.rows.length > 0,
      modelInfo: modelRows.rows[0] || null,
      taggedNetworks: tagRows.rows,
      mlScoresCount: parseInt(scoreRows.rows[0]?.count || 0),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// POST /api/ml/train - Train the model
// ============================================
/**
 * POST /api/ml/train - Train the ML model
 * Prevents concurrent training runs via in-memory lock.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next
 */
router.post('/ml/train', async (req, res, next) => {
  let lockAcquired = false;
  try {
    if (!mlModel) {
      return res.status(503).json({
        ok: false,
        error: 'ML model module not available. Check server logs for details.',
      });
    }

    if (!mlTrainingLock.acquire()) {
      const status = mlTrainingLock.status();
      return res.status(409).json({
        ok: false,
        error: 'ML training is already in progress',
        lockedAt: status.lockedAt,
      });
    }
    lockAcquired = true;

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

    if (rows.length < 10) {
      return res.status(400).json({
        ok: false,
        error: 'Need at least 10 tagged networks to train model',
        currentCount: rows.length,
      });
    }

    const trainingResult = await mlModel.train(rows);

    await query(
      `INSERT INTO app.ml_model_config (model_type, coefficients, intercept, feature_names, created_at)
       VALUES ('threat_logistic_regression', $1, $2, $3, NOW())
       ON CONFLICT (model_type) DO UPDATE
       SET coefficients = $1, intercept = $2, feature_names = $3, updated_at = NOW()`,
      [
        JSON.stringify(trainingResult.coefficients),
        trainingResult.intercept,
        JSON.stringify(trainingResult.featureNames),
      ]
    );

    const autoScore = parseBoolean(req.body?.auto_score, true);
    const autoScoreLimit = parseInt(req.body?.auto_score_limit, 10) || DEFAULT_AUTO_SCORE_LIMIT;
    const autoScoreOverwrite = parseBoolean(req.body?.auto_score_overwrite, true);

    if (autoScore) {
      setImmediate(async () => {
        try {
          await scoreAllNetworks({
            limit: autoScoreLimit,
            overwriteFinal: autoScoreOverwrite,
          });
        } catch (scoreError) {
          logger.error(`[ML] Auto-scoring failed: ${scoreError.message}`, { error: scoreError });
        }
      });
    }

    res.json({
      ok: true,
      message: 'Model trained successfully',
      autoScore: {
        started: autoScore,
        limit: autoScoreLimit,
        overwriteFinal: autoScoreOverwrite,
      },
      ...trainingResult,
    });
  } catch (err) {
    next(err);
  } finally {
    if (lockAcquired) {
      mlTrainingLock.release();
    }
  }
});

// ============================================
// POST /api/ml/score-all - Legacy ML scoring (v1.0)
// ============================================
router.post('/ml/score-all', async (req, res, next) => {
  try {
    logger.info('[ML] Starting ML scoring of all networks...');

    const overwriteFinal = parseBoolean(req.body?.overwrite_final, true);
    const limit = req.body?.limit || req.query?.limit || DEFAULT_SCORE_LIMIT;
    const result = await scoreAllNetworks({ limit, overwriteFinal });

    res.json({
      ok: true,
      scored: result.scored,
      message: `Successfully scored ${result.scored} networks`,
      overwriteFinal,
    });
  } catch (err) {
    logger.error(`[ML] Scoring error: ${err.message}`);
    next(err);
  }
});

// ============================================
// GET /api/ml/scores/:bssid - Get score for one network
// ============================================
router.get('/ml/scores/:bssid', async (req, res, next) => {
  try {
    const bssidValidation = validateBSSID(req.params.bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ ok: false, error: { message: bssidValidation.error } });
    }
    const bssid = bssidValidation.cleaned;

    const result = await query('SELECT * FROM app.network_threat_scores WHERE bssid = $1', [bssid]);

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: { message: `No score found for ${bssid}. Run POST /api/ml/score-all first.` },
      });
    }

    res.json({
      ok: true,
      score: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// GET /api/ml/scores/level/:level - Get networks by threat level
// ============================================
router.get('/ml/scores/level/:level', async (req, res, next) => {
  try {
    const { level } = req.params;
    const { limit = 50 } = req.query;

    const validLevels = ['CRITICAL', 'HIGH', 'MED', 'LOW', 'NONE'];
    const levelValidation = validateEnum(level, validLevels, 'level');
    if (!levelValidation.valid) {
      return res.status(400).json({
        ok: false,
        error: { message: `Invalid threat level. Must be: ${validLevels.join(', ')}` },
      });
    }

    const limitValidation = validateIntegerRange(limit, 1, 500, 'limit');
    if (!limitValidation.valid) {
      return res.status(400).json({
        ok: false,
        error: { message: limitValidation.error },
      });
    }

    const result = await query(
      `
      SELECT bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
             final_threat_score, final_threat_level, scored_at
      FROM app.network_threat_scores
      WHERE final_threat_level = $1
      ORDER BY final_threat_score DESC
      LIMIT $2
    `,
      [levelValidation.value, limitValidation.value]
    );

    res.json({
      ok: true,
      threatLevel: levelValidation.value,
      networks: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
