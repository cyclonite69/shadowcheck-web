const { query } = require('../config/database');
const logger = require('../logging/logger');

// Type definitions for threat scoring

type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MED' | 'LOW' | 'NONE';

interface ThreatScoringStats {
  totalProcessed: number;
  totalUpdated: number;
  averageExecutionTime: number;
  lastError: string | null;
}

interface ComputeThreatScoresResult {
  success?: boolean;
  skipped?: boolean;
  processed?: number;
  updated?: number;
  executionTimeMs?: number;
}

interface MarkForRecomputeResult {
  success: boolean;
  rowsAffected: number;
}

interface FullStats extends ThreatScoringStats {
  isRunning: boolean;
  lastRun: Date | null;
}

interface QueryResult {
  rowCount: number | null;
  rows: unknown[];
}

class ThreatScoringService {
  private isRunning: boolean;
  private lastRun: Date | null;
  private stats: ThreatScoringStats;

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

  async computeThreatScores(
    batchSize: number = 1000,
    maxAgeHours: number = 24
  ): Promise<ComputeThreatScoresResult> {
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
          FROM app.access_points ap
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

      const result: QueryResult = await query(insertQuery, [batchSize]);
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
      const err = error as Error;
      this.stats.lastError = err.message;
      logger.error('Threat score computation failed', { error: err.message });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async markAllForRecompute(): Promise<MarkForRecomputeResult> {
    try {
      const result = await this.computeThreatScores(1000000, 0);
      return { success: true, rowsAffected: result.processed || 0 };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to mark networks for recomputation', { error: err.message });
      throw error;
    }
  }

  getStats(): FullStats {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
    };
  }

  startScheduledJobs(): void {
    logger.info('Threat scoring scheduled jobs disabled (manual-only mode)');
  }
}

module.exports = new ThreatScoringService();

// Export types for consumers
export type {
  ThreatLevel,
  ThreatScoringStats,
  ComputeThreatScoresResult,
  MarkForRecomputeResult,
  FullStats,
};

// Additional threat service methods

const { CONFIG } = require('../config/database');

/**
 * Get quick threat detection results
 */
export async function getQuickThreats(params: {
  limit: number;
  offset: number;
  minObservations: number;
  minUniqueDays: number;
  minUniqueLocations: number;
  minRangeKm: number;
  minThreatScore: number;
  minTimestamp: number;
}): Promise<{ rows: any[]; totalCount: number }> {
  const result = await query(
    `
    SELECT
      ne.bssid,
      ne.ssid,
      ne.type as radio_type,
      ne.frequency as channel,
      ne.signal as signal_dbm,
      ne.security as encryption,
      ne.lat as latitude,
      ne.lon as longitude,
      ne.observations,
      ne.unique_days,
      ne.unique_locations,
      ne.first_seen,
      ne.last_seen,
      (ne.max_distance_meters / 1000.0) as distance_range_km,
      COALESCE(nts.final_threat_score, 0) as threat_score,
      COALESCE(nts.final_threat_level, 'NONE') as threat_level,
      COUNT(*) OVER() as total_count
    FROM app.api_network_explorer_mv ne
    LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
    WHERE ne.last_seen >= to_timestamp($1 / 1000.0)
      AND ne.observations >= $4
      AND ne.unique_days >= $5
      AND ne.unique_locations >= $6
      AND (ne.max_distance_meters / 1000.0) >= $7
      AND COALESCE(nts.final_threat_score, 0) >= $8
      AND (ne.type NOT IN ('L', 'N', 'G') OR ne.max_distance_meters > 50000)
    ORDER BY COALESCE(nts.final_threat_score, 0) DESC
    LIMIT $2 OFFSET $3
  `,
    [
      params.minTimestamp,
      params.limit,
      params.offset,
      params.minObservations,
      params.minUniqueDays,
      params.minUniqueLocations,
      params.minRangeKm,
      params.minThreatScore,
    ]
  );

  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
  return { rows: result.rows, totalCount };
}

/**
 * Get detailed threat analysis
 */
export async function getDetailedThreats(): Promise<any[]> {
  const { rows } = await query(
    `
    SELECT
      ne.bssid,
      ne.ssid,
      ne.type,
      ne.security as encryption,
      ne.frequency,
      ne.signal as signal_dbm,
      ne.lat as network_latitude,
      ne.lon as network_longitude,
      ne.observations as total_observations,
      nts.final_threat_score,
      nts.final_threat_level,
      nts.rule_based_flags
    FROM app.api_network_explorer_mv ne
    LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
    WHERE COALESCE(nts.final_threat_score, 0) >= 30
      AND (
        ne.type NOT IN ('G', 'L', 'N')
        OR ne.max_distance_meters > 5000
      )
    ORDER BY COALESCE(nts.final_threat_score, 0) DESC, ne.observations DESC
  `
  );
  return rows;
}

module.exports.getQuickThreats = getQuickThreats;
module.exports.getDetailedThreats = getDetailedThreats;
