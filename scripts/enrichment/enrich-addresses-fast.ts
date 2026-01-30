import * as https from 'https';
import { Pool, QueryResult } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

interface NetworkRow {
  bssid: string;
  trilat_address: string;
  trilat_lat: number;
  trilat_lon: number;
}

interface EnrichmentResult {
  name?: string;
  category?: string;
  brand?: string;
  source: string;
}

interface ProcessResult {
  success: boolean;
  name?: string;
  category?: string;
  source?: string;
  error?: string;
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const CONCURRENT = 5; // Process 5 addresses at once

// All free APIs
const APIs = {
  overpass: async (lat: number, lon: number): Promise<EnrichmentResult | null> => {
    const query = `[out:json];(node(around:50,${lat},${lon})[name];way(around:50,${lat},${lon})[name];);out body 1;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    return new Promise((resolve) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.elements?.[0]) {
                const poi = json.elements[0];
                resolve({
                  name: poi.tags?.name,
                  category: poi.tags?.amenity || poi.tags?.shop || poi.tags?.building,
                  brand: poi.tags?.brand,
                  source: 'overpass',
                });
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          });
        })
        .on('error', () => resolve(null));
    });
  },

  nominatim: async (lat: number, lon: number): Promise<EnrichmentResult | null> => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    return new Promise((resolve) => {
      https
        .get(url, { headers: { 'User-Agent': 'ShadowCheck/1.0' } }, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.display_name) {
                resolve({
                  name: json.display_name.split(',')[0],
                  category: json.type,
                  source: 'nominatim',
                });
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          });
        })
        .on('error', () => resolve(null));
    });
  },

  locationiq: async (lat: number, lon: number): Promise<EnrichmentResult | null> => {
    const key = process.env.LOCATIONIQ_API_KEY;
    if (!key) {
      return null;
    }

    const url = `https://us1.locationiq.com/v1/reverse.php?key=${key}&lat=${lat}&lon=${lon}&format=json`;
    return new Promise((resolve) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve({
                name: json.display_name?.split(',')[0],
                category: json.type,
                source: 'locationiq',
              });
            } catch {
              resolve(null);
            }
          });
        })
        .on('error', () => resolve(null));
    });
  },

  opencage: async (lat: number, lon: number): Promise<EnrichmentResult | null> => {
    const key = process.env.OPENCAGE_API_KEY;
    if (!key) {
      return null;
    }

    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${key}&limit=1`;
    return new Promise((resolve) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              const result = json.results?.[0];
              if (result) {
                resolve({
                  name:
                    result.components?.building ||
                    result.components?.shop ||
                    result.formatted?.split(',')[0],
                  category: result.components?._category,
                  source: 'opencage',
                });
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          });
        })
        .on('error', () => resolve(null));
    });
  },
};

async function enrichAddress(lat: number, lon: number): Promise<EnrichmentResult | null> {
  // Try all APIs in parallel, return first success
  const results = await Promise.all([
    APIs.overpass(lat, lon),
    APIs.nominatim(lat, lon),
    APIs.locationiq(lat, lon),
    APIs.opencage(lat, lon),
  ]);

  // Return first result with a name
  return results.find((r) => r && r.name) || null;
}

async function main(): Promise<void> {
  const limit = parseInt(process.argv[2]) || 1000;

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

  console.log(`🚀 Fast enrichment: ${result.rows.length} addresses (${CONCURRENT} concurrent)`);

  let enriched = 0;
  for (let i = 0; i < result.rows.length; i += CONCURRENT) {
    const batch = result.rows.slice(i, Math.min(i + CONCURRENT, result.rows.length));

    const promises = batch.map(async (row): Promise<ProcessResult> => {
      try {
        const poi = await enrichAddress(row.trilat_lat, row.trilat_lon);

        if (poi && poi.name) {
          await pool.query(
            `
            UPDATE app.networks_legacy 
            SET venue_name = $1, venue_category = $2
            WHERE bssid = $3
          `,
            [poi.name, poi.category, row.bssid]
          );

          await pool.query(
            `
            UPDATE app.ap_locations 
            SET venue_name = $1, venue_category = $2
            WHERE bssid = $3
          `,
            [poi.name, poi.category, row.bssid]
          );

          return { success: true, name: poi.name, category: poi.category, source: poi.source };
        }
        return { success: false };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });

    const results = await Promise.all(promises);
    const batchEnriched = results.filter((r) => r.success).length;
    enriched += batchEnriched;

    console.log(
      `  ✓ ${Math.min(i + CONCURRENT, result.rows.length)}/${result.rows.length} (${enriched} enriched)`
    );

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`\n✓ Complete: ${enriched}/${result.rows.length} addresses enriched`);
  await pool.end();
}

main().catch(console.error);
