import { Pool, QueryResult } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

interface LocationRow {
  lat: number;
  lon: number;
  network_count: string;
  categories: string[];
  devices: string[];
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Generate Overpass Turbo queries for visualization
async function generateQueries(): Promise<void> {
  const result: QueryResult<LocationRow> = await pool.query(`
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

  console.log('🗺️  Top Network Density Locations:\n');

  result.rows.forEach((row, i) => {
    const count = parseInt(row.network_count);
    const categories = row.categories?.join(', ') || 'unknown';
    const devices = row.devices?.join(', ') || 'unknown';

    console.log(`${i + 1}. Location: ${row.lat}, ${row.lon}`);
    console.log(`   Networks: ${count}`);
    console.log(`   Categories: ${categories}`);
    console.log(`   Devices: ${devices}`);

    // Generate Overpass query for this location
    const radius = Math.min(100, Math.max(20, count * 2)); // Dynamic radius
    const query = `
[out:json][timeout:25];
(
  node(around:${radius},${row.lat},${row.lon})[amenity];
  way(around:${radius},${row.lat},${row.lon})[amenity];
  relation(around:${radius},${row.lat},${row.lon})[amenity];
);
out body;
>;
out skel qt;`;

    console.log(`   Overpass Query (${radius}m radius):`);
    console.log(`   ${query.trim().replace(/\n/g, ' ')}\n`);
  });

  // Generate combined query for all locations
  const allCoords = result.rows.map((row) => `${row.lat},${row.lon}`).join(';');
  console.log('🌍 Combined Query for All Locations:');
  console.log(`   Coordinates: ${allCoords}`);

  await pool.end();
}

generateQueries().catch(console.error);
