const cron = require('node-cron');
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
    const startTime = Date.now();

    try {
      logger.info('Starting incremental threat score computation', { batchSize, maxAgeHours });

      const result = await query('SELECT * FROM refresh_threat_scores_incremental($1, $2)', [
        batchSize,
        maxAgeHours,
      ]);

      const stats = result.rows[0];
      this.stats = {
        totalProcessed: this.stats.totalProcessed + stats.processed_count,
        totalUpdated: this.stats.totalUpdated + stats.updated_count,
        averageExecutionTime: stats.execution_time_ms,
        lastError: null,
      };

      this.lastRun = new Date();

      logger.info('Threat score computation completed', {
        processed: stats.processed_count,
        updated: stats.updated_count,
        executionTimeMs: stats.execution_time_ms,
        totalProcessed: this.stats.totalProcessed,
      });

      return {
        success: true,
        processed: stats.processed_count,
        updated: stats.updated_count,
        executionTimeMs: stats.execution_time_ms,
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
      const result = await query(
        'UPDATE public.api_network_explorer_mv SET needs_recompute = TRUE, threat_computed_at = NULL'
      );
      logger.info('Marked all networks for threat recomputation', {
        rowsAffected: result.rowCount,
      });
      return { success: true, rowsAffected: result.rowCount };
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
    // Run every 15 minutes during business hours (8 AM - 6 PM)
    cron.schedule('*/15 8-18 * * *', async () => {
      try {
        await this.computeThreatScores(500, 1); // Smaller batches, more frequent
      } catch (error) {
        logger.error('Scheduled threat scoring failed', { error: error.message });
      }
    });

    // Run larger batch every 2 hours outside business hours
    cron.schedule('0 */2 * * *', async () => {
      const hour = new Date().getHours();
      if (hour < 8 || hour > 18) {
        try {
          await this.computeThreatScores(2000, 6); // Larger batches, older data
        } catch (error) {
          logger.error('Scheduled threat scoring failed', { error: error.message });
        }
      }
    });

    // Full recomputation weekly (Sunday 2 AM)
    cron.schedule('0 2 * * 0', async () => {
      try {
        await this.markAllForRecompute();
        await this.computeThreatScores(5000, 168); // Large batch, 1 week old data
      } catch (error) {
        logger.error('Weekly threat recomputation failed', { error: error.message });
      }
    });

    logger.info('Threat scoring scheduled jobs started');
  }
}

module.exports = new ThreatScoringService();
