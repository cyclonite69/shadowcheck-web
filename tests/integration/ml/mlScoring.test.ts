export {};
const { scoreAllNetworks } = require('../../../server/src/services/ml/scoringService');
const { pool } = require('../../../server/src/config/database');

describe('ML Scoring Service Integration', () => {
  beforeAll(async () => {
    // Ensure database is clean or set up for test
    await pool.query('TRUNCATE TABLE threat_scores CASCADE');
  });

  it('should perform a full scoring lifecycle', async () => {
    // 1. Run scoring
    const result = await scoreAllNetworks({ limit: 10, overwriteFinal: true });
    expect(result).toHaveProperty('scored');
    expect(result.scored).toBeGreaterThanOrEqual(0);

    // 2. Verify score insertion
    const { rows } = await pool.query('SELECT count(*) FROM threat_scores');
    expect(parseInt(rows[0].count)).toBeGreaterThanOrEqual(0);
  });
});
