#!/usr/bin/env tsx
import * as https from 'https';
import { Pool, QueryResult } from 'pg';
import '../loadEnv';

interface RoundedRow {
  lat_round: number;
  lon_round: number;
  obs_count: number;
  address?: string | null;
}

interface MapboxResponseV6 {
  features?: Array<unknown>;
}

interface MapboxFeatureV5 {
  text?: string;
  place_name?: string;
  place_type?: string[];
  relevance?: number;
  properties?: {
    category?: string;
  };
  context?: Array<{
    id?: string;
    text?: string;
    short_code?: string;
  }>;
}

interface MapboxResponseV5 {
  features?: MapboxFeatureV5[];
}

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  console.error('❌ MAPBOX_TOKEN not found in .env');
  process.exit(1);
}

const LIMIT = parseInt(process.argv[2] || '1000', 10);
const PRECISION = parseInt(process.argv[3] || '5', 10);
const PER_MINUTE = parseInt(process.env.MAPBOX_PER_MINUTE || '200', 10);
const DELAY_MS = Math.max(1, Math.floor(60000 / PER_MINUTE));
const PERMANENT = process.argv.includes('--permanent');
const INCLUDE_POI = process.argv.includes('--poi'); // Uses v5 endpoint (POI not in v6)
const ADDRESS_ONLY = process.argv.includes('--address-only');
const POI_ONLY = process.argv.includes('--poi-only');
const STORE = !process.argv.includes('--no-store');
const MODE = POI_ONLY
  ? 'poi-only'
  : ADDRESS_ONLY
    ? 'address-only'
    : INCLUDE_POI
      ? 'both'
      : 'address-only';

const POI_EXCLUDE_DEFAULT = [
  '814 Martin Luther King Jr Avenue, Flint, Michigan 48503, United States',
  '816 Martin Luther King Jr Avenue, Flint, Michigan 48503, United States',
];

const shouldSkipPoi = (address?: string | null): boolean => {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return (
    normalized.includes('814 martin luther king') || normalized.includes('816 martin luther king')
  );
};
const poiExcludeArg = process.argv.find((arg) => arg.startsWith('--poi-exclude='));
const POI_EXCLUDE =
  poiExcludeArg && poiExcludeArg.includes('=')
    ? poiExcludeArg.split('=')[1]?.split('|').filter(Boolean)
    : POI_EXCLUDE_DEFAULT;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

function parseContext(context?: MapboxFeatureV5['context']): {
  city?: string;
  state?: string;
  postal?: string;
  country?: string;
} {
  const data: { city?: string; state?: string; postal?: string; country?: string } = {};
  if (!context) return data;

  for (const item of context) {
    const id = item.id || '';
    if (id.startsWith('place.')) {
      data.city = item.text || data.city;
    } else if (id.startsWith('region.')) {
      const short = item.short_code?.split('-')[1]?.toUpperCase();
      data.state = short || item.text || data.state;
    } else if (id.startsWith('postcode.')) {
      data.postal = item.text || data.postal;
    } else if (id.startsWith('country.')) {
      data.country = item.text || data.country;
    }
  }

  return data;
}

