const { query } = require('../config/database');

/**
 * ML Scoring Service
 * Applies trained ML model to all networks and precomputes threat scores
 */

class MLScoringService {
  /**
   * Score all networks using the trained ML model
   * Run as background job, not on request path
   */
  static async scoreAllNetworks() {
    try {
      // 1. Get the trained model
      const modelResult = await query(
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
      const networksResult = await query(`
        SELECT 
          ap.bssid,
          COALESCE(obs.ssid, ap.latest_ssid, '(hidden)') AS ssid,
          mv.observation_count,
          mv.unique_days,
          mv.unique_locations,
          mv.max_signal,
          mv.max_distance_km,
          mv.distance_from_home_km,
          mv.seen_at_home,
          mv.seen_away_from_home,
          COALESCE(ts.raw_score, 0) AS rule_based_score,
          COALESCE(ts.threat_flags, '[]'::jsonb) AS rule_based_flags
        FROM public.access_points ap
        LEFT JOIN public.api_network_explorer_mv mv ON ap.bssid = mv.bssid
        LEFT JOIN observations obs ON ap.bssid = obs.bssid
        LEFT JOIN (
          SELECT bssid, raw_score, threat_flags 
          FROM public.api_network_explorer_mv
        ) ts ON ap.bssid = ts.bssid
        WHERE ap.bssid IS NOT NULL
        LIMIT 10000
      `);

      const networks = networksResult.rows;
      const scores = [];

      // 3. Score each network
      for (const network of networks) {
        const features = {
          distance_range_km: (network.max_distance_km || 0) / 1000.0,
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

        // Determine threat level
        let threatLevel = 'NONE';
        if (threatScore >= 70) {
          threatLevel = 'CRITICAL';
        } else if (threatScore >= 50) {
          threatLevel = 'HIGH';
        } else if (threatScore >= 30) {
          threatLevel = 'MED';
        } else if (threatScore >= 10) {
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
          final_threat_score: Math.max(threatScore, network.rule_based_score),
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
  static async getNetworkThreatScore(bssid) {
    const result = await query('SELECT * FROM app.network_threat_scores WHERE bssid = $1', [bssid]);
    return result.rows[0] || null;
  }

  /**
   * Get networks by threat level
   */
  static async getNetworksByThreatLevel(level, limit = 100) {
    const result = await query(
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
  static async clearScores(olderThanDays = 30) {
    const result = await query(
      `DELETE FROM app.network_threat_scores 
       WHERE scored_at < NOW() - INTERVAL '${olderThanDays} days'`
    );
    return result.rowCount;
  }
}

module.exports = MLScoringService;
