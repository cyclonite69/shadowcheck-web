#!/usr/bin/env node
/**
 * Set home location
 * Usage: node set-home.js <latitude> <longitude>
 */

require('dotenv').config();
const { Pool } = require('pg');
const secretsManager = require('../src/services/secretsManager');

const lat = parseFloat(process.argv[2]);
const lng = parseFloat(process.argv[3]);

if (isNaN(lat) || isNaN(lng)) {
  console.error('Usage: node set-home.js <latitude> <longitude>');
  console.error('Example: node set-home.js 43.0234 -83.6968');
  process.exit(1);
}

(async () => {
  await secretsManager.load();

  const pool = new Pool({
    user: process.env.DB_USER || 'shadowcheck',
    password: secretsManager.getOrThrow('db_password'),
    host: '127.0.0.1',
    database: process.env.DB_NAME || 'shadowcheck',
    port: 5432,
  });

  try {
    // Delete existing home
    await pool.query("DELETE FROM app.location_markers WHERE name='home'");

    // Insert new home
    await pool.query(
      "INSERT INTO app.location_markers (name, latitude, longitude) VALUES ('home', $1, $2)",
      [lat, lng]
    );

    console.log('✓ Home location set successfully');
    console.log(`  Latitude: ${lat}`);
    console.log(`  Longitude: ${lng}`);
  } catch (error) {
    console.error('✗ Failed to set home location:', error.message);
  }

  await pool.end();
})();
