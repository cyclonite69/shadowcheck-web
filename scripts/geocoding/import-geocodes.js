const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function importGeocodes() {
  const INPUT_FILE = process.argv[2] || 'locations_reverse_geocoded.csv';

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ File not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  console.log('📥 Reading CSV...');
  const input = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines = input.trim().split('\n');
  const headers = lines[0].split(',');

  const data = lines
    .slice(1)
    .map((line) => {
      const match = line.match(/^([^,]+),([^,]+),([^,]+),([^,]*),(.*)$/);
      if (!match) {
        return null;
      }
      return {
        lat: match[1],
        lon: match[2],
        bssid: match[3],
        ssid: match[4],
        address: match[5].replace(/^"|"$/g, ''),
      };
    })
    .filter(Boolean);

  console.log(`📊 Updating ${data.length} locations...`);

  let updated = 0;
  const batchSize = 100;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    await pool.query('BEGIN');

    for (const row of batch) {
      if (!row.address) {
        continue;
      }

      const result = await pool.query(
        `
        UPDATE app.locations_legacy 
        SET 
          geocoded_address = $1,
          geocoded_at = NOW(),
          geocode_source = 'mapbox_reverse'
        WHERE bssid = $2 
          AND lat = $3 
          AND lon = $4
          AND geocoded_address IS NULL
      `,
        [row.address, row.bssid, parseFloat(row.lat), parseFloat(row.lon)]
      );

      updated += result.rowCount;
    }

    await pool.query('COMMIT');

    if ((i + batchSize) % 1000 === 0) {
      console.log(`  ✓ Processed ${Math.min(i + batchSize, data.length)}/${data.length}`);
    }
  }

  console.log(`\n✓ Updated ${updated} location records`);

  await pool.end();
}

importGeocodes().catch(console.error);
