/**
 * ML Scoring Service
 * Handles network threat scoring with ML models
 */

const logger = require('../../logging/logger');
const { validateIntegerRange } = require('../../validation/schemas');
const scoringRepository = require('./repository');

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

  const model = await scoringRepository.loadThreatModelConfig();
  if (!model) {
    throw new Error('No trained model found. Train first with POST /api/ml/train');
  }

  const coefficients = Array.isArray(model.coefficients)
    ? model.coefficients.map((c: any) => parseFloat(c))
    : JSON.parse(JSON.stringify(model.coefficients)).map((c: any) => parseFloat(c));
  const intercept = parseFloat(model.intercept) || 0;
  const featureNames = Array.isArray(model.feature_names)
    ? model.feature_names
    : JSON.parse(JSON.stringify(model.feature_names));

  const networks = await scoringRepository.loadNetworksForLegacyScoring(limitValidation.value);
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
    for (const score of scores) {
      await scoringRepository.upsertLegacyThreatScore(score, overwriteFinal);
    }
  }

  logger.info(`[ML] Scored ${scores.length} networks`, {
    overwriteFinal,
  });

  return {
    scored: scores.length,
  };
};
module.exports.getMLModelStatus = scoringRepository.getMLModelStatus;
module.exports.getMLTrainingData = scoringRepository.getMLTrainingData;
module.exports.getMLScoreForNetwork = scoringRepository.getMLScoreForNetwork;
module.exports.getNetworksByThreatLevel = scoringRepository.getNetworksByThreatLevel;
module.exports.getNetworksForBehavioralScoring = scoringRepository.getNetworksForBehavioralScoring;
module.exports.bulkUpsertThreatScores = scoringRepository.bulkUpsertThreatScores;
