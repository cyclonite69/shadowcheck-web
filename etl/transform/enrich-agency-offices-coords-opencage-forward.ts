#!/usr/bin/env tsx
/**
 * Forward-geocode missing agency_offices coordinates via OpenCage.
 *
 * This is a fallback for the last stubborn rows where Mapbox/Nominatim don't resolve.
 * We only apply results when OpenCage confidence meets a minimum threshold.
 *
 * Usage:
 *   npx --yes tsx etl/transform/enrich-agency-offices-coords-opencage-forward.ts --dry-run --limit=25
 *   npx --yes tsx etl/transform/enrich-agency-offices-coords-opencage-forward.ts --live --agency=FBI --limit=200 --sleep-ms=300 --min-confidence=7
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
  minConfidence: number;
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

type OpenCageResponse = {
  total_results?: number;
  results?: Array<{
    formatted?: string;
    confidence?: number;
    geometry?: { lat?: number; lng?: number };
    components?: Record<string, unknown>;
  }>;
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
    return Number.isFinite(n) ? n : fallback;
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
    states,
    limit: getNum('--limit=', 200),
    sleepMs: getNum('--sleep-ms=', 300),
    minConfidence: getNum('--min-confidence=', 7),
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
  return [line1, line2, `${city}, ${state}${zip5 ? ' ' + zip5 : ''}`, 'USA']
    .filter(Boolean)
    .join(', ');
}

async function opencageForward(
  key: string,
  query: string
): Promise<{
  lat: number;
  lon: number;
  formatted: string | null;
  confidence: number | null;
  raw: unknown;
} | null> {
  const url = new URL('https://api.opencagedata.com/geocode/v1/json');
  url.searchParams.set('q', query);
  url.searchParams.set('key', key);
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString());
  if (res.status === 429) throw new Error('rate_limit');
  if (!res.ok) return null;

  const json = (await res.json()) as OpenCageResponse;
  const r = json.results?.[0];
  const lat = r?.geometry?.lat;
  const lon = r?.geometry?.lng;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  return {
    lat,
    lon,
    formatted: r?.formatted || null,
    confidence: typeof r?.confidence === 'number' ? r.confidence : null,
    raw: json,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const secrets = await loadSecretsManager();

  const dbPassword = (await secrets.getSecret('db_password')) || process.env.DB_PASSWORD;
  if (!dbPassword) throw new Error('Database password not configured (db_password / DB_PASSWORD).');

  const key = (await secrets.getSecret('opencage_api_key')) || process.env.OPENCAGE_API_KEY;
  if (!key) throw new Error('OpenCage key not configured (opencage_api_key / OPENCAGE_API_KEY).');

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

  console.log('Enriching agency_offices coordinates via OpenCage (forward)\n');
  console.log(`  Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Agency: ${options.agency}`);
  console.log(`  Limit: ${options.limit}`);
  console.log(`  Sleep (ms): ${options.sleepMs}`);
  console.log(`  Min confidence: ${options.minConfidence}`);
  console.log(`  States: ${options.states ? options.states.join(',') : '(all)'}\n`);

  try {
    const rowsRes = await pool.query<Row>(
      `
      SELECT
        id, agency, office_type, name,
        address_line1, address_line2, city, state, postal_code,
        normalized_address_line1, normalized_address_line2, normalized_city, normalized_state, normalized_postal_code,
        latitude, longitude, location
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
    let tooLow = 0;
    let failed = 0;

    for (const row of rows) {
      const q = buildQuery(row);
      try {
        const r = await opencageForward(key, q);
        if (!r) {
          noMatch += 1;
          continue;
        }

        const conf = r.confidence ?? 0;
        if (conf < options.minConfidence) {
          tooLow += 1;
          await pool.query(
            `
            UPDATE app.agency_offices
            SET
              address_validation_metadata = COALESCE(address_validation_metadata, '{}'::jsonb)
                || jsonb_build_object('coords_opencage_suggested', $2::jsonb),
              updated_at = NOW()
            WHERE id = $1
            `,
            [
              row.id,
              JSON.stringify({
                provider: 'opencage_forward',
                queried: q,
                formatted: r.formatted,
                confidence: r.confidence,
                lat: r.lat,
                lon: r.lon,
                suggested_at: new Date().toISOString(),
              }),
            ]
          );
          continue;
        }

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
              || jsonb_build_object('coords_opencage_forward', $4::jsonb),
            updated_at = NOW()
          WHERE id = $1
            AND (latitude IS NULL OR longitude IS NULL OR location IS NULL)
          `,
          [
            row.id,
            r.lat,
            r.lon,
            JSON.stringify({
              provider: 'opencage_forward',
              queried: q,
              formatted: r.formatted,
              confidence: r.confidence,
              geocoded_at: new Date().toISOString(),
            }),
          ]
        );

        if ((updateRes.rowCount ?? 0) > 0) updated += 1;
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

    console.log('\n');
    console.log('Done');
    console.log(`  Updated: ${updated}`);
    console.log(`  No match: ${noMatch}`);
    console.log(`  Too low confidence (suggested only): ${tooLow}`);
    console.log(`  Failed: ${failed}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  const e = err as Error;
  console.error(`\nOpenCage forward coords enrichment failed: ${e.message}`);
  process.exit(1);
});
