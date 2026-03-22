/**
 * Background Jobs Service
 * Manages scheduled tasks for ML scoring and automated backups
 */

const schedule = require('node-schedule');
const logger = require('../logging/logger');
const { runPostgresBackup } = require('./backupService');
const mlScoringService = require('./mlScoringService');
const networkService = require('./networkService');
const networkTagService = require('./networkTagService');
const { query } = require('../config/database');
const { getJobStatus, trackJobRun } = require('./jobRunRepository');

export {};

const ML_SCORING_CRON = '0 */4 * * *';
// Daily backup at 3:00 AM (off-peak)
const BACKUP_CRON = process.env.BACKUP_CRON || '0 3 * * *';
// Daily MV refresh at 4:30 AM (after backup and some scoring)
const MV_REFRESH_CRON = process.env.MV_REFRESH_CRON || '30 4 * * *';

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

const JOB_SETTING_KEYS = {
  backup: 'backup_job_config',
  mlScoring: 'ml_scoring_job_config',
  mvRefresh: 'mv_refresh_job_config',
} as const;

const DEFAULT_JOB_CONFIGS = {
  backup: { enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true', cron: BACKUP_CRON },
  mlScoring: { enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true', cron: ML_SCORING_CRON },
  mvRefresh: { enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true', cron: MV_REFRESH_CRON },
};

type BackgroundJobName = keyof typeof JOB_SETTING_KEYS;
export type { BackgroundJobName };

class BackgroundJobsService {
  static jobs: Record<string, any> = {};
  static lastConfig: Record<string, any> = {};
  static runningJobIds: Partial<Record<BackgroundJobName, number>> = {};

  /**
   * Initialize background jobs
   */
  static async initialize() {
    logger.info('[Background Jobs] Initializing background jobs service...');

    try {
      // Perform initial job scheduling from database
      await this.rescheduleJobs();

      // Start configuration poller (every 5 minutes)
      this.startConfigPoller();

      logger.info('[Background Jobs] Initialization complete');
    } catch (error) {
      logger.error('[Background Jobs] Initialization failed:', error);
      // Fallback to manual scheduling if DB fails initially
      this.scheduleMLScoring();
      this.scheduleBackup();
      this.scheduleMVRefresh();
    }
  }

  /**
   * Poll database for configuration changes every 5 minutes
   */
  static startConfigPoller() {
    this.jobs.poller = schedule.scheduleJob('*/5 * * * *', async () => {
      await this.rescheduleJobs();
    });
  }

  /**
   * Reschedule all jobs based on database settings
   */
  static async rescheduleJobs() {
    try {
      const { rows } = await query(
        "SELECT key, value FROM app.settings WHERE key IN ('backup_job_config', 'ml_scoring_job_config', 'mv_refresh_job_config')"
      );

      const configs: Record<string, any> = {};
      rows.forEach((row: any) => {
        configs[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      });

      // 1. Backup Job
      const backupConfig = configs.backup_job_config || DEFAULT_JOB_CONFIGS.backup;
      if (this.hasConfigChanged('backup', backupConfig)) {
        this.updateJob('backup', backupConfig, () => this.runScheduledBackup());
      }

      // 2. ML Scoring Job
      const mlConfig = configs.ml_scoring_job_config || DEFAULT_JOB_CONFIGS.mlScoring;
      if (this.hasConfigChanged('mlScoring', mlConfig)) {
        this.updateJob('mlScoring', mlConfig, () => this.runMLScoring());
      }

      // 3. MV Refresh Job
      const mvConfig = configs.mv_refresh_job_config || DEFAULT_JOB_CONFIGS.mvRefresh;
      if (this.hasConfigChanged('mvRefresh', mvConfig)) {
        this.updateJob('mvRefresh', mvConfig, () => this.runMVRefresh());
      }

      this.lastConfig = configs;
    } catch (error) {
      logger.error('[Background Jobs] Failed to reschedule jobs from database:', error.message);
    }
  }

  /**
   * Check if a job configuration has changed
   */
  static hasConfigChanged(jobName: string, newConfig: any): boolean {
    const oldConfig = this.lastConfig[`${jobName}_job_config`];
    if (!oldConfig) return true;
    return oldConfig.enabled !== newConfig.enabled || oldConfig.cron !== newConfig.cron;
  }

  /**
   * Update a specific job (cancel and reschedule if needed)
   */
  static updateJob(name: string, config: any, task: () => Promise<void>) {
    if (this.jobs[name]) {
      this.jobs[name].cancel();
      delete this.jobs[name];
    }

    if (config.enabled) {
      this.jobs[name] = schedule.scheduleJob(config.cron, async () => {
        await task();
      });
      logger.info(`[Background Jobs] Job '${name}' scheduled: ${config.cron}`);
    } else {
      logger.info(`[Background Jobs] Job '${name}' disabled`);
    }
  }

  /**
   * Schedule ML scoring: Every 4 hours (0:00, 4:00, 8:00, 12:00, 16:00, 20:00)
   * (Retained for manual/fallback use)
   */
  static scheduleMLScoring() {
    this.updateJob('mlScoring', { enabled: true, cron: ML_SCORING_CRON }, () =>
      this.runMLScoring()
    );
  }

  /**
   * Schedule automated backup: Daily at 3:00 AM (configurable via BACKUP_CRON)
   * (Retained for manual/fallback use)
   */
  static scheduleBackup() {
    this.updateJob('backup', { enabled: true, cron: BACKUP_CRON }, () => this.runScheduledBackup());
  }

  /**
   * Schedule Materialized View refresh: Daily at 4:30 AM
   * (Retained for manual/fallback use)
   */
  static scheduleMVRefresh() {
    this.updateJob('mvRefresh', { enabled: true, cron: MV_REFRESH_CRON }, () =>
      this.runMVRefresh()
    );
  }

  /**
   * Run automated backup with S3 upload
   */
  static async runScheduledBackup() {
    await trackJobRun(
      'backup',
      async () => {
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
      },
      {
        lastConfig: this.lastConfig,
        runningJobIds: this.runningJobIds,
      }
    );
  }

  /**
   * Refresh all materialized views
   */
  static async runMVRefresh() {
    await trackJobRun(
      'mvRefresh',
      async () => {
        logger.info('[MV Refresh Job] Starting materialized view refresh...');

        const views = [
          { name: 'app.api_network_explorer_mv', concurrent: true },
          { name: 'app.api_network_latest_mv', concurrent: false },
          { name: 'app.analytics_summary_mv', concurrent: false },
          { name: 'app.mv_network_timeline', concurrent: false },
        ];

        const failures: Array<{ view: string; error: string }> = [];

        for (const view of views) {
          try {
            const sql = `REFRESH MATERIALIZED VIEW ${view.concurrent ? 'CONCURRENTLY ' : ''}${view.name}`;
            logger.info(`[MV Refresh Job] Refreshing ${view.name}...`);
            await query(sql);
          } catch (error) {
            failures.push({ view: view.name, error: error.message });
            logger.error(`[MV Refresh Job] Failed to refresh ${view.name}: ${error.message}`);
          }
        }

        if (failures.length > 0) {
          const summary = failures.map((failure) => `${failure.view}: ${failure.error}`).join('; ');
          throw new Error(summary);
        }

        return { refreshedViews: views.map((view) => view.name) };
      },
      {
        lastConfig: this.lastConfig,
        runningJobIds: this.runningJobIds,
      }
    );
  }

  /**
   * Run behavioral threat scoring for all networks (v2.0 - Simple)
   * Based on mobility patterns, not user tags
   */
  static async runMLScoring() {
    await trackJobRun(
      'mlScoring',
      async () => {
        logger.info('[ML Scoring Job] Starting behavioral threat scoring v2.0 (simple)...');
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
        const tagRows = await networkTagService.getManualThreatTags();

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
        logger.info(
          `[ML Scoring Job] Complete: ${inserted} networks scored with behavioral model v2.0`
        );

        // Step 2: Run OUI grouping and MAC randomization detection
        logger.info('[ML Scoring Job] Running OUI grouping analysis...');
        const OUIGroupingService = require('./ouiGroupingService');
        await OUIGroupingService.generateOUIGroups();
        await OUIGroupingService.detectMACRandomization();
        logger.info('[ML Scoring Job] OUI grouping complete');

        return {
          analyzedNetworks: networks.length,
          insertedScores: inserted,
          feedbackTaggedNetworks: tagMap.size,
        };
      },
      {
        lastConfig: this.lastConfig,
        runningJobIds: this.runningJobIds,
      }
    );
  }

  static async getJobStatus() {
    return getJobStatus(this.jobs);
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
