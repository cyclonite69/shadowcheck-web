const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function main() {
  const data = fs.readFileSync('missing_final_result.csv', 'utf8');
  const lines = data.trim().split('\n').slice(1);

  let updated = 0;
  for (const line of lines) {
    const parts = line.split(',');
    const id = parts[0];
    const address = parts.slice(3).join(',').replace(/^"|"$/g, '');

    if (!address) {continue;}

    await pool.query(
      'UPDATE app.locations_legacy SET geocoded_address = $1, geocoded_at = NOW(), geocode_source = \'mapbox_reverse\' WHERE unified_id = $2',
      [address, id]
    );
    updated++;
    if (updated % 1000 === 0) {console.log(`  ${updated}...`);}
  }

  console.log(`✓ Updated ${updated} addresses`);
  await pool.end();
}

main().catch(console.error);
