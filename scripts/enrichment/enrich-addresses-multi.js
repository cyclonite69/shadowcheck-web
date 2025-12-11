const https = require('https');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Free APIs for address enrichment
const APIs = {
  // 1. Nominatim (OpenStreetMap) - Free, no key needed
  nominatim: async (address) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1`;
    return new Promise((resolve, reject) => {
      https
        .get(url, { headers: { 'User-Agent': 'ShadowCheck/1.0' } }, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.length > 0) {
                const result = json[0];
                resolve({
                  name: result.display_name.split(',')[0],
                  type: result.type,
                  category: result.class,
                  details: result.address,
                });
              } else {
                resolve(null);
              }
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  },

  // 2. Overpass API (OpenStreetMap POI) - Free
  overpass: async (lat, lon) => {
    const query = `[out:json];(node(around:50,${lat},${lon})[name];way(around:50,${lat},${lon})[name];);out body 1;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.elements && json.elements.length > 0) {
                const poi = json.elements[0];
                resolve({
                  name: poi.tags?.name,
                  type: poi.tags?.amenity || poi.tags?.shop || poi.tags?.building,
                  category: poi.tags?.amenity || poi.tags?.shop || 'building',
                  brand: poi.tags?.brand,
                  operator: poi.tags?.operator,
                });
              } else {
                resolve(null);
              }
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  },

  // 3. Photon (Komoot) - Free geocoding
  photon: async (address) => {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.features && json.features.length > 0) {
                const props = json.features[0].properties;
                resolve({
                  name: props.name,
                  type: props.type,
                  category: props.osm_value,
                  street: props.street,
                  city: props.city,
                });
              } else {
                resolve(null);
              }
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  },
};

async function enrichAddress(address, lat, lon) {
  // Try Overpass first (best for POI)
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit
    const overpass = await APIs.overpass(lat, lon);
    if (overpass && overpass.name) {
      return {
        venue_name: overpass.name,
        venue_category: overpass.category,
        venue_type: overpass.type,
        venue_brand: overpass.brand,
        source: 'overpass',
      };
    }
  } catch (err) {
    console.error('Overpass error:', err.message);
  }

  // Fallback to Nominatim
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit
    const nominatim = await APIs.nominatim(address);
    if (nominatim && nominatim.name) {
      return {
        venue_name: nominatim.name,
        venue_category: nominatim.category,
        venue_type: nominatim.type,
        source: 'nominatim',
      };
    }
  } catch (err) {
    console.error('Nominatim error:', err.message);
  }

  return null;
}

async function main() {
  const limit = parseInt(process.argv[2]) || 100;

  // Get addresses without venue names
  const result = await pool.query(
    `
    SELECT bssid, trilat_address, trilat_lat, trilat_lon
    FROM app.networks_legacy
    WHERE trilat_address IS NOT NULL
      AND venue_name IS NULL
      AND trilat_lat IS NOT NULL
      AND trilat_lon IS NOT NULL
      AND is_mobile_network = FALSE
    ORDER BY observation_count DESC
    LIMIT $1
  `,
    [limit]
  );

  console.log(`🏢 Enriching ${result.rows.length} addresses with free APIs...`);

  let enriched = 0;
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];

    try {
      const poi = await enrichAddress(row.trilat_address, row.trilat_lat, row.trilat_lon);

      if (poi) {
        await pool.query(
          `
          UPDATE app.networks_legacy 
          SET venue_name = $1, venue_category = $2, name = $3
          WHERE bssid = $4
        `,
          [poi.venue_name, poi.venue_category, poi.venue_brand || poi.venue_name, row.bssid]
        );

        await pool.query(
          `
          UPDATE app.ap_locations 
          SET venue_name = $1, venue_category = $2
          WHERE bssid = $3
        `,
          [poi.venue_name, poi.venue_category, row.bssid]
        );

        enriched++;
        console.log(
          `  ✓ ${i + 1}/${result.rows.length}: ${poi.venue_name} (${poi.venue_category || poi.venue_type || 'unknown'}) [${poi.source}]`
        );
      } else {
        console.log(`  ✗ ${i + 1}/${result.rows.length}: No POI found`);
      }
    } catch (err) {
      console.error(`  ✗ ${i + 1}/${result.rows.length}: Error - ${err.message}`);
    }
  }

  console.log(`\n✓ Complete: ${enriched}/${result.rows.length} addresses enriched`);
  await pool.end();
}

main().catch(console.error);
