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
  const filename = process.argv[2] || 'ap_centroids_geocoded.csv';
  const data = fs.readFileSync(filename, 'utf8');
  const lines = data.trim().split('\n').slice(1);

  let updated = 0;
  for (const line of lines) {
    const parts = line.split(',');
    const bssid = parts[0];
    const address = parts.slice(3).join(',').replace(/^"|"$/g, '');

    if (!address) {
      continue;
    }

    await pool.query('UPDATE app.ap_locations SET trilat_address = $1 WHERE bssid = $2', [
      address,
      bssid,
    ]);
    updated++;
    if (updated % 1000 === 0) {
      console.log(`  ${updated}...`);
    }
  }

  console.log(`✓ Updated ${updated} AP addresses`);
  await pool.end();
}

main().catch(console.error);
