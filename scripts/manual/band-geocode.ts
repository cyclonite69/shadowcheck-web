#!/usr/bin/env tsx
import * as https from 'https';
import { Pool } from 'pg';
import keyringService from '../../server/src/services/keyringService';
import secretsManager from '../../server/src/services/secretsManager';

type ContextItem = { id?: string; text?: string; short_code?: string };

const LIMIT = parseInt(process.argv[2] || '300', 10);
const PER_MINUTE = parseInt(process.argv[3] || '200', 10);
const MIN_RADIUS = parseInt(process.argv[4] || '10', 10);
const MAX_RADIUS = parseInt(process.argv[5] || '50', 10);
const PRECISION = 5;
const DELAY_MS = Math.max(1, Math.floor(60000 / PER_MINUTE));

const pool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const parseContext = (context?: ContextItem[]) => {
  const data: { city?: string; state?: string; postal?: string; country?: string } = {};
  if (!context) return data;
  for (const item of context) {
    const id = item.id || '';
    if (id.startsWith('place.')) data.city = item.text || data.city;
    else if (id.startsWith('region.')) {
      const short = item.short_code?.split('-')[1]?.toUpperCase();
      data.state = short || item.text || data.state;
    } else if (id.startsWith('postcode.')) data.postal = item.text || data.postal;
    else if (id.startsWith('country.')) data.country = item.text || data.country;
  }
  return data;
};

const shouldSkipPoi = (address?: string | null) => {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return (
    normalized.includes('814 martin luther king') || normalized.includes('816 martin luther king')
  );
};

const reverseGeocode = async (lat: number, lon: number, token: string) => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${token}&types=address&limit=1&permanent=true`;
  return new Promise<{
    ok: boolean;
    address?: string;
    city?: string;
    state?: string;
    postal?: string;
    country?: string;
    confidence?: number;
    raw?: unknown;
  }>((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 429) return reject(new Error('rate_limit'));
          if (res.statusCode && res.statusCode >= 400) return resolve({ ok: false, raw: data });
          try {
            const json = JSON.parse(data) as {
              features?: Array<{
                place_name?: string;
                relevance?: number;
                context?: ContextItem[];
              }>;
            };
            const feature = json.features?.[0];
            if (!feature?.place_name) return resolve({ ok: false, raw: json });
            const context = parseContext(feature.context);
            resolve({
              ok: true,
              address: feature.place_name,
              city: context.city,
              state: context.state,
              postal: context.postal,
              country: context.country,
              confidence: feature.relevance ?? null,
              raw: json,
            });
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
};

const main = async () => {
  if (typeof (secretsManager as any).load === 'function') {
    await (secretsManager as any).load();
  }
  let token = await (secretsManager as any).getSecret('mapbox_token');
  if (!token) {
    token = await (keyringService as any).getMapboxToken();
  }
  if (!token) {
    console.error('Mapbox token not available');
    process.exit(1);
  }

  const result = await pool.query(
    `
    WITH home AS (
      SELECT location
      FROM app.location_markers
      WHERE marker_type = 'home'
      ORDER BY created_at DESC
      LIMIT 1
    ),
    band AS (
      SELECT
        round(o.lat::numeric, $2) AS lat_round,
        round(o.lon::numeric, $2) AS lon_round,
        count(*) AS obs_count
      FROM app.observations o
      CROSS JOIN home h
      WHERE ST_DWithin(geography(ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)), geography(h.location), $4)
        AND NOT ST_DWithin(geography(ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)), geography(h.location), $3)
      GROUP BY 1,2
    )
    SELECT b.lat_round::double precision AS lat_round,
           b.lon_round::double precision AS lon_round,
           b.obs_count
    FROM band b
    LEFT JOIN app.geocoding_cache c
      ON c.precision = $2
     AND c.lat_round = b.lat_round
     AND c.lon_round = b.lon_round
    WHERE c.id IS NULL
    ORDER BY b.obs_count DESC
    LIMIT $1;
    `,
    [LIMIT, PRECISION, MIN_RADIUS, MAX_RADIUS]
  );

  let processed = 0;
  let successful = 0;
  let rateLimited = 0;

  for (const row of result.rows) {
    try {
      const geo = await reverseGeocode(row.lat_round, row.lon_round, token as string);
      if (geo.ok) {
        successful++;
      }
      await pool.query(
        `
        INSERT INTO app.geocoding_cache (
          precision, lat_round, lon_round, lat, lon,
          address, poi_skip, address_attempted_at, address_attempts,
          city, state, postal_code, country,
          provider, confidence, raw_response
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),1,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (precision, lat_round, lon_round) DO UPDATE SET
          address = COALESCE(app.geocoding_cache.address, EXCLUDED.address),
          poi_skip = app.geocoding_cache.poi_skip OR EXCLUDED.poi_skip,
          address_attempted_at = NOW(),
          address_attempts = app.geocoding_cache.address_attempts + 1,
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
          geo.ok ? geo.address || null : null,
          shouldSkipPoi(geo.address || null),
          geo.city || null,
          geo.state || null,
          geo.postal || null,
          geo.country || null,
          'mapbox_v5_permanent',
          geo.confidence ?? null,
          geo.raw ? JSON.stringify(geo.raw) : null,
        ]
      );
    } catch (err: any) {
      if (err.message === 'rate_limit') {
        rateLimited++;
        await new Promise((r) => setTimeout(r, 60000));
      }
    }

    processed++;
    if (processed < result.rows.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(
    JSON.stringify(
      {
        processed,
        successful,
        rateLimited,
        limit: LIMIT,
        band: `${MIN_RADIUS}-${MAX_RADIUS}`,
      },
      null,
      2
    )
  );
  await pool.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
