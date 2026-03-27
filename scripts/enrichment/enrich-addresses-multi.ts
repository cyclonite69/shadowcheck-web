#!/usr/bin/env tsx
import * as https from 'https';
import { Pool, QueryResult } from 'pg';
import '../loadEnv';

interface NetworkRow {
  bssid: string;
  trilat_address: string;
  trilat_lat: number;
  trilat_lon: number;
}

interface PoiResult {
  venue_name: string;
  venue_category?: string;
  venue_type?: string;
  venue_brand?: string;
  source: string;
}

interface NominatimResponse {
  display_name?: string;
  type?: string;
  class?: string;
}

interface OverpassResponse {
  elements?: Array<{
    tags?: {
      name?: string;
      amenity?: string;
      shop?: string;
      building?: string;
      brand?: string;
      operator?: string;
    };
  }>;
}

interface PhotonResponse {
  features?: Array<{
    properties?: {
      name?: string;
      type?: string;
      osm_value?: string;
      street?: string;
      city?: string;
    };
  }>;
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Free APIs for address enrichment
const APIs = {
  // 1. Nominatim (OpenStreetMap) - Free, no key needed
  nominatim: async (address: string): Promise<PoiResult | null> => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1`;
    return new Promise((resolve, reject) => {
      https
        .get(url, { headers: { 'User-Agent': 'ShadowCheck/1.0' } }, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json: NominatimResponse[] = JSON.parse(data);
              if (json.length > 0) {
                const result = json[0];
                resolve({
                  venue_name: result.display_name?.split(',')[0] || '',
                  venue_type: result.type,
                  venue_category: result.class,
                  source: 'nominatim',
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
  overpass: async (lat: number, lon: number): Promise<PoiResult | null> => {
    const query = `[out:json];(node(around:50,${lat},${lon})[name];way(around:50,${lat},${lon})[name];);out body 1;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json: OverpassResponse = JSON.parse(data);
              if (json.elements && json.elements.length > 0) {
                const poi = json.elements[0];
                resolve({
                  venue_name: poi.tags?.name || '',
                  venue_type: poi.tags?.amenity || poi.tags?.shop || poi.tags?.building,
                  venue_category: poi.tags?.amenity || poi.tags?.shop || 'building',
                  venue_brand: poi.tags?.brand,
                  source: 'overpass',
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
  photon: async (address: string): Promise<PoiResult | null> => {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json: PhotonResponse = JSON.parse(data);
              if (json.features && json.features.length > 0) {
                const props = json.features[0].properties;
                resolve({
                  venue_name: props?.name || '',
                  venue_type: props?.type,
                  venue_category: props?.osm_value,
                  source: 'photon',
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

async function enrichAddress(address: string, lat: number, lon: number): Promise<PoiResult | null> {
  // Try Overpass first (best for POI)
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit
    const overpass = await APIs.overpass(lat, lon);
    if (overpass && overpass.venue_name) {
      return overpass;
    }
  } catch (err) {
    const error = err as Error;
    console.error('Overpass error:', error.message);
  }

  // Fallback to Nominatim
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit
    const nominatim = await APIs.nominatim(address);
    if (nominatim && nominatim.venue_name) {
      return nominatim;
    }
  } catch (err) {
    const error = err as Error;
    console.error('Nominatim error:', error.message);
  }

  return null;
}

async function main(): Promise<void> {
  const limit = parseInt(process.argv[2] || '100', 10);

  // Get addresses without venue names
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
      const error = err as Error;
      console.error(`  ✗ ${i + 1}/${result.rows.length}: Error - ${error.message}`);
    }
  }

  console.log(`\n✓ Complete: ${enriched}/${result.rows.length} addresses enriched`);
  await pool.end();
}

main().catch(console.error);
