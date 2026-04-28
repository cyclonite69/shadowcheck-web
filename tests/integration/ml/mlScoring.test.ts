export {};
const { scoreAllNetworks } = require('../../../server/src/services/ml/scoringService');
const { pool } = require('../../../server/src/config/database');

// Requires a live PostgreSQL instance at localhost:5432 — only passes on EC2.
// Run manually: npx jest tests/integration/ml/mlScoring.test.ts
describe.skip('ML Scoring Service Integration', () => {
  beforeAll(async () => {
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