async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{
  ok: boolean;
  poiName?: string;
  poiCategory?: string;
  featureType?: string;
  address?: string;
  city?: string;
  state?: string;
  postal?: string;
  country?: string;
  confidence?: number;
  raw?: unknown;
}> {
  if (MODE === 'both' || MODE === 'poi-only') {
    // v5 endpoint supports POI; v6 geocoding does not.
    const permanentParam = PERMANENT ? '&permanent=true' : '';
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}&types=poi,address&limit=5${permanentParam}`;
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 429) {
              return reject(new Error('rate_limit'));
            }
            if (res.statusCode && res.statusCode >= 400) {
              return resolve({ ok: false, raw: data });
            }
            try {
              const json: MapboxResponseV5 = JSON.parse(data);
              const features = json.features || [];
              const poiFeature = features.find((f) => f.place_type?.includes('poi'));
              const addressFeature =
                features.find((f) => f.place_type?.includes('address')) || features[0];
              const context = parseContext(addressFeature?.context || poiFeature?.context);
              resolve({
                ok: features.length > 0,
                poiName: poiFeature?.text,
                poiCategory: poiFeature?.properties?.category,
                featureType: addressFeature?.place_type?.[0] || poiFeature?.place_type?.[0],
                address: addressFeature?.place_name || poiFeature?.place_name,
                city: context.city,
                state: context.state,
                postal: context.postal,
                country: context.country,
                confidence: addressFeature?.relevance ?? poiFeature?.relevance,
                raw: json,
              });
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  }

  const permanentParam = PERMANENT ? '&permanent=true' : '';
  const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lon}&latitude=${lat}&types=address&limit=1&access_token=${MAPBOX_TOKEN}${permanentParam}`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 429) {
            return reject(new Error('rate_limit'));
          }
          if (res.statusCode && res.statusCode >= 400) {
            return resolve({ ok: false, raw: data });
          }
          try {
            const json: MapboxResponseV6 = JSON.parse(data);
            resolve({ ok: !!(json.features && json.features.length > 0), raw: json });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function storeResult(
  row: RoundedRow,
  geo: Awaited<ReturnType<typeof reverseGeocode>>
): Promise<void> {
  if (!STORE || !geo.ok) return;

  const providerBase = MODE === 'both' || MODE === 'poi-only' ? 'mapbox_v5' : 'mapbox_v6';
  const provider = PERMANENT ? `${providerBase}_permanent` : providerBase;

  await pool.query(
    `
    INSERT INTO app.geocoding_cache (
      precision,
      lat_round,
      lon_round,
      lat,
      lon,
      address,
      poi_name,
      poi_category,
      feature_type,
      poi_skip,
      city,
      state,
      postal_code,
      country,
      provider,
      confidence,
      raw_response
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ON CONFLICT (precision, lat_round, lon_round) DO UPDATE SET
      address = COALESCE(app.geocoding_cache.address, EXCLUDED.address),
      poi_name = COALESCE(app.geocoding_cache.poi_name, EXCLUDED.poi_name),
      poi_category = COALESCE(app.geocoding_cache.poi_category, EXCLUDED.poi_category),
      feature_type = COALESCE(app.geocoding_cache.feature_type, EXCLUDED.feature_type),
      poi_skip = app.geocoding_cache.poi_skip OR EXCLUDED.poi_skip,
      city = COALESCE(app.geocoding_cache.city, EXCLUDED.city),
      state = COALESCE(app.geocoding_cache.state, EXCLUDED.state),
      postal_code = COALESCE(app.geocoding_cache.postal_code, EXCLUDED.postal_code),
      country = COALESCE(app.geocoding_cache.country, EXCLUDED.country),
      provider = COALESCE(app.geocoding_cache.provider, EXCLUDED.provider),
      confidence = COALESCE(app.geocoding_cache.confidence, EXCLUDED.confidence),
      lat = COALESCE(app.geocoding_cache.lat, EXCLUDED.lat),
      lon = COALESCE(app.geocoding_cache.lon, EXCLUDED.lon),
      geocoded_at = NOW(),
      raw_response = COALESCE(app.geocoding_cache.raw_response, EXCLUDED.raw_response);
  `,
    [
      PRECISION,
      row.lat_round,
      row.lon_round,
      row.lat_round,
      row.lon_round,
      geo.address || null,
      geo.poiName || null,
      geo.poiCategory || null,
      geo.featureType || null,
      shouldSkipPoi(geo.address),
      geo.city || null,
      geo.state || null,
      geo.postal || null,
      geo.country || null,
      provider,
      geo.confidence ?? null,
      geo.raw ? JSON.stringify(geo.raw) : null,
    ]
  );
}

async function main(): Promise<void> {
  console.log(
    `🧭 Sampling ${LIMIT} unique blocks at precision ${PRECISION} (rate ${PER_MINUTE}/min, delay ${DELAY_MS}ms)`
  );
  if (MODE === 'both') {
    console.log('🔎 Mode: address+POI (Mapbox v5 reverse geocoding, types=poi,address)');
  } else if (MODE === 'poi-only') {
    console.log('🔎 Mode: POI-only (Mapbox v5 reverse geocoding, types=poi,address)');
  } else {
    console.log('🔎 Mode: address-only (Mapbox v6 reverse geocoding, types=address)');
  }
  if (MODE === 'poi-only' && POI_EXCLUDE.length > 0) {
    console.log(`🚫 POI exclude list enabled (${POI_EXCLUDE.length} address(es))`);
  }
  if (STORE) {
    console.log('💾 Storing results in app.geocoding_cache');
  }
  if (PERMANENT) {
    console.log('⚠️  Permanent geocoding enabled (results may be billable)');
  }

  let result: QueryResult<RoundedRow>;
  if (MODE === 'poi-only') {
    result = await pool.query(
      `
      SELECT
        c.lat_round::double precision AS lat_round,
        c.lon_round::double precision AS lon_round,
        1 AS obs_count,
        c.address
      FROM app.geocoding_cache c
      WHERE c.precision = $2
        AND c.poi_name IS NULL
        AND c.address IS NOT NULL
        AND NOT (c.address = ANY($3::text[]))
      ORDER BY c.geocoded_at DESC
      LIMIT $1;
    `,
      [LIMIT, PRECISION, POI_EXCLUDE]
    );
  } else {
    result = await pool.query(
      `
      WITH rounded AS (
        SELECT
          round(lat::numeric, $2) AS lat_round,
          round(lon::numeric, $2) AS lon_round,
          count(*) AS obs_count
        FROM app.observations
        GROUP BY 1, 2
      )
      SELECT
        r.lat_round::double precision AS lat_round,
        r.lon_round::double precision AS lon_round,
        r.obs_count
      FROM rounded r
      LEFT JOIN app.geocoding_cache c
        ON c.precision = $2
       AND c.lat_round = r.lat_round
       AND c.lon_round = r.lon_round
      WHERE c.id IS NULL
      ORDER BY obs_count DESC
      LIMIT $1;
    `,
      [LIMIT, PRECISION]
    );
  }

  let processed = 0;
  let successful = 0;
  let poiHits = 0;
  let rateLimited = 0;

  for (const row of result.rows) {
    try {
      const result = await reverseGeocode(row.lat_round, row.lon_round);
      if (result.ok) {
        successful++;
        if (result.poiName) {
          poiHits++;
        }
        await storeResult(row, result);
      }
    } catch (err) {
      const error = err as Error;
      if (error.message === 'rate_limit') {
        rateLimited++;
        // Back off hard on rate limit.
        await new Promise((r) => setTimeout(r, 60000));
      }
    }

    processed++;
    if (processed % 100 === 0 || processed === result.rows.length) {
      const poiText = INCLUDE_POI ? `, ${poiHits} poi` : '';
      console.log(
        `  ✓ ${processed}/${result.rows.length} (${successful} success${poiText}, ${rateLimited} 429s)`
      );
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\n✅ Done. ${successful}/${processed} returned an address.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
