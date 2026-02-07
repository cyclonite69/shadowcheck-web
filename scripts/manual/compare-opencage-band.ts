#!/usr/bin/env tsx
import * as https from 'https';
import { Pool } from 'pg';
import keyringService from '../../server/src/services/keyringService';
import secretsManager from '../../server/src/services/secretsManager';

type ContextItem = { id?: string; text?: string; short_code?: string };

const LIMIT = parseInt(process.argv[2] || '200', 10);
const MIN_RADIUS = parseInt(process.argv[3] || '10', 10);
const MAX_RADIUS = parseInt(process.argv[4] || '50', 10);
const PER_MINUTE = parseInt(process.argv[5] || '60', 10);
const DELAY_MS = Math.max(1, Math.floor(60000 / PER_MINUTE));

const pool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const extractNumber = (value?: string | null) => {
  if (!value) return null;
  const match = value.trim().match(/^(\d+)/);
  return match ? match[1] : null;
};

const normalize = (value?: string | null) => {
  if (!value) return '';
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const opencageReverse = async (lat: number, lon: number, key: string) => {
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${key}&limit=1`;
  return new Promise<{
    ok: boolean;
    address?: string;
    city?: string;
    state?: string;
    postal?: string;
    country?: string;
    confidence?: number;
  }>((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 429) return reject(new Error('rate_limit'));
          if (res.statusCode && res.statusCode >= 400) return resolve({ ok: false });
          try {
            const json = JSON.parse(data) as {
              results?: Array<{
                formatted?: string;
                components?: Record<string, string>;
                confidence?: number;
              }>;
            };
            const result = json.results?.[0];
            if (!result?.formatted) return resolve({ ok: false });
            const components = result.components || {};
            resolve({
              ok: true,
              address: result.formatted,
              city:
                components.city ||
                components.town ||
                components.village ||
                components.hamlet ||
                components.county ||
                null,
              state: components.state || null,
              postal: components.postcode || null,
              country: components.country || null,
              confidence: result.confidence ? result.confidence / 100 : null,
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
  let key = await (secretsManager as any).getSecret('opencage_api_key');
  if (!key) {
    key = await (keyringService as any).getCredential('opencage_api_key');
  }
  if (!key) {
    console.error('OpenCage key not available');
    process.exit(1);
  }

  const rows = await pool.query(
    `
    WITH home AS (
      SELECT location
      FROM app.location_markers
      WHERE marker_type = 'home'
      ORDER BY created_at DESC
      LIMIT 1
    )
    SELECT c.lat_round, c.lon_round, c.address AS mapbox_address
    FROM app.geocoding_cache c
    CROSS JOIN home h
    WHERE c.precision = 5
      AND c.provider = 'mapbox_v5_permanent'
      AND c.address IS NOT NULL
      AND ST_DWithin(geography(ST_SetSRID(ST_MakePoint(c.lon_round, c.lat_round), 4326)), geography(h.location), $3)
      AND NOT ST_DWithin(geography(ST_SetSRID(ST_MakePoint(c.lon_round, c.lat_round), 4326)), geography(h.location), $2)
    ORDER BY c.geocoded_at DESC
    LIMIT $1;
    `,
    [LIMIT, MIN_RADIUS, MAX_RADIUS]
  );

  let processed = 0;
  let opencageOk = 0;
  let opencageWithCity = 0;
  let opencageWithState = 0;
  let opencageWithPostal = 0;
  let exactMatch = 0;
  let numberMatch = 0;
  const mismatches: Array<{ mapbox: string; opencage: string | null }> = [];

  for (const row of rows.rows) {
    const mapboxAddress = row.mapbox_address as string | null;
    try {
      const geo = await opencageReverse(row.lat_round, row.lon_round, key as string);
      if (geo.ok) {
        opencageOk++;
        if (geo.city) opencageWithCity++;
        if (geo.state) opencageWithState++;
        if (geo.postal) opencageWithPostal++;

        const normalizedMapbox = normalize(mapboxAddress);
        const normalizedOpencage = normalize(geo.address || '');
        if (normalizedMapbox && normalizedOpencage && normalizedMapbox === normalizedOpencage) {
          exactMatch++;
        }
        const mapboxNum = extractNumber(mapboxAddress);
        const opencageNum = extractNumber(geo.address);
        if (mapboxNum && opencageNum && mapboxNum === opencageNum) {
          numberMatch++;
        } else if (mismatches.length < 10) {
          mismatches.push({ mapbox: mapboxAddress || '', opencage: geo.address || null });
        }
      }
    } catch (err: any) {
      if (err.message === 'rate_limit') {
        await new Promise((r) => setTimeout(r, 60000));
      }
    }

    processed++;
    if (processed < rows.rows.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  const summary = {
    processed,
    opencageOk,
    opencageOkPct: processed ? Math.round((opencageOk / processed) * 1000) / 10 : 0,
    opencageWithCity,
    opencageWithState,
    opencageWithPostal,
    exactMatch,
    exactMatchPct: processed ? Math.round((exactMatch / processed) * 1000) / 10 : 0,
    numberMatch,
    numberMatchPct: processed ? Math.round((numberMatch / processed) * 1000) / 10 : 0,
    band: `${MIN_RADIUS}-${MAX_RADIUS}`,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (mismatches.length > 0) {
    console.log('Sample mismatches (mapbox vs opencage):');
    mismatches.forEach((row) => {
      console.log(`- ${row.mapbox}  |  ${row.opencage ?? 'null'}`);
    });
  }

  await pool.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
