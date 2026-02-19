/**
 * Background Jobs Service
 * Manages scheduled tasks for ML scoring and automated backups
 */

const schedule = require('node-schedule');
const logger = require('../logging/logger');
const { runPostgresBackup } = require('./backupService');
const mlScoringService = require('./mlScoringService');
const networkService = require('./networkService');

export {};

const ML_SCORING_CRON = '0 */4 * * *';
// Daily backup at 3:00 AM (off-peak)
const BACKUP_CRON = process.env.BACKUP_CRON || '0 3 * * *';
const ML_SCORING_LIMIT = 10000;
const MAX_BSSID_LENGTH = 17;
const MIN_OBSERVATIONS = 2;
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

class BackgroundJobsService {
  static jobs: Record<string, unknown> = {};

  /**
   * Initialize background jobs
   */
  static async initialize() {
    logger.info('[Background Jobs] Initializing background jobs service...');

    try {
      // Schedule ML scoring every 4 hours
      this.scheduleMLScoring();

      // Schedule daily backup to S3
      this.scheduleBackup();

      logger.info('[Background Jobs] Initialization complete');
    } catch (error) {
      logger.error('[Background Jobs] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Schedule ML scoring: Every 4 hours (0:00, 4:00, 8:00, 12:00, 16:00, 20:00)
   */
  static scheduleMLScoring() {
    // Cron pattern: 0 */4 * * * (at minute 0 of every 4th hour)
    const rule = ML_SCORING_CRON;

    this.jobs.mlScoring = schedule.scheduleJob(rule, async () => {
      await this.runMLScoring();
    });

    logger.info('[Background Jobs] ML scoring scheduled: every 4 hours (0, 4, 8, 12, 16, 20:00)');
  }

  /**
   * Schedule automated backup: Daily at 3:00 AM (configurable via BACKUP_CRON)
   */
  static scheduleBackup() {
    this.jobs.backup = schedule.scheduleJob(BACKUP_CRON, async () => {
      await this.runScheduledBackup();
    });

    logger.info(`[Background Jobs] Backup scheduled: ${BACKUP_CRON}`);
  }

  /**
   * Run automated backup with S3 upload
   */
  static async runScheduledBackup() {
    const startTime = Date.now();
    logger.info('[Backup Job] Starting scheduled backup...');

    try {
      const result = await runPostgresBackup({ uploadToS3: true });
      const duration = Date.now() - startTime;

      if (result.s3) {
        logger.info(
          `[Backup Job] Complete: ${result.fileName} (${result.bytes} bytes) uploaded to ${result.s3.url} in ${duration}ms`
        );
      } else if (result.s3Error) {
        logger.warn(
          `[Backup Job] Backup created locally (${result.fileName}) but S3 upload failed: ${result.s3Error}`
        );
      }
    } catch (error) {
      logger.error(`[Backup Job] Failed: ${error.message}`);
    }
  }

  /**
   * Run behavioral threat scoring for all networks (v2.0 - Simple)
   * Based on mobility patterns, not user tags
   */
  static async runMLScoring() {
    const startTime = Date.now();
    logger.info('[ML Scoring Job] Starting behavioral threat scoring v2.0 (simple)...');

    try {
      // Simple behavioral query - avoid complex PostGIS calculations
      const networks = await mlScoringService.getNetworksForBehavioralScoring(
        ML_SCORING_LIMIT,
        MIN_OBSERVATIONS,
        MAX_BSSID_LENGTH
      );

      const scores = [];

      logger.info(
        `[ML Scoring Job] Analyzing ${networks.length} networks with feedback-aware behavioral model`
      );

      // Step 1: Query all manual tags for feedback-aware scoring
      const tagRows = await networkService.getManualThreatTags();

      // Step 2: Create tag lookup map
      const tagMap = new Map();
      for (const tag of tagRows) {
        tagMap.set(tag.bssid, {
          tag: tag.threat_tag,
          confidence: tag.threat_confidence || 1.0,
          notes: tag.notes,
        });
      }

      logger.info(`[ML Scoring Job] Found ${tagMap.size} manual tags for feedback adjustment`);

      // Step 3: Score each network with feedback-aware model
      for (const net of networks) {
        try {
          // Calculate base ML score using behavioral model
          const mobility =
            net.max_distance_km > MOBILITY_HIGH_KM
              ? 80
              : net.max_distance_km > MOBILITY_MED_KM
                ? 40
                : 0;
          const persistence =
            net.unique_days > PERSISTENCE_HIGH_DAYS
              ? 60
              : net.unique_days > PERSISTENCE_MED_DAYS
                ? 30
                : 0;
          const baseMlScore = mobility * 0.6 + persistence * 0.4;

          // Step 4: Apply feedback adjustment based on manual tags
          let finalScore = baseMlScore;
          let feedbackApplied = false;

          const tag = tagMap.get(net.bssid);
          if (tag) {
            feedbackApplied = true;
            switch (tag.tag) {
              case 'FALSE_POSITIVE':
                finalScore = baseMlScore * FEEDBACK_MULTIPLIERS.FALSE_POSITIVE; // Suppress threat
                break;
              case 'THREAT':
                finalScore =
                  baseMlScore * (1.0 + tag.confidence * FEEDBACK_MULTIPLIERS.THREAT_BOOST); // Boost threat
                break;
              case 'SUSPECT':
                finalScore =
                  baseMlScore * (1.0 + tag.confidence * FEEDBACK_MULTIPLIERS.SUSPECT_BOOST); // Moderate boost
                break;
              case 'INVESTIGATE':
                finalScore = baseMlScore; // Keep ML score unchanged
                break;
            }
          }

          // Step 5: Calculate final threat level from adjusted score
          let threatLevel = 'NONE';
          if (finalScore >= THREAT_LEVEL_THRESHOLDS.CRITICAL) {
            threatLevel = 'CRITICAL';
          } else if (finalScore >= THREAT_LEVEL_THRESHOLDS.HIGH) {
            threatLevel = 'HIGH';
          } else if (finalScore >= THREAT_LEVEL_THRESHOLDS.MED) {
            threatLevel = 'MED';
          } else if (finalScore >= THREAT_LEVEL_THRESHOLDS.LOW) {
            threatLevel = 'LOW';
          }

          // Step 6: Store both ML and final scores with feedback metadata
          scores.push({
            bssid: net.bssid,
            ml_threat_score: baseMlScore,
            ml_threat_probability: baseMlScore / 100.0,
            ml_primary_class: baseMlScore >= 60 ? 'THREAT' : 'LEGITIMATE',
            rule_based_score: 0,
            final_threat_score: finalScore,
            final_threat_level: threatLevel,
            model_version: '2.0.0',
            feedback_applied: feedbackApplied,
            manual_tag: tag ? tag.tag : null,
          });
        } catch (netError) {
          logger.debug(`[ML Scoring Job] Error scoring ${net.bssid}: ${netError.message}`);
        }
      }

      // Bulk insert scores
      const inserted = await mlScoringService.bulkUpsertThreatScores(scores);

      const duration = Date.now() - startTime;
      logger.info(
        `[ML Scoring Job] Complete: ${inserted} networks scored with behavioral model v2.0 in ${duration}ms`
      );

      // Step 2: Run OUI grouping and MAC randomization detection
      logger.info('[ML Scoring Job] Running OUI grouping analysis...');
      const OUIGroupingService = require('./ouiGroupingService');
      await OUIGroupingService.generateOUIGroups();
      await OUIGroupingService.detectMACRandomization();
      logger.info('[ML Scoring Job] OUI grouping complete');
    } catch (error) {
      logger.error(`[ML Scoring Job] Failed: ${error.message}`);
    }
  }

  /**
   * Manually trigger scoring (for testing)
   */
  static async scoreNow() {
    logger.info('[Background Jobs] Manual trigger: ML scoring');
    return this.runMLScoring();
  }

  /**
   * Shutdown all jobs
   */
  static shutdown() {
    logger.info('[Background Jobs] Shutting down...');
    Object.values(this.jobs).forEach((job: any) => {
      if (job) {
        job.cancel();
      }
    });
    logger.info('[Background Jobs] All jobs cancelled');
  }
}

BackgroundJobsService.jobs = {};

module.exports = BackgroundJobsService;
