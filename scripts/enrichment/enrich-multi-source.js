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

const CONCURRENT = 3;

// Multi-source API strategy with gap filling
const APIs = {
  overpass: async (lat, lon) => {
    const query = `[out:json];(node(around:50,${lat},${lon})[name];way(around:50,${lat},${lon})[name];);out body 1;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    return new Promise((resolve) => {
      const req = https.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.elements?.[0]) {
              const poi = json.elements[0];
              resolve({
                name: poi.tags?.name,
                category: poi.tags?.amenity || poi.tags?.shop || poi.tags?.building,
                brand: poi.tags?.brand,
                type: poi.tags?.building_type || poi.tags?.shop,
                source: 'overpass',
                confidence: poi.tags?.name ? 0.9 : 0.5,
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  },

  nominatim: async (lat, lon) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    return new Promise((resolve) => {
      const req = https.get(url, {
        headers: { 'User-Agent': 'ShadowCheck/1.0' },
        timeout: 5000,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.display_name) {
              const name = json.display_name.split(',')[0];
              resolve({
                name: name,
                category: json.type,
                type: json.class,
                source: 'nominatim',
                confidence: json.type !== 'house' ? 0.7 : 0.3,
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  },

  locationiq: async (lat, lon) => {
    const key = process.env.LOCATIONIQ_API_KEY;
    if (!key) {return null;}

    const url = `https://us1.locationiq.com/v1/reverse.php?key=${key}&lat=${lat}&lon=${lon}&format=json`;
    return new Promise((resolve) => {
      const req = https.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({
              name: json.display_name?.split(',')[0],
              category: json.type,
              type: json.class,
              source: 'locationiq',
              confidence: 0.8,
            });
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  },

  opencage: async (lat, lon) => {
    const key = process.env.OPENCAGE_API_KEY;
    if (!key) {return null;}

    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${key}&limit=1`;
    return new Promise((resolve) => {
      const req = https.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const result = json.results?.[0];
            if (result) {
              const name = result.components?.building ||
                          result.components?.shop ||
                          result.components?.amenity ||
                          result.formatted?.split(',')[0];
              resolve({
                name: name,
                category: result.components?._category || result.components?._type,
                type: result.components?._type,
                source: 'opencage',
                confidence: 0.8,
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  },
};

async function enrichWithGapFilling(lat, lon) {
  // Try all APIs in parallel
  const results = await Promise.all([
    APIs.overpass(lat, lon),
    APIs.nominatim(lat, lon),
    APIs.locationiq(lat, lon),
    APIs.opencage(lat, lon),
  ]);

  // Filter out nulls
  const valid = results.filter(r => r && r.name);

  if (valid.length === 0) {return null;}

  // Merge results - prefer highest confidence with most detail
  const merged = {
    name: valid.sort((a, b) => b.confidence - a.confidence)[0].name,
    category: valid.find(r => r.category)?.category,
    type: valid.find(r => r.type)?.type,
    brand: valid.find(r => r.brand)?.brand,
    sources: valid.map(r => r.source).join(','),
    confidence: Math.max(...valid.map(r => r.confidence)),
  };

  return merged;
}

async function main() {
  const limit = parseInt(process.argv[2]) || 1000;

  const result = await pool.query(`
    SELECT bssid, trilat_address, trilat_lat, trilat_lon
    FROM app.networks_legacy
    WHERE trilat_address IS NOT NULL
      AND venue_name IS NULL
      AND trilat_lat IS NOT NULL
      AND trilat_lon IS NOT NULL
      AND is_mobile_network = FALSE
    ORDER BY observation_count DESC
    LIMIT $1
  `, [limit]);

  const apiKeys = {
    locationiq: Boolean(process.env.LOCATIONIQ_API_KEY),
    opencage: Boolean(process.env.OPENCAGE_API_KEY),
  };

  console.log(`🚀 Multi-source enrichment: ${result.rows.length} addresses`);
  console.log(`📡 APIs available: Overpass, Nominatim${apiKeys.locationiq ? ', LocationIQ' : ''}${apiKeys.opencage ? ', OpenCage' : ''}`);
  console.log(`⚡ Concurrent: ${CONCURRENT}\n`);

  let enriched = 0;
  const sources = {};

  for (let i = 0; i < result.rows.length; i += CONCURRENT) {
    const batch = result.rows.slice(i, Math.min(i + CONCURRENT, result.rows.length));

    const promises = batch.map(async (row) => {
      try {
        const poi = await enrichWithGapFilling(row.trilat_lat, row.trilat_lon);

        if (poi && poi.name) {
          await pool.query(`
            UPDATE app.networks_legacy 
            SET venue_name = $1, venue_category = $2, name = $3
            WHERE bssid = $4
          `, [poi.name, poi.category, poi.brand || poi.name, row.bssid]);

          await pool.query(`
            UPDATE app.ap_locations 
            SET venue_name = $1, venue_category = $2
            WHERE bssid = $3
          `, [poi.name, poi.category, row.bssid]);

          sources[poi.sources] = (sources[poi.sources] || 0) + 1;
          return { success: true, poi };
        }
        return { success: false };
      } catch (err) {
        return { success: false };
      }
    });

    const results = await Promise.all(promises);
    enriched += results.filter(r => r.success).length;

    if ((i + CONCURRENT) % 50 === 0 || i + CONCURRENT >= result.rows.length) {
      console.log(`  ✓ ${Math.min(i + CONCURRENT, result.rows.length)}/${result.rows.length} (${enriched} enriched, ${((enriched / (i + CONCURRENT)) * 100).toFixed(1)}% success)`);
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\n✓ Complete: ${enriched}/${result.rows.length} addresses enriched`);
  console.log('\n📊 Sources used:');
  Object.entries(sources).sort((a, b) => b[1] - a[1]).forEach(([src, count]) => {
    console.log(`  ${src}: ${count}`);
  });

  await pool.end();
}

main().catch(console.error);
