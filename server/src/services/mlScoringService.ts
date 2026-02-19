const { query } = require('../config/database');

// Type definitions for ML scoring

type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MED' | 'LOW' | 'NONE';
type ThreatClass = 'THREAT' | 'LEGITIMATE';

interface MLModelConfig {
  coefficients: number[];
  intercept: number;
  feature_names: string[];
  version: string | null;
}

interface NetworkFeatures {
  distance_range_km: number;
  unique_days: number;
  observation_count: number;
  max_signal: number;
  unique_locations: number;
  seen_both_locations: number;
  [key: string]: number; // Index signature for dynamic feature access
}

interface NetworkRow {
  bssid: string;
  ssid: string | null;
  observation_count: number | null;
  unique_days: number | null;
  unique_locations: number | null;
  max_signal: number | null;
  max_distance_km: number | null;
  distance_from_home_km: number | null;
  seen_at_home: boolean;
  seen_away_from_home: boolean;
  rule_based_score: number;
  rule_based_flags: Record<string, unknown>;
}

interface NetworkScore {
  bssid: string;
  ml_threat_score: number;
  ml_threat_probability: number;
  ml_primary_class: ThreatClass;
  ml_feature_values: string;
  rule_based_score: number;
  rule_based_flags: Record<string, unknown>;
  final_threat_score: number;
  final_threat_level: ThreatLevel;
  model_version: string;
}

interface ScoringResult {
  scored: number;
  message: string;
  modelVersion?: string;
}

interface ThreatScoreRow {
  bssid: string;
  final_threat_score: number;
  final_threat_level: ThreatLevel;
  ml_threat_score: number | null;
  ml_threat_probability: number | null;
  ml_primary_class: ThreatClass | null;
  ml_feature_values: string | null;
  rule_based_score: number | null;
  rule_based_flags: Record<string, unknown> | null;
  model_version: string | null;
  scored_at: Date;
  updated_at: Date | null;
}

interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number | null;
}

/**
 * ML Scoring Service
 * Applies trained ML model to all networks and precomputes threat scores
 */
