/**
 * Admin ML Routes
 * ML scoring and management operations
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../../config/database');
const logger = require('../../../../logging/logger');
const { validateEnum, validateIntegerRange } = require('../../../../validation/schemas');

// ML Scoring Implementation (temporary in admin routes)
router.post('/admin/ml-score-all', async (req, res, next) => {
  try {
    logger.info('Starting ML scoring of all networks...');

    // Get the trained model
    const modelResult = await query(
      `SELECT coefficients, intercept, feature_names, version
       FROM app.ml_model_config
       WHERE model_type = 'logistic_regression'`
    );

    if (!modelResult.rows.length) {
      return res.status(400).json({
        ok: false,
        message: 'No trained model found. Train a model first.',
      });
    }

    const model = modelResult.rows[0];
    const modelVersion = model.version || '1.0.0';
    const coefficients = model.coefficients;
    const intercept = model.intercept || 0;

    // Get networks to score (limit to 100 for testing)
    const networksResult = await query(`
      SELECT
        ap.bssid,
        mv.observations AS observation_count,
        mv.unique_days,
        mv.unique_locations,
        COALESCE(mv.signal, -100) AS max_signal,
        COALESCE(mv.max_distance_meters, 0) / 1000.0 AS max_distance_km,
        mv.distance_from_home_km,
        FALSE AS seen_at_home,
        FALSE AS seen_away_from_home,
        COALESCE(nts.rule_based_score, 0) AS rule_based_score
      FROM public.access_points ap
      LEFT JOIN public.api_network_explorer_mv mv ON ap.bssid = mv.bssid
      LEFT JOIN app.network_threat_scores nts ON ap.bssid = nts.bssid
      WHERE ap.bssid IS NOT NULL
        AND COALESCE(mv.observations, 0) > 0
      LIMIT 100
    `);

    const networks = networksResult.rows;
    const scores = [];

    // Score each network
    for (const network of networks) {
      const features = {
        distance_range_km: network.max_distance_km || 0,
        unique_days: network.unique_days || 0,
        observation_count: network.observation_count || 0,
        max_signal: network.max_signal || -100,
        unique_locations: network.unique_locations || 0,
        seen_both_locations: network.seen_at_home && network.seen_away_from_home ? 1 : 0,
      };

      // Compute logistic regression prediction
      let score = intercept;
      for (let i = 0; i < coefficients.length; i++) {
        const featureName = model.feature_names[i];
        score += coefficients[i] * (features[featureName] || 0);
      }

      // Convert to probability (logistic function)
      const probability = 1 / (1 + Math.exp(-score));
      const threatScore = probability * 100;

      const finalScore = Math.max(threatScore, network.rule_based_score);

      // Determine threat level from final score
      let threatLevel = 'NONE';
      if (finalScore >= 80) {
        threatLevel = 'CRITICAL';
      } else if (finalScore >= 60) {
        threatLevel = 'HIGH';
      } else if (finalScore >= 40) {
        threatLevel = 'MED';
      } else if (finalScore >= 20) {
        threatLevel = 'LOW';
      }

      scores.push({
        bssid: network.bssid,
        ml_threat_score: parseFloat(threatScore.toFixed(2)),
        ml_threat_probability: parseFloat(probability.toFixed(3)),
        ml_primary_class: threatScore >= 50 ? 'THREAT' : 'LEGITIMATE',
        rule_based_score: network.rule_based_score,
        final_threat_score: finalScore,
        final_threat_level: threatLevel,
        model_version: modelVersion,
      });
    }

    // Insert scores into database
    if (scores.length > 0) {
      for (const s of scores) {
        await query(
          `
          INSERT INTO app.network_threat_scores
            (bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
             rule_based_score, final_threat_score, final_threat_level, model_version)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (bssid) DO UPDATE SET
            ml_threat_score = EXCLUDED.ml_threat_score,
            ml_threat_probability = EXCLUDED.ml_threat_probability,
            ml_primary_class = EXCLUDED.ml_primary_class,
            rule_based_score = EXCLUDED.rule_based_score,
            final_threat_score = EXCLUDED.final_threat_score,
            final_threat_level = EXCLUDED.final_threat_level,
            model_version = EXCLUDED.model_version,
            scored_at = NOW(),
            updated_at = NOW()
        `,
          [
            s.bssid,
            s.ml_threat_score,
            s.ml_threat_probability,
            s.ml_primary_class,
            s.rule_based_score,
            s.final_threat_score,
            s.final_threat_level,
            s.model_version,
          ]
        );
      }
    }

    logger.info(`ML scoring complete: ${scores.length} networks scored`);

    res.json({
      ok: true,
      scored: scores.length,
      message: `Successfully scored ${scores.length} networks`,
      modelVersion,
    });
  } catch (error) {
    logger.error(`ML scoring error: ${error.message}`, { error });
    next(error);
  }
});

// GET /api/admin/ml-scores - Get ML scores
router.get('/admin/ml-scores', async (req, res, next) => {
  try {
    const { level, limit = 10 } = req.query;

    const limitValidation = validateIntegerRange(limit, 1, 500, 'limit');
    if (!limitValidation.valid) {
      return res.status(400).json({ error: limitValidation.error });
    }

    let whereClause = '';
    const params = [limitValidation.value];

    if (level) {
      const levelValidation = validateEnum(
        level,
        ['CRITICAL', 'HIGH', 'MED', 'LOW', 'NONE'],
        'level'
      );
      if (!levelValidation.valid) {
        return res.status(400).json({ error: levelValidation.error });
      }

      whereClause = 'WHERE final_threat_level = $2';
      params.push(levelValidation.value);
    }

    const result = await query(
      `
      SELECT bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
             rule_based_score, final_threat_score, final_threat_level,
             model_version, scored_at
      FROM app.network_threat_scores
      ${whereClause}
      ORDER BY final_threat_score DESC
      LIMIT $1
    `,
      params
    );

    res.json({
      ok: true,
      scores: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error(`ML scores get error: ${error.message}`, { error });
    next(error);
  }
});

// POST /api/admin/ml-score-now - Manually trigger ML scoring
router.post('/admin/ml-score-now', async (req, res, next) => {
  try {
    logger.info('[Admin] Manual ML scoring requested (blocked: manual-only mode)');
    res.status(409).json({
      ok: false,
      message: 'Background ML scoring is disabled in manual-only mode.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`[Admin] ML scoring error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/ml-jobs-status - Check job status
router.get('/admin/ml-jobs-status', async (req, res, next) => {
  try {
    const lastScoringResult = await query(
      `SELECT final_threat_level, COUNT(*) as count
       FROM app.network_threat_scores
       GROUP BY final_threat_level
       ORDER BY count DESC`
    );

    // Helper function to calculate next job run
    const getNextRunTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const nextHour = Math.ceil(hour / 4) * 4;
      const next = new Date(now);
      next.setHours(nextHour, 0, 0, 0);
      if (next <= now) {
        next.setHours(nextHour + 4);
      }
      return next.toISOString();
    };

    res.json({
      ok: true,
      jobsScheduled: true,
      schedule: 'Every 4 hours (0, 4, 8, 12, 16, 20:00)',
      lastScoresSummary: lastScoringResult.rows,
      nextRun: getNextRunTime(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
