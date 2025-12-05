const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const data = fs.readFileSync('missing_geocodes_result.csv', 'utf8');
  const lines = data.trim().split('\n').slice(1);

  let updated = 0;
  for (const line of lines) {
    const match = line.match(/^(\d+),([^,]+),([^,]+),"?([^"]*)"?$/);
    if (!match) {continue;}

    const [, id, lat, lon, address] = match;
    if (!address) {continue;}

    await pool.query(
      'UPDATE app.locations_legacy SET geocoded_address = $1, geocoded_at = NOW(), geocode_source = \'mapbox_reverse\' WHERE _id = $2',
      [address, id]
    );
    updated++;
  }

  console.log(`✓ Updated ${updated} addresses`);
  await pool.end();
}

main().catch(console.error);