class MLScoringService {
  /**
   * Score all networks using the trained ML model
   * Run as background job, not on request path
   */
  static async scoreAllNetworks(): Promise<ScoringResult> {
    try {
      // 1. Get the trained model
      const modelResult: QueryResult<MLModelConfig> = await query(
        `SELECT coefficients, intercept, feature_names, version
         FROM app.ml_model_config
         WHERE model_type = 'logistic_regression'`
      );

      if (!modelResult.rows.length) {
        console.log('[ML Scoring] No trained model found. Skipping scoring.');
        return { scored: 0, message: 'No model trained' };
      }

      const model = modelResult.rows[0];
      const modelVersion = model.version || '1.0.0';
      const coefficients = model.coefficients;
      const intercept = model.intercept || 0;

      // 2. Get all networks to score with their features
      const networksResult: QueryResult<NetworkRow> = await query(`
        SELECT
          ap.bssid,
          COALESCE(obs.ssid, ap.latest_ssid, '(hidden)') AS ssid,
          mv.observations AS observation_count,
          mv.unique_days,
          mv.unique_locations,
          COALESCE(mv.signal, -100) AS max_signal,
          COALESCE(mv.max_distance_meters, 0) / 1000.0 AS max_distance_km,
          mv.distance_from_home_km,
          FALSE AS seen_at_home,
          FALSE AS seen_away_from_home,
          COALESCE(nts.rule_based_score, 0) AS rule_based_score,
          COALESCE(nts.rule_based_flags, '{}'::jsonb) AS rule_based_flags
        FROM app.access_points ap
        LEFT JOIN app.api_network_explorer_mv mv ON ap.bssid = mv.bssid
        LEFT JOIN observations obs ON ap.bssid = obs.bssid
        LEFT JOIN app.network_threat_scores nts ON ap.bssid = nts.bssid
        WHERE ap.bssid IS NOT NULL
        LIMIT 10000
      `);

      const networks = networksResult.rows;
      const scores: NetworkScore[] = [];

      // 3. Score each network
      for (const network of networks) {
        const features: NetworkFeatures = {
          distance_range_km: network.max_distance_km || 0,
          unique_days: network.unique_days || 0,
          observation_count: network.observation_count || 0,
          max_signal: network.max_signal || -100,
          unique_locations: network.unique_locations || 0,
          seen_both_locations: network.seen_at_home && network.seen_away_from_home ? 1 : 0,
        };

        // Compute logistic regression prediction
        let score = intercept;
        for (let i = 0; i < coefficients.length; i++) {
          const featureName = model.feature_names[i];
          score += coefficients[i] * (features[featureName] || 0);
        }

        // Convert to probability (logistic function)
        const probability = 1 / (1 + Math.exp(-score));
        const threatScore = probability * 100;

        const finalScore = Math.max(threatScore, network.rule_based_score);

        // Determine threat level from final score
        let threatLevel: ThreatLevel = 'NONE';
        if (finalScore >= 80) {
          threatLevel = 'CRITICAL';
        } else if (finalScore >= 60) {
          threatLevel = 'HIGH';
        } else if (finalScore >= 40) {
          threatLevel = 'MED';
        } else if (finalScore >= 20) {
          threatLevel = 'LOW';
        }

        scores.push({
          bssid: network.bssid,
          ml_threat_score: parseFloat(threatScore.toFixed(2)),
          ml_threat_probability: parseFloat(probability.toFixed(3)),
          ml_primary_class: threatScore >= 50 ? 'THREAT' : 'LEGITIMATE',
          ml_feature_values: JSON.stringify(features),
          rule_based_score: network.rule_based_score,
          rule_based_flags: network.rule_based_flags,
          final_threat_score: finalScore,
          final_threat_level: threatLevel,
          model_version: modelVersion,
        });
      }

      // 4. Bulk insert/update scores
      if (scores.length > 0) {
        const valuesPlaceholder = scores
          .map((_, i) => {
            const offset = i * 11;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4},
                   $${offset + 5}, $${offset + 6}, $${offset + 7},
                   $${offset + 8}, $${offset + 9}, $${offset + 10}, NOW())`;
          })
          .join(',');

        const insertQuery = `
          INSERT INTO app.network_threat_scores
            (bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
             ml_feature_values, rule_based_score, rule_based_flags,
             final_threat_score, final_threat_level, model_version, scored_at)
          VALUES
            ${valuesPlaceholder}
          ON CONFLICT (bssid) DO UPDATE SET
            ml_threat_score = EXCLUDED.ml_threat_score,
            ml_threat_probability = EXCLUDED.ml_threat_probability,
            ml_primary_class = EXCLUDED.ml_primary_class,
            ml_feature_values = EXCLUDED.ml_feature_values,
            rule_based_score = EXCLUDED.rule_based_score,
            rule_based_flags = EXCLUDED.rule_based_flags,
            final_threat_score = EXCLUDED.final_threat_score,
            final_threat_level = EXCLUDED.final_threat_level,
            model_version = EXCLUDED.model_version,
            scored_at = NOW(),
            updated_at = NOW()
        `;

        const values = scores.flatMap((s) => [
          s.bssid,
          s.ml_threat_score,
          s.ml_threat_probability,
          s.ml_primary_class,
          s.ml_feature_values,
          s.rule_based_score,
          s.rule_based_flags,
          s.final_threat_score,
          s.final_threat_level,
          s.model_version,
        ]);

        await query(insertQuery, values);
      }

      return {
        scored: scores.length,
        message: `Successfully scored ${scores.length} networks`,
        modelVersion,
      };
    } catch (error) {
      console.error('[ML Scoring] Error scoring networks:', error);
      throw error;
    }
  }

  /**
   * Get threat score for a single network
   */
  static async getNetworkThreatScore(bssid: string): Promise<ThreatScoreRow | null> {
    const result: QueryResult<ThreatScoreRow> = await query(
      'SELECT * FROM app.network_threat_scores WHERE bssid = $1',
      [bssid]
    );
    return result.rows[0] || null;
  }

  /**
   * Get networks by threat level
   */
  static async getNetworksByThreatLevel(
    level: ThreatLevel,
    limit: number = 100
  ): Promise<ThreatScoreRow[]> {
    const result: QueryResult<ThreatScoreRow> = await query(
      `SELECT bssid, final_threat_score, final_threat_level, ml_threat_score,
              ml_threat_probability, scored_at
       FROM app.network_threat_scores
       WHERE final_threat_level = $1
       ORDER BY final_threat_score DESC
       LIMIT $2`,
      [level, limit]
    );
    return result.rows;
  }

  /**
   * Clear old scores (optional cleanup)
   */
  static async clearScores(olderThanDays: number = 30): Promise<number> {
    const result: QueryResult = await query(
      `DELETE FROM app.network_threat_scores
       WHERE scored_at < NOW() - ($1::text)::interval`,
      [`${olderThanDays} days`]
    );
    return result.rowCount || 0;
  }

  /**
   * Get networks for behavioral scoring (simple model)
   */
  static async getNetworksForBehavioralScoring(
    limit: number,
    minObservations: number,
    maxBssidLength: number
  ): Promise<any[]> {
    const result: QueryResult = await query(
      `
      SELECT 
        ap.bssid,
        COUNT(DISTINCT obs.id) as observation_count,
        COUNT(DISTINCT DATE(obs.observed_at)) as unique_days,
        COALESCE(MAX(ABS(obs.lon - (-79.3832)) + ABS(obs.lat - 43.6532)) * 111, 0) as max_distance_km
      FROM app.access_points ap
      LEFT JOIN app.observations obs ON ap.bssid = obs.bssid
      WHERE ap.bssid IS NOT NULL
        AND obs.id IS NOT NULL
        AND LENGTH(ap.bssid) <= $1
        AND obs.lon IS NOT NULL
        AND obs.lat IS NOT NULL
      GROUP BY ap.bssid
      HAVING COUNT(DISTINCT obs.id) > $2
      LIMIT $3
    `,
      [maxBssidLength, minObservations, limit]
    );
    return result.rows;
  }

  /**
   * Bulk upsert threat scores
   */
  static async bulkUpsertThreatScores(scores: any[]): Promise<number> {
    let inserted = 0;
    for (const score of scores) {
      await query(
        `INSERT INTO app.network_threat_scores 
          (bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
           rule_based_score, final_threat_score, final_threat_level, model_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (bssid) DO UPDATE SET
          ml_threat_score = EXCLUDED.ml_threat_score,
          ml_threat_probability = EXCLUDED.ml_threat_probability,
          final_threat_score = EXCLUDED.final_threat_score,
          final_threat_level = EXCLUDED.final_threat_level,
          model_version = EXCLUDED.model_version,
          updated_at = NOW()`,
        [
          score.bssid,
          score.ml_threat_score,
          score.ml_threat_probability,
          score.ml_primary_class,
          score.rule_based_score,
          score.final_threat_score,
          score.final_threat_level,
          score.model_version,
        ]
      );
      inserted++;
    }
    return inserted;
  }
}

module.exports = MLScoringService;

// Export types for consumers
export type {
  ThreatLevel,
  ThreatClass,
  MLModelConfig,
  NetworkFeatures,
  NetworkScore,
  ScoringResult,
  ThreatScoreRow,
};
