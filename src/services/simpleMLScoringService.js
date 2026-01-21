const { query } = require('../config/database');

/**
 * Simple ML Scoring Service for testing
 */

class SimpleMLScoringService {
  /**
   * Test method to verify the service works
   */
  static async test() {
    try {
      // Simple database query to test connectivity
      const result = await query('SELECT COUNT(*) as count FROM app.ml_model_config');
      return {
        ok: true,
        message: 'ML Scoring Service is working',
        modelCount: result.rows[0].count,
      };
    } catch (error) {
      console.error('[Simple ML Scoring] Error:', error);
      throw error;
    }
  }

  /**
   * Insert a test score record
   */
  static async insertTestScore() {
    try {
      const testBssid = 'AA:BB:CC:DD:EE:FF';

      await query(`
        INSERT INTO app.network_threat_scores 
          (bssid, ml_threat_score, ml_threat_probability, ml_primary_class, 
           final_threat_score, final_threat_level, model_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (bssid) DO UPDATE SET
          ml_threat_score = EXCLUDED.ml_threat_score,
          updated_at = NOW()
      `, [testBssid, 75.5, 0.755, 'THREAT', 75.5, 'HIGH', 'test-1.0']);

      return {
        ok: true,
        message: 'Test score inserted successfully',
        bssid: testBssid,
      };
    } catch (error) {
      console.error('[Simple ML Scoring] Insert error:', error);
      throw error;
    }
  }

  /**
   * Get test score record
   */
  static async getTestScore() {
    try {
      const result = await query(
        'SELECT * FROM app.network_threat_scores WHERE bssid = $1',
        ['AA:BB:CC:DD:EE:FF']
      );

      return {
        ok: true,
        score: result.rows[0] || null,
      };
    } catch (error) {
      console.error('[Simple ML Scoring] Get error:', error);
      throw error;
    }
  }
}

module.exports = SimpleMLScoringService;
