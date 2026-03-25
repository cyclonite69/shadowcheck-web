#!/usr/bin/env tsx
/**
 * Forward-geocode missing agency_offices coordinates via Nominatim.
 *
 * This improves data quality when Smarty can't provide lat/lon for some addresses.
 *
 * Usage:
 *   npx --yes tsx etl/transform/enrich-agency-offices-coords-nominatim.ts --dry-run --limit=50
 *   npx --yes tsx etl/transform/enrich-agency-offices-coords-nominatim.ts --live --agency=FBI --limit=500 --sleep-ms=1100
 *   npx --yes tsx etl/transform/enrich-agency-offices-coords-nominatim.ts --live --states=PR,VI --limit=200 --sleep-ms=1200
 */

import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import dns from 'dns/promises';

dotenv.config();

type SecretsManager = {
  getSecret: (name: string) => Promise<string | null>;
};

type Options = {
  dryRun: boolean;
  agency: string;
  limit: number;
  sleepMs: number;
  states: string[] | null;
};

type Row = {
  id: number;
  agency: string;
  office_type: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  location: unknown | null;
};

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  class?: string;
  type?: string;
  importance?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeZip5(postal: string | null): string | null {
  const raw = (postal || '').trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{5})/);
  return m ? m[1] : null;
}

function parseArgs(argv: string[]): Options {
  const getNum = (prefix: string, fallback: number) => {
    const raw = argv.find((a) => a.startsWith(prefix));
    if (!raw) return fallback;
    const n = Number(raw.split('=')[1]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const getStr = (prefix: string): string | null => {
    const raw = argv.find((a) => a.startsWith(prefix));
    if (!raw) return null;
    const v = raw.slice(prefix.length).trim();
    return v.length ? v : null;
  };

  const dryRun =
    argv.includes('--dry-run') || (!argv.includes('--live') && !argv.includes('--live=true'));
  const agency = getStr('--agency=') || 'FBI';
  const statesRaw = getStr('--states=');
  const states = statesRaw
    ? Array.from(
        new Set(
          statesRaw
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        )
      )
    : null;

  return {
    dryRun,
    agency,
    limit: getNum('--limit=', 500),
    sleepMs: getNum('--sleep-ms=', 1100),
    states,
  };
}

async function loadSecretsManager(): Promise<SecretsManager> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sm = require('../../server/src/services/secretsManager') as SecretsManager;
  if (!sm?.getSecret) throw new Error('Failed to load secretsManager (missing getSecret).');
  return sm;
}

async function resolveDbHost(): Promise<string> {
  const configured = process.env.DB_HOST || 'localhost';
  if (configured === 'shadowcheck_postgres') {
    return 'localhost';
  }
  try {
    await dns.lookup(configured);
    return configured;
  } catch {
    return 'localhost';
  }
}

function countryForState(state: string): string {
  const s = state.toUpperCase();
  if (s === 'PR') return 'Puerto Rico';
  if (s === 'VI') return 'US Virgin Islands';
  return 'USA';
}

function buildQuery(row: Row): string {
  const zip5 = normalizeZip5(row.postal_code);
  const secondary = row.address_line2 ? row.address_line2.trim() : '';
  const parts = [
    row.address_line1.trim(),
    secondary,
    `${row.city.trim()}, ${row.state.trim()}${zip5 ? ' ' + zip5 : ''}`,
    countryForState(row.state),
  ].filter(Boolean);
  return parts.join(', ');
}

async function nominatimSearch(q: string): Promise<NominatimResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('q', q);

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'ShadowCheckStatic/1.0 (forward geocode; contact: local)',
      Accept: 'application/json',
    },
  });

  if (res.status === 429) {
    throw new Error('rate_limit');
  }

  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return null;
  const first = json[0] as NominatimResult | undefined;
  if (!first?.lat || !first?.lon) return null;
  return first;
}

async function nominatimSearchStructured(params: {
  street: string;
  city: string;
  state: string;
  postalcode?: string;
  countrycodes?: string;
}): Promise<NominatimResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('street', params.street);
  url.searchParams.set('city', params.city);
  url.searchParams.set('state', params.state);
  if (params.postalcode) url.searchParams.set('postalcode', params.postalcode);
  if (params.countrycodes) url.searchParams.set('countrycodes', params.countrycodes);

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'ShadowCheckStatic/1.0 (forward geocode; contact: local)',
      Accept: 'application/json',
    },
  });
  if (res.status === 429) throw new Error('rate_limit');
  if (!res.ok) return null;
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return null;
  const first = json[0] as NominatimResult | undefined;
  if (!first?.lat || !first?.lon) return null;
  return first;
}

