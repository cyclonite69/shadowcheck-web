const fs = require('fs');
const https = require('https');
const { Pool } = require('pg');
require('dotenv').config();

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function lookupPOI(lat, lon) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=poi&limit=1&access_token=${MAPBOX_TOKEN}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.features && json.features.length > 0) {
            const poi = json.features[0];
            resolve({
              name: poi.text,
              category: poi.properties?.category || poi.place_type?.[0],
            });
          } else {
            resolve({ name: null, category: null });
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const limit = parseInt(process.argv[2]) || 1000;

  // Get networks with addresses but no venue names
  const result = await pool.query(`
    SELECT bssid, trilat_lat, trilat_lon 
    FROM app.networks_legacy 
    WHERE trilat_address IS NOT NULL 
      AND venue_name IS NULL 
      AND is_mobile_network = FALSE
    LIMIT $1
  `, [limit]);

  console.log(`🏢 Enriching ${result.rows.length} networks with business names...`);

  let enriched = 0;
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];

    try {
      const poi = await lookupPOI(row.trilat_lat, row.trilat_lon);

      if (poi.name) {
        await pool.query(
          'UPDATE app.networks_legacy SET venue_name = $1, venue_category = $2 WHERE bssid = $3',
          [poi.name, poi.category, row.bssid]
        );

        await pool.query(
          'UPDATE app.ap_locations SET venue_name = $1, venue_category = $2 WHERE bssid = $3',
          [poi.name, poi.category, row.bssid]
        );

        enriched++;
      }

      if ((i + 1) % 100 === 0) {
        console.log(`  ✓ ${i + 1}/${result.rows.length} (${enriched} with POI)`);
      }

      // Rate limit: ~600/min
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      console.error(`Error for ${row.bssid}:`, err.message);
    }
  }

  console.log(`\n✓ Complete: ${enriched}/${result.rows.length} networks enriched with business names`);
  await pool.end();
}

main().catch(console.error);
