#!/usr/bin/env tsx
import * as https from 'https';
import { IncomingMessage, ClientRequest } from 'http';
import { Pool, QueryResult } from 'pg';
import '../loadEnv';

interface NetworkRow {
  bssid: string;
  trilat_address: string;
  trilat_lat: number;
  trilat_lon: number;
}

interface PoiResult {
  name?: string;
  category?: string;
  brand?: string;
  cuisine?: string;
  operator?: string;
  website?: string;
  phone?: string;
  opening_hours?: string;
  type: string;
  source: string;
  confidence: number;
}

interface OverpassElement {
  tags?: {
    name?: string;
    'addr:housename'?: string;
    operator?: string;
    amenity?: string;
    shop?: string;
    tourism?: string;
    leisure?: string;
    building?: string;
    brand?: string;
    'brand:wikidata'?: string;
    cuisine?: string;
    website?: string;
    phone?: string;
    opening_hours?: string;
  };
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Optimized Overpass queries for different POI types
const overpassQueries: Record<string, (lat: number, lon: number) => string> = {
  // Businesses and amenities
  business: (lat: number, lon: number) => `
    [out:json][timeout:5];
    (
      node(around:30,${lat},${lon})[amenity];
      node(around:30,${lat},${lon})[shop];
      node(around:30,${lat},${lon})[tourism];
      node(around:30,${lat},${lon})[leisure];
      way(around:30,${lat},${lon})[amenity];
      way(around:30,${lat},${lon})[shop];
      way(around:30,${lat},${lon})[tourism];
      way(around:30,${lat},${lon})[leisure];
    );
    out body 1;
  `,

  // Buildings with names
  building: (lat: number, lon: number) => `
    [out:json][timeout:5];
    (
      node(around:30,${lat},${lon})[building][name];
      way(around:30,${lat},${lon})[building][name];
    );
    out body 1;
  `,

  // Roads and addresses
  address: (lat: number, lon: number) => `
    [out:json][timeout:5];
    (
      node(around:30,${lat},${lon})[addr:housenumber];
      way(around:30,${lat},${lon})[addr:housenumber];
    );
    out body 1;
  `,
};

async function queryOverpass(lat: number, lon: number): Promise<PoiResult | null> {
  // Try business query first (most detailed)
  for (const [type, queryFn] of Object.entries(overpassQueries)) {
    const query = queryFn(lat, lon);
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
      const result = await new Promise<PoiResult | null>((resolve, reject) => {
        const req: ClientRequest = https.get(url, { timeout: 8000 }, (res: IncomingMessage) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json: OverpassResponse = JSON.parse(data);
              if (json.elements?.[0]) {
                const poi = json.elements[0];
                const tags = poi.tags || {};

                resolve({
                  name: tags.name || tags['addr:housename'] || tags.operator,
                  category:
                    tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.building,
                  brand: tags.brand || tags['brand:wikidata'],
                  cuisine: tags.cuisine,
                  operator: tags.operator,
                  website: tags.website,
                  phone: tags.phone,
                  opening_hours: tags.opening_hours,
                  type: type,
                  source: 'overpass',
                  confidence: tags.name ? 0.95 : 0.6,
                });
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });

      if (result && result.name) {
        return result;
      }
    } catch {
      // Continue to next query type
    }

    // Rate limit between queries
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

async function main(): Promise<void> {
  const limit = parseInt(process.argv[2] || '100', 10);

  const result: QueryResult<NetworkRow> = await pool.query(
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

  console.log(`🔍 Overpass Turbo optimized enrichment: ${result.rows.length} addresses\n`);

  let enriched = 0;
  const categories: Record<string, number> = {};

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];

    try {
      const poi = await queryOverpass(row.trilat_lat, row.trilat_lon);

      if (poi && poi.name) {
        await pool.query(
          `
          UPDATE app.networks_legacy
          SET venue_name = $1, venue_category = $2, name = $3
          WHERE bssid = $4
        `,
          [poi.name, poi.category, poi.brand || poi.name, row.bssid]
        );

        await pool.query(
          `
          UPDATE app.ap_locations
          SET venue_name = $1, venue_category = $2
          WHERE bssid = $3
        `,
          [poi.name, poi.category, row.bssid]
        );

        if (poi.category) {
          categories[poi.category] = (categories[poi.category] || 0) + 1;
        }
        enriched++;

        console.log(`  ✓ ${i + 1}/${result.rows.length}: ${poi.name} (${poi.category})`);
      } else {
        console.log(`  ✗ ${i + 1}/${result.rows.length}: No POI found`);
      }
    } catch (err) {
      const error = err as Error;
      console.log(`  ✗ ${i + 1}/${result.rows.length}: Error - ${error.message}`);
    }

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(
    `\n✓ Complete: ${enriched}/${result.rows.length} addresses enriched (${((enriched / result.rows.length) * 100).toFixed(1)}%)`
  );
  console.log('\n📊 Categories found:');
  Object.entries(categories)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });

  await pool.end();
}

main().catch(console.error);
