#!/usr/bin/env tsx
/**
 * Forward-geocode missing agency_offices coordinates via Mapbox.
 *
 * Mapbox tends to resolve US addresses better than Nominatim. This script only fills
 * latitude/longitude/location when missing, and stores a provenance blob in
 * address_validation_metadata.coords_mapbox_forward.
 *
 * Usage:
 *   npx --yes tsx etl/transform/enrich-agency-offices-coords-mapbox-forward.ts --dry-run --limit=25
 *   npx --yes tsx etl/transform/enrich-agency-offices-coords-mapbox-forward.ts --live --agency=FBI --limit=500 --sleep-ms=150
 *   npx --yes tsx etl/transform/enrich-agency-offices-coords-mapbox-forward.ts --live --states=PR,VI --limit=200 --sleep-ms=200
 */

import '../loadEnv';
import { Pool } from 'pg';
import dns from 'dns/promises';

type SecretsManager = {
  getSecret: (name: string) => Promise<string | null>;
};

type Options = {
  dryRun: boolean;
  agency: string;
  states: string[] | null;
  limit: number;
  sleepMs: number;
  permanent: boolean;
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
  normalized_address_line1: string | null;
  normalized_address_line2: string | null;
  normalized_city: string | null;
  normalized_state: string | null;
  normalized_postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  location: unknown | null;
};

type MapboxFeature = {
  center?: [number, number];
  place_name?: string;
  place_type?: string[];
  relevance?: number;
  properties?: { accuracy?: string };
};

type MapboxResponse = {
  features?: MapboxFeature[];
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

  const permanent = argv.includes('--permanent');

  return {
    dryRun,
    agency,
    states,
    limit: getNum('--limit=', 500),
    sleepMs: getNum('--sleep-ms=', 150),
    permanent,
  };
}

async function resolveDbHost(): Promise<string> {
  const configured = process.env.DB_HOST || 'localhost';
  if (configured === 'shadowcheck_postgres') return 'localhost';
  try {
    await dns.lookup(configured);
    return configured;
  } catch {
    return 'localhost';
  }
}

async function loadSecretsManager(): Promise<SecretsManager> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sm = require('../../server/src/services/secretsManager') as SecretsManager;
  if (!sm?.getSecret) throw new Error('Failed to load secretsManager (missing getSecret).');
  return sm;
}

function buildQuery(row: Row): string {
  const line1 = (row.normalized_address_line1 || row.address_line1).trim();
  const line2 = (row.normalized_address_line2 || row.address_line2 || '').trim();
  const city = (row.normalized_city || row.city).trim();
  const state = (row.normalized_state || row.state).trim();
  const zip5 = normalizeZip5(row.normalized_postal_code) || normalizeZip5(row.postal_code) || null;

  const parts = [line1, line2, `${city}, ${state}${zip5 ? ' ' + zip5 : ''}`, 'USA']
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.join(', ');
}

async function mapboxForward(opts: {
  token: string;
  query: string;
  permanent: boolean;
}): Promise<{ lat: number; lon: number; feature: MapboxFeature } | null> {
  const encoded = encodeURIComponent(opts.query);
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`);
  url.searchParams.set('access_token', opts.token);
  url.searchParams.set('limit', '1');
  url.searchParams.set('autocomplete', 'false');
  url.searchParams.set('types', 'address,poi');
  url.searchParams.set('country', 'us');
  if (opts.permanent) {
    url.searchParams.set('permanent', 'true');
  }

  const res = await fetch(url.toString());
  if (res.status === 429) throw new Error('rate_limit');
  if (!res.ok) return null;

  const json = (await res.json()) as MapboxResponse;
  const feature = json.features?.[0];
  if (!feature?.center || feature.center.length !== 2) return null;
  const [lon, lat] = feature.center;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, feature };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const secrets = await loadSecretsManager();

  const dbPassword = (await secrets.getSecret('db_password')) || process.env.DB_PASSWORD;
  if (!dbPassword) throw new Error('Database password not configured (db_password / DB_PASSWORD).');

  const mapboxToken =
    (await secrets.getSecret('mapbox_unlimited_api_key')) ||
    (await secrets.getSecret('mapbox_token')) ||
    process.env.MAPBOX_UNLIMITED_API_KEY ||
    process.env.MAPBOX_TOKEN;

  if (!mapboxToken) {
    throw new Error('Mapbox token not configured (mapbox_unlimited_api_key/mapbox_token).');
  }

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

  console.log('Enriching agency_offices coordinates via Mapbox (forward)\n');
  console.log(`  Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Agency: ${options.agency}`);
  console.log(`  Limit: ${options.limit}`);
  console.log(`  Sleep (ms): ${options.sleepMs}`);
  console.log(`  States: ${options.states ? options.states.join(',') : '(all)'}`);
  console.log(`  Permanent: ${options.permanent ? 'true' : 'false'}\n`);

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
        normalized_address_line1,
        normalized_address_line2,
        normalized_city,
        normalized_state,
        normalized_postal_code,
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

      try {
        const result = await mapboxForward({
          token: mapboxToken,
          query: q,
          permanent: options.permanent,
        });
        if (!result) {
          noMatch += 1;
          continue;
        }

        const meta = {
          provider: 'mapbox_forward',
          queried: q,
          permanent: options.permanent,
          place_name: result.feature.place_name || null,
          place_type: result.feature.place_type || null,
          relevance: typeof result.feature.relevance === 'number' ? result.feature.relevance : null,
          accuracy: result.feature.properties?.accuracy || null,
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
              || jsonb_build_object('coords_mapbox_forward', $4::jsonb),
            updated_at = NOW()
          WHERE id = $1
            AND (latitude IS NULL OR longitude IS NULL OR location IS NULL)
          `,
          [row.id, result.lat, result.lon, JSON.stringify(meta)]
        );

        if ((updateRes.rowCount ?? 0) > 0) {
          updated += 1;
        }
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        if (msg.includes('rate_limit')) {
          await sleep(1500);
        }
        failed += 1;
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
  console.error(`\nMapbox forward coords enrichment failed: ${e.message}`);
  process.exit(1);
});
