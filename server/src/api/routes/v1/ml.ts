export {};
/**
 * Machine Learning Routes
 * Handles ML model training and scoring
 */

const express = require('express');
const router = express.Router();
const { adminQuery } = require('../../../services/adminDbService');
const mlScoringService = require('../../../services/ml/scoringService');
const logger = require('../../../logging/logger');
const mlTrainingLock = require('../../../services/mlTrainingLock');
const {
  validateBSSID,
  validateEnum,
  validateIntegerRange,
} = require('../../../validation/schemas');
const { scoreAllNetworks } = require('../../../services/ml/scoringService');

const DEFAULT_SCORE_LIMIT = parseInt(process.env.ML_SCORE_LIMIT, 10) || 100;
const DEFAULT_AUTO_SCORE_LIMIT = parseInt(process.env.ML_AUTO_SCORE_LIMIT, 10) || 1000;
const DEFAULT_MODEL_VERSION = process.env.ML_MODEL_VERSION || '1.0.0';
const MAX_SCORE_LIMIT = 200000;

const parseBoolean = (value: any, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const determineThreatLevel = (score: number) => {
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
    const status = await mlScoringService.getMLModelStatus();
    res.json({
      ok: true,
      ...status,
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

    const rows = await mlScoringService.getMLTrainingData();

    if (rows.length < 10) {
      return res.status(400).json({
        ok: false,
        error: 'Need at least 10 tagged networks to train model',
        currentCount: rows.length,
      });
    }

    const trainingResult = await mlModel.train(rows);

    await adminQuery(
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

    const score = await mlScoringService.getMLScoreForNetwork(bssid);

    if (!score) {
      return res.status(404).json({
        ok: false,
        error: { message: `No score found for ${bssid}. Run POST /api/ml/score-all first.` },
      });
    }

    res.json({
      ok: true,
      score,
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

    const networks = await mlScoringService.getNetworksByThreatLevel(
      levelValidation.value,
      limitValidation.value
    );

    res.json({
      ok: true,
      threatLevel: levelValidation.value,
      networks,
      count: networks.length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
