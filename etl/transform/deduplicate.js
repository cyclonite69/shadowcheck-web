#!/usr/bin/env node
/**
 * Deduplicate Observations
 *
 * Removes duplicate observations based on key fields:
 * - Uses (bssid, lat, lon, time) composite key
 * - Preserves highest signal strength (level) observation
 * - Updates deduplication stats
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function deduplicateObservations() {
  console.log('🔄 Deduplicating observations...\n');
  const startTime = Date.now();

  try {
    // Get initial count
    const beforeCount = await pool.query('SELECT COUNT(*) as count FROM app.observations');
    console.log(`  Initial count: ${parseInt(beforeCount.rows[0].count).toLocaleString()}`);

    // Find and remove duplicates, keeping the one with highest signal (level)
    console.log('  Finding duplicates...');

    await pool.query(`
      WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY bssid, lat, lon, time
                 ORDER BY level DESC NULLS LAST, id
               ) as rn
        FROM app.observations
        WHERE bssid IS NOT NULL
      )
      DELETE FROM app.observations
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
    `);

    const afterCount = await pool.query('SELECT COUNT(*) as count FROM app.observations');

    const removed = parseInt(beforeCount.rows[0].count) - parseInt(afterCount.rows[0].count);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`  Removed: ${removed.toLocaleString()} duplicates`);
    console.log(`  Final count: ${parseInt(afterCount.rows[0].count).toLocaleString()}`);
    console.log(`\n✅ Deduplication complete in ${duration}s`);

    return {
      before: parseInt(beforeCount.rows[0].count),
      after: parseInt(afterCount.rows[0].count),
      removed,
    };
  } catch (error) {
    console.error('❌ Deduplication failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  deduplicateObservations().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { deduplicateObservations };
