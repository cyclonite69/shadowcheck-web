const { query } = require('../config/database');
const logger = require('../logging/logger');

class ThreatScoringService {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalProcessed: 0,
      totalUpdated: 0,
      averageExecutionTime: 0,
      lastError: null,
    };
  }

  async computeThreatScores(batchSize = 1000, maxAgeHours = 24) {
    if (this.isRunning) {
      logger.warn('Threat scoring already running, skipping');
      return { skipped: true };
    }

    this.isRunning = true;
    try {
      const startTime = Date.now();
      logger.info('Starting unified threat score computation', { batchSize, maxAgeHours });

      const insertQuery = `
        WITH targets AS (
          SELECT ap.bssid
          FROM public.access_points ap
          WHERE ap.bssid IS NOT NULL
          ORDER BY ap.bssid
          LIMIT $1
        ),
        scored AS (
          SELECT
            t.bssid,
            calculate_threat_score_v3(t.bssid) AS details
          FROM targets t
        )
        INSERT INTO app.network_threat_scores
          (bssid, rule_based_score, rule_based_flags, final_threat_score,
           final_threat_level, model_version, scored_at)
        SELECT
          bssid,
          (details->>'score')::numeric,
          details,
          (details->>'score')::numeric,
          CASE
            WHEN (details->>'score')::numeric >= 80 THEN 'CRITICAL'
            WHEN (details->>'score')::numeric >= 60 THEN 'HIGH'
            WHEN (details->>'score')::numeric >= 40 THEN 'MED'
            WHEN (details->>'score')::numeric >= 20 THEN 'LOW'
            ELSE 'NONE'
          END,
          'rule-v3.1',
          NOW()
        FROM scored
        ON CONFLICT (bssid) DO UPDATE SET
          rule_based_score = EXCLUDED.rule_based_score,
          rule_based_flags = EXCLUDED.rule_based_flags,
          final_threat_score = EXCLUDED.final_threat_score,
          final_threat_level = EXCLUDED.final_threat_level,
          model_version = EXCLUDED.model_version,
          scored_at = NOW(),
          updated_at = NOW()
      `;

      const result = await query(insertQuery, [batchSize]);
      const processed = result.rowCount || 0;
      const executionTimeMs = Date.now() - startTime;

      this.stats = {
        totalProcessed: this.stats.totalProcessed + processed,
        totalUpdated: this.stats.totalUpdated + processed,
        averageExecutionTime: executionTimeMs,
        lastError: null,
      };

      this.lastRun = new Date();

      logger.info('Unified threat score computation completed', {
        processed,
        updated: processed,
        executionTimeMs: executionTimeMs,
        totalProcessed: this.stats.totalProcessed,
      });

      return {
        success: true,
        processed,
        updated: processed,
        executionTimeMs: executionTimeMs,
      };
    } catch (error) {
      this.stats.lastError = error.message;
      logger.error('Threat score computation failed', { error: error.message });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async markAllForRecompute() {
    try {
      const result = await this.computeThreatScores(1000000, 0);
      return { success: true, rowsAffected: result.processed || 0 };
    } catch (error) {
      logger.error('Failed to mark networks for recomputation', { error: error.message });
      throw error;
    }
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
    };
  }

  startScheduledJobs() {
    logger.info('Threat scoring scheduled jobs disabled (manual-only mode)');
  }
}

module.exports = new ThreatScoringService();
