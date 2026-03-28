export {};

const logger = require('../../logging/logger');
const { runPostgresBackup } = require('../backupService');
const mlScoringRepository = require('../ml/repository');
const networkTagService = require('../networkTagService');
const OUIGroupingService = require('../ouiGroupingService');

import { scoreBehavioralThreats } from './mlBehavioralScoring';

const ML_SCORING_LIMIT = 10000;
const MAX_BSSID_LENGTH = 17;
const MIN_OBSERVATIONS = 2;

const runBackupJob = async () => {
  logger.info('[Backup Job] Starting scheduled backup...');
  const result = await runPostgresBackup({ uploadToS3: true });

  if (result.s3) {
    logger.info(
      `[Backup Job] Complete: ${result.fileName} (${result.bytes} bytes) uploaded to ${result.s3.url}`
    );
  } else if (result.s3Error) {
    logger.warn(
      `[Backup Job] Backup created locally (${result.fileName}) but S3 upload failed: ${result.s3Error}`
    );
  }

  return {
    fileName: result.fileName,
    bytes: result.bytes,
    s3Url: result.s3?.url || null,
    s3Error: result.s3Error || null,
  };
};

const runBehavioralMlScoringJob = async () => {
  logger.info('[ML Scoring Job] Starting behavioral threat scoring v2.0 (simple)...');

  const networks = await mlScoringRepository.getNetworksForBehavioralScoring(
    ML_SCORING_LIMIT,
    MIN_OBSERVATIONS,
    MAX_BSSID_LENGTH
  );

  logger.info(
    `[ML Scoring Job] Analyzing ${networks.length} networks with feedback-aware behavioral model`
  );

  const tagRows = await networkTagService.getManualThreatTags();
  const { scores, tagMap } = scoreBehavioralThreats(networks, tagRows);

  logger.info(`[ML Scoring Job] Found ${tagMap.size} manual tags for feedback adjustment`);

  const inserted = await mlScoringRepository.bulkUpsertThreatScores(scores);
  logger.info(`[ML Scoring Job] Complete: ${inserted} networks scored with behavioral model v2.0`);

  logger.info('[ML Scoring Job] Running OUI grouping analysis...');
  await OUIGroupingService.generateOUIGroups();
  await OUIGroupingService.detectMACRandomization();
  logger.info('[ML Scoring Job] OUI grouping complete');

  return {
    analyzedNetworks: networks.length,
    insertedScores: inserted,
    feedbackTaggedNetworks: tagMap.size,
  };
};

const runSiblingDetectionJob = async (options: any = {}) => {
  const { adminQuery } = require('../adminDbService');
  logger.info('[Sibling Detection Job] Starting sibling radio discovery...');

  const maxOctetDelta = options.max_octet_delta || 6;
  const maxDistanceM = options.max_distance_m || 5000;
  const minCandidateConf = options.min_candidate_conf || 0.7;
  const seedLimit = options.seed_limit || 1000;
  const incremental = options.incremental !== undefined ? options.incremental : true;

  const result = await adminQuery(
    'SELECT app.refresh_network_sibling_pairs($1, $2, $3, 0.92, $4, $5) as count',
    [maxOctetDelta, maxDistanceM, minCandidateConf, seedLimit, incremental]
  );

  const count = parseInt(result.rows[0]?.count || '0');
  logger.info(`[Sibling Detection Job] Complete: Identified/updated ${count} sibling pairs`);

  return {
    pairsProcessed: count,
    parameters: { maxOctetDelta, maxDistanceM, minCandidateConf, seedLimit, incremental },
  };
};

export { runBackupJob, runBehavioralMlScoringJob, runSiblingDetectionJob };
