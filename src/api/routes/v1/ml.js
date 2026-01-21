/**
 * Machine Learning Routes
 * Handles ML model training and scoring
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const logger = require('../../../logging/logger');

// Load ML model with error handling
let ThreatMLModel, mlModel;
try {
  ThreatMLModel = require('../../../../scripts/ml/ml-trainer');
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

    const scoreRows = await query(
      'SELECT COUNT(*) as count FROM app.network_threat_scores'
    );

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
router.post('/ml/train', async (req, res, next) => {
  try {
    if (!mlModel) {
      return res.status(503).json({
        ok: false,
        error: 'ML model module not available. Check server logs for details.',
      });
    }

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
      JOIN public.api_network_explorer_mv mv ON nt.bssid = mv.bssid
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

    res.json({
      ok: true,
      message: 'Model trained successfully',
      ...trainingResult,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// POST /api/ml/score-all - Legacy ML scoring (v1.0)
// ============================================
router.post('/ml/score-all', async (req, res, next) => {
  try {
    logger.info('[ML] Starting ML scoring of all networks...');

    // Get trained model
    const modelResult = await query(
      `SELECT coefficients, intercept, feature_names 
       FROM app.ml_model_config 
       WHERE model_type = 'threat_logistic_regression'`
    );

    if (!modelResult.rows.length) {
      return res.status(400).json({
        ok: false,
        error: { message: 'No trained model found. Train first with POST /api/ml/train' },
      });
    }

    const model = modelResult.rows[0];

    // CRITICAL: Ensure coefficients are proper numbers
    let coefficients;
    if (Array.isArray(model.coefficients)) {
      coefficients = model.coefficients.map(c => parseFloat(c));
    } else {
      coefficients = JSON.parse(JSON.stringify(model.coefficients)).map(c => parseFloat(c));
    }

    const intercept = parseFloat(model.intercept) || 0;
    const featureNames = Array.isArray(model.feature_names)
      ? model.feature_names
      : JSON.parse(JSON.stringify(model.feature_names));

    logger.info('[ML] Model loaded', {
      coefficients: coefficients.slice(0, 3),
      intercept,
      featureNames,
      coefficientsLength: coefficients.length,
    });

    // Get networks to score
    const networkResult = await query(`
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
        0 AS rule_based_score
      FROM public.access_points ap
      LEFT JOIN public.api_network_explorer_mv mv ON ap.bssid = mv.bssid
      WHERE ap.bssid IS NOT NULL
        AND mv.observations > 0
      LIMIT 100
    `);

    const networks = networkResult.rows;
    const scores = [];

    // Score each network
    for (const net of networks) {
      try {
        // Feature normalization ranges (from actual data)
        const featureStats = {
          distance_range_km: { min: 0, max: 9.29 },
          unique_days: { min: 1, max: 222 },
          observation_count: { min: 1, max: 2260 },
          max_signal: { min: -149, max: 127 },
          unique_locations: { min: 1, max: 213 },
          seen_both_locations: { min: 0, max: 1 },
        };

        // Normalize function: (value - min) / (max - min)
        const normalize = (value, min, max) => {
          if (max === min) {return 0;}
          return (value - min) / (max - min);
        };

        // Build raw features dictionary
        const rawFeatures = {
          distance_range_km: parseFloat(net.max_distance_km || 0),
          unique_days: parseInt(net.unique_days || 0),
          observation_count: parseInt(net.observation_count || 0),
          max_signal: parseInt(net.max_signal || -100),
          unique_locations: parseInt(net.unique_locations || 0),
          seen_both_locations: (net.seen_at_home && net.seen_away_from_home) ? 1 : 0,
        };

        // Normalize each feature
        const features = {};
        for (const [key, value] of Object.entries(rawFeatures)) {
          const stats = featureStats[key];
          features[key] = stats ? normalize(value, stats.min, stats.max) : value;
        }

        // Compute logistic regression: z = intercept + sum(coef * feature)
        let z = intercept;
        for (let i = 0; i < coefficients.length && i < featureNames.length; i++) {
          const featureName = featureNames[i];
          const featureValue = features[featureName] || 0;

          if (isNaN(featureValue)) {
            logger.debug(`[ML] Feature ${featureName} is NaN for ${net.bssid}, using 0`);
            continue;
          }

          z += coefficients[i] * featureValue;
        }

        // Debug first network
        if (scores.length === 0) {
          logger.info(`[ML] First network ${net.bssid}:`, {
            rawFeatures,
            normalizedFeatures: features,
            z,
            intercept,
          });
        }

        // Probability = 1 / (1 + e^-z), with overflow protection
        let probability;
        if (z > 500) {
          probability = 1.0;
        } else if (z < -500) {
          probability = 0.0;
        } else {
          probability = 1 / (1 + Math.exp(-z));
        }

        // Safety check
        if (isNaN(probability) || !isFinite(probability)) {
          logger.warn(`[ML] Invalid probability for ${net.bssid}: z=${z}, using 0.5`);
          probability = 0.5;
        }

        const threatScore = probability * 100;

        // Determine threat level with very aggressive thresholds for over-sensitive model
        let threatLevel = 'NONE';
        if (threatScore >= 99) {threatLevel = 'CRITICAL';} // Only near-perfect scores
        else if (threatScore >= 95) {threatLevel = 'HIGH';} // Very high confidence
        else if (threatScore >= 85) {threatLevel = 'MED';} // High confidence
        else if (threatScore >= 70) {threatLevel = 'LOW';} // Moderate confidence

        scores.push({
          bssid: net.bssid,
          ml_threat_score: parseFloat(threatScore.toFixed(2)),
          ml_threat_probability: parseFloat(probability.toFixed(3)),
          ml_primary_class: threatScore >= 50 ? 'THREAT' : 'LEGITIMATE',
          rule_based_score: 0,
          final_threat_score: threatScore,
          final_threat_level: threatLevel,
          model_version: '1.0.0',
        });
      } catch (netError) {
        logger.warn(`[ML] Error scoring network ${net.bssid}: ${netError.message}`);
      }
    }

    // Insert scores
    for (const score of scores) {
      await query(`
        INSERT INTO app.network_threat_scores 
          (bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
           rule_based_score, final_threat_score, final_threat_level, model_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (bssid) DO UPDATE SET
          ml_threat_score = EXCLUDED.ml_threat_score,
          ml_threat_probability = EXCLUDED.ml_threat_probability,
          final_threat_score = EXCLUDED.final_threat_score,
          final_threat_level = EXCLUDED.final_threat_level,
          updated_at = NOW()
      `, [
        score.bssid, score.ml_threat_score, score.ml_threat_probability,
        score.ml_primary_class, score.rule_based_score, score.final_threat_score,
        score.final_threat_level, score.model_version,
      ]);
    }

    logger.info(`[ML] Scored ${scores.length} networks`);

    res.json({
      ok: true,
      scored: scores.length,
      message: `Successfully scored ${scores.length} networks`,
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
    const { bssid } = req.params;

    const result = await query(
      'SELECT * FROM app.network_threat_scores WHERE bssid = $1',
      [bssid]
    );

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
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        ok: false,
        error: { message: `Invalid threat level. Must be: ${validLevels.join(', ')}` },
      });
    }

    const result = await query(`
      SELECT bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
             final_threat_score, final_threat_level, scored_at
      FROM app.network_threat_scores
      WHERE final_threat_level = $1
      ORDER BY final_threat_score DESC
      LIMIT $2
    `, [level, parseInt(limit)]);

    res.json({
      ok: true,
      threatLevel: level,
      networks: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
