const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Generate Overpass Turbo queries for visualization
async function generateQueries() {
  const result = await pool.query(`
    SELECT 
      trilat_lat as lat,
      trilat_lon as lon,
      COUNT(*) as network_count,
      ARRAY_AGG(DISTINCT venue_category) FILTER (WHERE venue_category IS NOT NULL) as categories,
      ARRAY_AGG(DISTINCT device_type) FILTER (WHERE device_type IS NOT NULL) as devices
    FROM app.networks_legacy
    WHERE trilat_lat IS NOT NULL 
      AND trilat_lon IS NOT NULL
      AND is_mobile_network = FALSE
    GROUP BY trilat_lat, trilat_lon
    HAVING COUNT(*) > 5
    ORDER BY network_count DESC
    LIMIT 10;
  `);

  console.log('🗺️  Top 10 Network Hotspots - Overpass Turbo Queries\n');
  console.log('Copy these queries to: https://overpass-turbo.eu/\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  result.rows.forEach((row, i) => {
    console.log(`${i + 1}. Location: ${row.lat}, ${row.lon}`);
    console.log(`   Networks: ${row.network_count}`);
    console.log(`   Categories: ${row.categories?.join(', ') || 'unknown'}`);
    console.log(`   Devices: ${row.devices?.join(', ') || 'unknown'}`);
    console.log('\n   Overpass Query:');
    console.log('   ───────────────────────────────────────────────────────');
    console.log('   [out:json][timeout:25];');
    console.log('   (');
    console.log(`     node(around:100,${row.lat},${row.lon})[amenity];`);
    console.log(`     node(around:100,${row.lat},${row.lon})[shop];`);
    console.log(`     node(around:100,${row.lat},${row.lon})[tourism];`);
    console.log(`     way(around:100,${row.lat},${row.lon})[amenity];`);
    console.log(`     way(around:100,${row.lat},${row.lon})[shop];`);
    console.log(`     way(around:100,${row.lat},${row.lon})[building][name];`);
    console.log('   );');
    console.log('   out body;');
    console.log('   >;');
    console.log('   out skel qt;');
    console.log(
      `\n   Direct link: https://overpass-turbo.eu/?Q=[out:json][timeout:25];(node(around:100,${row.lat},${row.lon})[amenity];way(around:100,${row.lat},${row.lon})[shop];);out;&C=${row.lat};${row.lon};15`
    );
    console.log('\n═══════════════════════════════════════════════════════════\n');
  });

  await pool.end();
}

generateQueries().catch(console.error);
