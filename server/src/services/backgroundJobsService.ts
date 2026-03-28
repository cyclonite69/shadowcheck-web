/**
 * Background Jobs Service
 * Manages scheduled tasks for ML scoring and automated backups
 */

const schedule = require('node-schedule');
const logger = require('../logging/logger');
const { adminQuery } = require('./adminDbService');
const { getJobStatus, trackJobRun } = require('../repositories/jobRunRepository');

export {};

import {
  BACKUP_CRON,
  DEFAULT_JOB_CONFIGS,
  ML_SCORING_CRON,
  MV_REFRESH_CRON,
} from './backgroundJobs/config';
import {
  getResolvedJobConfig,
  hasJobConfigChanged,
  loadBackgroundJobConfigs,
} from './backgroundJobs/settings';
import { refreshMaterializedViews } from './backgroundJobs/mvRefresh';
import { runBackupJob, runBehavioralMlScoringJob } from './backgroundJobs/runners';
import type { BackgroundJobName } from './backgroundJobs/config';

export type { BackgroundJobName };

class BackgroundJobsService {
  static jobs: Record<string, any> = {};
  static lastConfig: Record<string, any> = {};
  static lastSchedulerEnabled: boolean | null = null;
  static runningJobIds: Partial<Record<BackgroundJobName, number>> = {};
  static initialized = false;

  static isSchedulerEnabled() {
    const featureFlagService = require('./featureFlagService');
    return featureFlagService.getFlag('enable_background_jobs');
  }

  /**
   * Initialize background jobs
   */
  static async initialize() {
    if (this.initialized) {
      await this.rescheduleJobs();
      return;
    }

    logger.info('[Background Jobs] Initializing background jobs service...');

    try {
      // Perform initial job scheduling from database
      await this.rescheduleJobs();

      // Start configuration poller (every 5 minutes)
      this.startConfigPoller();
      this.initialized = true;

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
      const configs = await loadBackgroundJobConfigs();

      const schedulerEnabled = this.isSchedulerEnabled();

      // 1. Backup Job
      const backupConfig = getResolvedJobConfig(configs, 'backup');
      if (
        hasJobConfigChanged(this.lastConfig, 'backup', backupConfig) ||
        this.lastSchedulerEnabled !== schedulerEnabled
      ) {
        this.updateJob('backup', backupConfig, () => this.runScheduledBackup(), schedulerEnabled);
      }

      // 2. ML Scoring Job
      const mlConfig = getResolvedJobConfig(configs, 'mlScoring');
      if (
        hasJobConfigChanged(this.lastConfig, 'mlScoring', mlConfig) ||
        this.lastSchedulerEnabled !== schedulerEnabled
      ) {
        this.updateJob('mlScoring', mlConfig, () => this.runMLScoring(), schedulerEnabled);
      }

      // 3. MV Refresh Job
      const mvConfig = getResolvedJobConfig(configs, 'mvRefresh');
      if (
        hasJobConfigChanged(this.lastConfig, 'mvRefresh', mvConfig) ||
        this.lastSchedulerEnabled !== schedulerEnabled
      ) {
        this.updateJob('mvRefresh', mvConfig, () => this.runMVRefresh(), schedulerEnabled);
      }

      this.lastConfig = configs;
      this.lastSchedulerEnabled = schedulerEnabled;
    } catch (error) {
      logger.error(
        '[Background Jobs] Failed to reschedule jobs from database:',
        (error as Error).message
      );
    }
  }

  /**
   * Update a specific job (cancel and reschedule if needed)
   */
  static updateJob(
    name: string,
    config: any,
    task: () => Promise<void>,
    schedulerEnabled = this.isSchedulerEnabled()
  ) {
    if (this.jobs[name]) {
      this.jobs[name].cancel();
      delete this.jobs[name];
    }

    if (!schedulerEnabled) {
      logger.info(
        `[Background Jobs] Scheduler disabled by ENABLE_BACKGROUND_JOBS=false; '${name}' remains manual-only`
      );
      return;
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

  static async applySchedulerFlagChange() {
    if (this.isSchedulerEnabled()) {
      await this.initialize();
      return;
    }

    await this.rescheduleJobs();
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
    if (this.runningJobIds.backup) {
      throw new Error('backup job already running');
    }
    await trackJobRun('backup', async () => runBackupJob(), {
      lastConfig: this.lastConfig,
      runningJobIds: this.runningJobIds,
    });
  }

  /**
   * Refresh all materialized views
   */
  static async runMVRefresh() {
    if (this.runningJobIds.mvRefresh) {
      throw new Error('materialized view refresh job already running');
    }
    await trackJobRun('mvRefresh', async () => refreshMaterializedViews(adminQuery), {
      lastConfig: this.lastConfig,
      runningJobIds: this.runningJobIds,
    });
  }

  /**
   * Run behavioral threat scoring for all networks (v2.0 - Simple)
   * Based on mobility patterns, not user tags
   */
  static async runMLScoring() {
    if (this.runningJobIds.mlScoring) {
      throw new Error('ML scoring job already running');
    }
    await trackJobRun('mlScoring', async () => runBehavioralMlScoringJob(), {
      lastConfig: this.lastConfig,
      runningJobIds: this.runningJobIds,
    });
  }

  static async getJobStatus() {
    const status = await getJobStatus(this.jobs);
    return {
      ...status,
      schedulerEnabled: this.isSchedulerEnabled(),
      schedulerInitialized: this.initialized,
    };
  }

  /**
   * Manually trigger scoring (for testing)
   */
  static async scoreNow() {
    logger.info('[Background Jobs] Manual trigger: ML scoring');
    return this.runMLScoring();
  }

  static async runJobNow(jobName: BackgroundJobName) {
    logger.info('[Background Jobs] Manual trigger requested', { jobName });

    if (jobName === 'backup') {
      await this.runScheduledBackup();
      return { jobName, status: 'completed' };
    }

    if (jobName === 'mlScoring') {
      await this.runMLScoring();
      return { jobName, status: 'completed' };
    }

    if (jobName === 'mvRefresh') {
      await this.runMVRefresh();
      return { jobName, status: 'completed' };
    }

    throw new Error(`Unsupported background job: ${jobName}`);
  }

  static async startJobNow(jobName: BackgroundJobName) {
    logger.info('[Background Jobs] Manual background start requested', { jobName });

    const jobPromise = this.runJobNow(jobName).catch((error) => {
      logger.error('[Background Jobs] Manual background run failed', {
        jobName,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    void jobPromise;

    return { jobName, status: 'started' };
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
    this.initialized = false;
    logger.info('[Background Jobs] All jobs cancelled');
  }
}

BackgroundJobsService.jobs = {};

module.exports = BackgroundJobsService;
