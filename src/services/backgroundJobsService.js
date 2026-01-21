/**
 * Background Jobs Service
 * Manages scheduled tasks for ML scoring
 */

const schedule = require('node-schedule');
const { query } = require('../config/database');
const logger = require('../logging/logger');

class BackgroundJobsService {
  static jobs = {};

  /**
   * Initialize background jobs
   */
  static async initialize() {
    logger.info('[Background Jobs] Initializing background jobs service...');

    try {
      // Schedule ML scoring every 4 hours
      this.scheduleMLScoring();

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
    const rule = '0 */4 * * *';

    this.jobs.mlScoring = schedule.scheduleJob(rule, async () => {
      await this.runMLScoring();
    });

    logger.info('[Background Jobs] ML scoring scheduled: every 4 hours (0, 4, 8, 12, 16, 20:00)');
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
      const networkResult = await query(`
        SELECT 
          ap.bssid,
          COUNT(DISTINCT obs.id) as observation_count,
          COUNT(DISTINCT DATE(obs.observed_at)) as unique_days,
          COALESCE(MAX(ABS(obs.lon - (-79.3832)) + ABS(obs.lat - 43.6532)) * 111, 0) as max_distance_km
        FROM public.access_points ap
        LEFT JOIN public.observations obs ON ap.bssid = obs.bssid
        WHERE ap.bssid IS NOT NULL
          AND obs.id IS NOT NULL
          AND LENGTH(ap.bssid) <= 17
          AND obs.lon IS NOT NULL
          AND obs.lat IS NOT NULL
        GROUP BY ap.bssid
        HAVING COUNT(DISTINCT obs.id) > 2
        LIMIT 10000
      `);

      const networks = networkResult.rows;
      const scores = [];

      logger.info(`[ML Scoring Job] Analyzing ${networks.length} networks with simple behavioral model`);

      // Score each network with simple behavioral model
      for (const net of networks) {
        try {
          // Simple mobility scoring
          const mobility = net.max_distance_km > 5 ? 80 : net.max_distance_km > 1 ? 40 : 0;
          const persistence = net.unique_days > 7 ? 60 : net.unique_days > 3 ? 30 : 0;
          const threatScore = mobility * 0.6 + persistence * 0.4;

          // Threat level with behavioral thresholds
          let threatLevel = 'NONE';
          if (threatScore >= 60) threatLevel = 'HIGH';      // Suspicious mobility
          else if (threatScore >= 30) threatLevel = 'MED';  // Unusual patterns
          else if (threatScore >= 10) threatLevel = 'LOW';  // Minor anomalies

          scores.push({
            bssid: net.bssid,
            ml_threat_score: threatScore,
            ml_threat_probability: threatScore / 100.0,
            ml_primary_class: threatScore >= 60 ? 'THREAT' : 'LEGITIMATE',
            rule_based_score: 0,
            final_threat_score: threatScore,
            final_threat_level: threatLevel,
            model_version: '2.0.0'
          });
        } catch (netError) {
          logger.debug(`[ML Scoring Job] Error scoring ${net.bssid}: ${netError.message}`);
        }
      }

      // Bulk insert scores
      let inserted = 0;
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
            model_version = EXCLUDED.model_version,
            updated_at = NOW()
        `, [
          score.bssid, score.ml_threat_score, score.ml_threat_probability,
          score.ml_primary_class, score.rule_based_score, score.final_threat_score,
          score.final_threat_level, score.model_version
        ]);
        inserted++;
      }

      const duration = Date.now() - startTime;
      logger.info(`[ML Scoring Job] Complete: ${inserted} networks scored with behavioral model v2.0 in ${duration}ms`);

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
    return await this.runMLScoring();
  }

  /**
   * Shutdown all jobs
   */
  static shutdown() {
    logger.info('[Background Jobs] Shutting down...');
    Object.values(this.jobs).forEach(job => {
      if (job) job.cancel();
    });
    logger.info('[Background Jobs] All jobs cancelled');
  }
}

module.exports = BackgroundJobsService;
