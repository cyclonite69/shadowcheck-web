#!/usr/bin/env node
/**
 * Normalize Observations
 *
 * Transforms raw import data into production observations schema:
 * - Standardizes BSSID format (uppercase)
 * - Validates coordinates (lat/lon ranges)
 * - Reports radio type distribution
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

async function normalizeObservations() {
  console.log('🔄 Normalizing observations...\n');
  const startTime = Date.now();

  try {
    // 1. Uppercase all BSSIDs
    console.log('  [1/4] Standardizing BSSID format...');
    const bssidResult = await pool.query(`
      UPDATE app.observations
      SET bssid = UPPER(bssid)
      WHERE bssid != UPPER(bssid)
    `);
    console.log(`        Updated ${bssidResult.rowCount} BSSIDs`);

    // 2. Validate coordinates
    console.log('  [2/3] Validating coordinates...');
    const invalidCoords = await pool.query(`
      SELECT COUNT(*) as count FROM app.observations
      WHERE lat IS NULL
         OR lon IS NULL
         OR lat < -90 OR lat > 90
         OR lon < -180 OR lon > 180
    `);
    console.log(`        Found ${invalidCoords.rows[0].count} invalid coordinates`);

    // 3. Validate radio types
    console.log('  [3/3] Validating radio types...');
    const radioTypes = await pool.query(`
      SELECT radio_type, COUNT(*) as count
      FROM app.observations
      GROUP BY radio_type
      ORDER BY count DESC
    `);
    console.log('        Radio type distribution:');
    radioTypes.rows.forEach((row) => {
      console.log(`          - ${row.radio_type}: ${parseInt(row.count).toLocaleString()}`);
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Normalization complete in ${duration}s`);
  } catch (error) {
    console.error('❌ Normalization failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  normalizeObservations().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { normalizeObservations };
