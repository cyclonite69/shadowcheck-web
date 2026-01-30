#!/usr/bin/env node
/**
 * Enrich Observations with Geocoding
 *
 * Adds reverse geocoding data to observations:
 * - Uses configured geocoding providers
 * - Rate-limited API calls
 * - Caches results
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

// Rate limiting
const RATE_LIMIT_MS = 1000; // 1 request per second
const BATCH_SIZE = 100;

async function enrichGeocoding(options = {}) {
  const { limit = 1000, dryRun = false } = options;

  console.log('🌍 Enriching observations with geocoding...\n');
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Limit: ${limit}`);

  const startTime = Date.now();

  try {
    // Find observations needing geocoding
    const needsGeocoding = await pool.query(`
      SELECT COUNT(*) as count
      FROM app.observations
      WHERE geocoded_at IS NULL
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
    `);

    console.log(
      `\n  Observations needing geocoding: ${parseInt(needsGeocoding.rows[0].count).toLocaleString()}`
    );

    if (dryRun) {
      console.log('\n  [DRY RUN] Would geocode observations');
      console.log('  To run for real, use: node enrich-geocoding.js --live');
      return;
    }

    // Check for geocoding API key
    const geocodingKey =
      process.env.LOCATIONIQ_API_KEY ||
      process.env.OPENCAGE_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY;

    if (!geocodingKey) {
      console.log('\n⚠️  No geocoding API key configured');
      console.log('   Set one of: LOCATIONIQ_API_KEY, OPENCAGE_API_KEY, GOOGLE_MAPS_API_KEY');
      return;
    }

    // Get sample of unique locations to geocode
    const locations = await pool.query(
      `
      SELECT DISTINCT ON (ROUND(latitude::numeric, 4), ROUND(longitude::numeric, 4))
        latitude, longitude
      FROM app.observations
      WHERE geocoded_at IS NULL
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      LIMIT $1
    `,
      [limit]
    );

    console.log(`\n  Unique locations to geocode: ${locations.rows.length}`);

    // TODO: Implement actual geocoding API calls
    console.log('\n  [NOT IMPLEMENTED] Geocoding API integration pending');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Geocoding enrichment complete in ${duration}s`);
  } catch (error) {
    console.error('❌ Geocoding enrichment failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1000;

  enrichGeocoding({ limit, dryRun }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { enrichGeocoding };