function countryCodesForState(state: string): string {
  const s = state.toUpperCase();
  if (s === 'PR') return 'pr,us';
  if (s === 'VI') return 'vi,us';
  return 'us';
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const secrets = await loadSecretsManager();
  const dbPassword = (await secrets.getSecret('db_password')) || process.env.DB_PASSWORD;
  if (!dbPassword) throw new Error('Database password not configured (db_password / DB_PASSWORD).');

  const dbHost = await resolveDbHost();
  const dbUser = process.env.DB_USER || 'shadowcheck_user';
  const dbName = process.env.DB_NAME || 'shadowcheck_db';
  const dbPort = Number(process.env.DB_PORT || 5432);

  const pool = new Pool({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    port: dbPort,
  });

  console.log('Enriching agency_offices coordinates via Nominatim\n');
  console.log(`  Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Agency: ${options.agency}`);
  console.log(`  Limit: ${options.limit}`);
  console.log(`  Sleep (ms): ${options.sleepMs}`);
  console.log(`  States: ${options.states ? options.states.join(',') : '(all)'}`);
  console.log(`  DB: ${dbUser}@${dbHost}:${dbPort}/${dbName}\n`);

  const start = Date.now();

  try {
    const rowsRes = await pool.query<Row>(
      `
      SELECT
        id,
        agency,
        office_type,
        name,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        latitude,
        longitude,
        location
      FROM app.agency_offices
      WHERE agency = $1::text
        AND NULLIF(BTRIM(address_line1), '') IS NOT NULL
        AND NULLIF(BTRIM(city), '') IS NOT NULL
        AND NULLIF(BTRIM(state), '') IS NOT NULL
        AND ($2::text[] IS NULL OR state = ANY($2::text[]))
        AND (latitude IS NULL OR longitude IS NULL OR location IS NULL)
      ORDER BY office_type, state, city, name
      LIMIT $3
      `,
      [options.agency, options.states, options.limit]
    );

    const rows = rowsRes.rows;
    console.log(`  Candidate rows (missing coords): ${rows.length}`);

    if (options.dryRun) {
      console.log('\n  [DRY RUN] No external calls or DB updates performed.');
      return;
    }

    let updated = 0;
    let noMatch = 0;
    let failed = 0;

    for (const row of rows) {
      const q = buildQuery(row);
      const zip5 = normalizeZip5(row.postal_code);

      try {
        const result =
          (await nominatimSearchStructured({
            street: [row.address_line1, row.address_line2 || ''].filter(Boolean).join(' '),
            city: row.city,
            state: row.state,
            postalcode: zip5 || undefined,
            countrycodes: countryCodesForState(row.state),
          })) ||
          (await nominatimSearchStructured({
            street: [row.address_line1, row.address_line2 || ''].filter(Boolean).join(' '),
            city: row.city,
            state: row.state,
            countrycodes: countryCodesForState(row.state),
          })) ||
          (await nominatimSearch(q));
        if (!result) {
          noMatch += 1;
          continue;
        }

        const lat = Number(result.lat);
        const lon = Number(result.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          noMatch += 1;
          continue;
        }

        const meta = {
          provider: 'nominatim_forward',
          queried: q,
          structured: true,
          display_name: result.display_name || null,
          class: result.class || null,
          type: result.type || null,
          importance: typeof result.importance === 'number' ? result.importance : null,
          geocoded_at: new Date().toISOString(),
        };

        const updateRes = await pool.query(
          `
          UPDATE app.agency_offices
          SET
            latitude = COALESCE(latitude, $2::double precision),
            longitude = COALESCE(longitude, $3::double precision),
            location = CASE
              WHEN location IS NOT NULL THEN location
              WHEN $2::double precision IS NULL OR $3::double precision IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326)::geography
            END,
            address_validation_metadata = COALESCE(address_validation_metadata, '{}'::jsonb)
              || jsonb_build_object('coords_nominatim', $4::jsonb),
            updated_at = NOW()
          WHERE id = $1
            AND (latitude IS NULL OR longitude IS NULL OR location IS NULL)
          `,
          [row.id, lat, lon, JSON.stringify(meta)]
        );

        if ((updateRes.rowCount ?? 0) > 0) {
          updated += 1;
        }
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        if (msg.includes('rate_limit')) {
          await sleep(5000);
          try {
            const result = await nominatimSearch(q);
            if (!result) {
              noMatch += 1;
            } else {
              const lat = Number(result.lat);
              const lon = Number(result.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                noMatch += 1;
              } else {
                const meta = {
                  provider: 'nominatim_forward',
                  queried: q,
                  display_name: result.display_name || null,
                  class: result.class || null,
                  type: result.type || null,
                  importance: typeof result.importance === 'number' ? result.importance : null,
                  geocoded_at: new Date().toISOString(),
                  retried_after_rate_limit: true,
                };
                const updateRes = await pool.query(
                  `
                  UPDATE app.agency_offices
                  SET
                    latitude = COALESCE(latitude, $2::double precision),
                    longitude = COALESCE(longitude, $3::double precision),
                    location = CASE
                      WHEN location IS NOT NULL THEN location
                      WHEN $2::double precision IS NULL OR $3::double precision IS NULL THEN NULL
                      ELSE ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326)::geography
                    END,
                    address_validation_metadata = COALESCE(address_validation_metadata, '{}'::jsonb)
                      || jsonb_build_object('coords_nominatim', $4::jsonb),
                    updated_at = NOW()
                  WHERE id = $1
                    AND (latitude IS NULL OR longitude IS NULL OR location IS NULL)
                  `,
                  [row.id, lat, lon, JSON.stringify(meta)]
                );
                if ((updateRes.rowCount ?? 0) > 0) updated += 1;
              }
            }
          } catch {
            failed += 1;
          }
        } else {
          failed += 1;
        }
      } finally {
        await sleep(options.sleepMs);
      }
    }

    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n');
    console.log(`Done in ${seconds}s`);
    console.log(`  Updated: ${updated}`);
    console.log(`  No match: ${noMatch}`);
    console.log(`  Failed: ${failed}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  const e = err as Error;
  console.error(`\nNominatim coords enrichment failed: ${e.message}`);
  process.exit(1);
});
