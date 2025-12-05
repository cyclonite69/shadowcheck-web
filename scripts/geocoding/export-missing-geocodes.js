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

async function exportMissingGeocodes() {
  const query = `
    SELECT DISTINCT 
      bssid,
      ssid,
      lat,
      lon
    FROM app.locations_legacy
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    LIMIT 10000;
  `;

  const result = await pool.query(query);

  const csv = ['lat,lon,bssid,ssid'];
  result.rows.forEach(row => {
    csv.push(`${row.lat},${row.lon},${row.bssid},${row.ssid || ''}`);
  });

  fs.writeFileSync('locations_to_reverse_geocode.csv', csv.join('\n'));
  console.log(`✓ Exported ${result.rows.length} locations to locations_to_reverse_geocode.csv`);

  await pool.end();
}

exportMissingGeocodes().catch(console.error);
