#!/usr/bin/env tsx
/**
 * Enrich app.agency_offices with ZIP+4 using Smarty US Street API.
 *
 * Goals:
 * - Fill ZIP+4 (postal_code) for rows that currently have only a 5-digit ZIP (or blank).
 * - Do not overwrite existing address fields or provenance (source_url/source_status/etc).
 * - Use Smarty credentials from keyring/env via the server secretsManager.
 *
 * Usage:
 *   # Dry run (no API calls, no DB updates)
 *   npx tsx etl/transform/enrich-agency-offices-zip4-smarty.ts --dry-run --limit=50
 *
 *   # Live run (calls Smarty, writes postal_code)
 *   npx tsx etl/transform/enrich-agency-offices-zip4-smarty.ts --live --limit=500
 *
 *   # Limit to a state (recommended for state-by-state backfills)
 *   npx tsx etl/transform/enrich-agency-offices-zip4-smarty.ts --live --state=KY --with-coordinates --limit=500
 *
 * Notes:
 * - By default, connects to Postgres using DB_* env vars, but will fall back to localhost
 *   if DB_HOST is not resolvable (common when DB_HOST is a Docker network alias).
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import dns from 'dns/promises';

dotenv.config();

type SecretsManager = {
  getSecret: (name: string) => Promise<string | null>;
};

type OfficeRow = {
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

type SmartyCandidate = {
  input_id?: string;
  delivery_line_1?: string;
  delivery_line_2?: string;
  last_line?: string;
  components?: {
    city_name?: string;
    state_abbreviation?: string;
    zipcode?: string;
    plus4_code?: string;
  };
  analysis?: {
    dpv_match_code?: string;
    footnotes?: string;
  };
  metadata?: {
    latitude?: number;
    longitude?: number;
  };
};

type EnrichOptions = {
  limit: number;
  batchSize: number;
  sleepMs: number;
  dryRun: boolean;
  withCoordinates: boolean;
  testAuthOnly: boolean;
  states: string[] | null;
};

const PLACEHOLDER_NAMES = new Set([
  'Areas covered',
  'City covered',
  'Counties and cities covered',
  'Counties and city covered',
  'Counties served',
  'Counties covered',
  'Municipalities covered',
  'Parishes covered',
  // Directional/region placeholders (seen in some divisions).
  'North',
  'South',
  'East',
  'West',
  // State placeholders (non-office rows).
  'Iowa',
  'Nebraska',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]): EnrichOptions {
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
  const withCoordinates = argv.includes('--with-coordinates');
  const testAuthOnly = argv.includes('--test-auth');

  const state = getStr('--state=');
  const statesRaw = getStr('--states=');
  const statesList = (statesRaw || state || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const states = statesList.length ? Array.from(new Set(statesList)) : null;

  return {
    limit: getNum('--limit=', 500),
    batchSize: getNum('--batch-size=', 50),
    sleepMs: getNum('--sleep-ms=', 250),
    dryRun,
    withCoordinates,
    testAuthOnly,
    states,
  };
}

function looksLikeSecondary(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.includes('ste') ||
    lower.includes('suite') ||
    lower.includes('unit') ||
    lower.includes('floor') ||
    lower.includes('fl ') ||
    lower.includes('rm') ||
    lower.includes('room') ||
    lower.includes('#') ||
    lower.includes('apt') ||
    lower.includes('bldg')
  );
}

function normalizeZip5(zip: string | null): string | null {
  if (!zip) return null;
  const trimmed = zip.trim();
  const m = trimmed.match(/^(\d{5})(?:-\d{4})?$/);
  return m ? m[1] : null;
}

function zip4FromCandidate(c: SmartyCandidate): string | null {
  const zip = c.components?.zipcode;
  const plus4 = c.components?.plus4_code;
  if (!zip || !plus4) return null;
  if (!/^\d{5}$/.test(zip)) return null;
  if (!/^\d{4}$/.test(plus4)) return null;
  return `${zip}-${plus4}`;
}

function normalizeTextOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length ? v : null;
}

async function resolveDbHost(): Promise<string> {
  const configured = process.env.DB_HOST || 'localhost';
  if (configured === 'shadowcheck_postgres') {
    // Common docker-compose service name; typically not resolvable from host.
    return 'localhost';
  }
  try {
    await dns.lookup(configured);
    return configured;
  } catch {
    return 'localhost';
  }
}

async function loadSecretsManager(): Promise<SecretsManager> {
  // server/src/services/secretsManager.ts is CommonJS-exported (module.exports = instance).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sm = require('../../server/src/services/secretsManager') as SecretsManager;
  if (!sm?.getSecret) {
    throw new Error('Failed to load secretsManager (missing getSecret).');
  }
  return sm;
}

async function fetchSmartyCandidates(
  authId: string,
  authToken: string,
  inputs: Array<{
    id: number;
    street: string;
    secondary?: string;
    city: string;
    state: string;
    zipcode?: string;
  }>
): Promise<SmartyCandidate[]> {
  const url = new URL('https://us-street.api.smarty.com/street-address');
  url.searchParams.set('auth-id', authId);
  url.searchParams.set('auth-token', authToken);

  const body = inputs.map((i) => {
    const payload: Record<string, unknown> = {
      input_id: String(i.id),
      street: i.street,
      city: i.city,
      state: i.state,
      candidates: 1,
    };
    if (i.secondary) payload.secondary = i.secondary;
    if (i.zipcode) payload.zipcode = i.zipcode;
    return payload;
  });

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error(
        [
          'Smarty HTTP 401 (auth failed).',
          'Your stored Smarty credentials were rejected by the US Street API.',
          'Fix:',
          '- Re-enter the Auth ID/Auth Token in Admin -> Configuration -> Smarty, or',
          '- Set via keyring: npx tsx scripts/set-secret.ts smarty_auth_id <value> and smarty_auth_token <value>, or',
          '- Set env vars: SMARTY_AUTH_ID / SMARTY_AUTH_TOKEN.',
          `Response: ${text.slice(0, 200)}`,
        ].join('\n')
      );
    }
    throw new Error(`Smarty HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('Unexpected Smarty response (expected JSON array).');
  }
  return data as SmartyCandidate[];
}

async function enrichZip4(options: EnrichOptions): Promise<void> {
  const secretsManager = await loadSecretsManager();
  const authId = (await secretsManager.getSecret('smarty_auth_id')) || process.env.SMARTY_AUTH_ID;
  const authToken =
    (await secretsManager.getSecret('smarty_auth_token')) || process.env.SMARTY_AUTH_TOKEN;

  if (!authId || !authToken) {
    throw new Error(
      'Smarty credentials not configured. Set via Admin UI or provide SMARTY_AUTH_ID/SMARTY_AUTH_TOKEN.'
    );
  }

  const dbHost = await resolveDbHost();
  const dbUser = process.env.DB_USER || 'shadowcheck_user';
  const dbName = process.env.DB_NAME || 'shadowcheck_db';
  const dbPort = Number(process.env.DB_PORT || 5432);
  const dbPassword = (await secretsManager.getSecret('db_password')) || process.env.DB_PASSWORD;

  if (!dbPassword) {
    throw new Error('Database password not configured (db_password / DB_PASSWORD).');
  }

  const pool = new Pool({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    port: dbPort,
  });

  console.log('📮 Enriching agency_offices postal_code with ZIP+4 via Smarty\n');
  console.log(`  Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Limit: ${options.limit}`);
  console.log(`  Batch size: ${options.batchSize}`);
  console.log(`  Sleep (ms): ${options.sleepMs}`);
  console.log(`  With coordinates: ${options.withCoordinates ? 'yes' : 'no'}`);
  console.log(`  DB: ${dbUser}@${dbHost}:${dbPort}/${dbName}\n`);

  const start = Date.now();

  try {
    if (options.testAuthOnly) {
      console.log('  Test mode: making a single Smarty request (no DB updates)\n');
      await fetchSmartyCandidates(authId, authToken, [
        { id: 0, street: '1 Infinite Loop', city: 'Cupertino', state: 'CA', zipcode: '95014' },
      ]);
      console.log('✅ Smarty auth looks OK for US Street API.');
      return;
    }

    const rowsRes = await pool.query<OfficeRow>(
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
      WHERE NULLIF(BTRIM(address_line1), '') IS NOT NULL
        AND NULLIF(BTRIM(city), '') IS NOT NULL
        AND NULLIF(BTRIM(state), '') IS NOT NULL
        AND ($3::text[] IS NULL OR state = ANY($3::text[]))
        AND (
          -- ZIP+4 enrichment target
          (postal_code IS NULL OR BTRIM(postal_code) = '' OR postal_code ~ '^[0-9]{5}$')
          OR
          -- Coordinate enrichment target (only when requested)
          (
            $2::boolean = true
            AND (latitude IS NULL OR longitude IS NULL OR location IS NULL)
          )
          OR
          -- Normalization target (keeps original address untouched)
          (
            NULLIF(BTRIM(normalized_address_line1), '') IS NULL
            OR NULLIF(BTRIM(normalized_city), '') IS NULL
            OR NULLIF(BTRIM(normalized_state), '') IS NULL
            OR NULLIF(BTRIM(normalized_postal_code), '') IS NULL
          )
        )
      ORDER BY agency, office_type, state, city, name
      LIMIT $1
    `,
      [options.limit, options.withCoordinates, options.states]
    );

    const offices = rowsRes.rows.filter((r) => !PLACEHOLDER_NAMES.has(r.name));
    const zip4Candidates = offices.filter((r) => {
      const pc = (r.postal_code || '').trim();
      return pc === '' || /^\d{5}$/.test(pc);
    });
    console.log(`  Candidate rows (needs ZIP+4 and/or coords): ${offices.length}`);
    console.log(`    ZIP-only or missing ZIP: ${zip4Candidates.length}`);
    console.log(`    Coords requested: ${options.withCoordinates ? 'yes' : 'no'}`);

    if (options.dryRun) {
      console.log('\n  [DRY RUN] No Smarty requests or DB updates performed.');
      return;
    }

    let updated = 0;
    let skipped = 0;
    let noMatch = 0;
    let coordsFilled = 0;
    let normalizedFilled = 0;

    for (let i = 0; i < offices.length; i += options.batchSize) {
      const batch = offices.slice(i, i + options.batchSize);
      const inputs = batch.map((o) => {
        const secondary =
          o.address_line2 && looksLikeSecondary(o.address_line2)
            ? o.address_line2.trim()
            : undefined;
        return {
          id: o.id,
          street: o.address_line1.trim(),
          secondary,
          city: o.city.trim(),
          state: o.state.trim(),
          zipcode: normalizeZip5(o.postal_code),
        };
      });

      const candidates = await fetchSmartyCandidates(authId, authToken, inputs);
      const byId = new Map<string, SmartyCandidate>();
      for (const c of candidates) {
        if (c.input_id) byId.set(c.input_id, c);
      }

      for (const o of batch) {
        const cand = byId.get(String(o.id));
        if (!cand) {
          noMatch += 1;
          continue;
        }

        const zip4 = zip4FromCandidate(cand);
        const normLine1 = normalizeTextOrNull(cand.delivery_line_1);
        const normLine2 = normalizeTextOrNull(cand.delivery_line_2);
        const normCity = normalizeTextOrNull(cand.components?.city_name);
        const normState = normalizeTextOrNull(cand.components?.state_abbreviation);
        const normPostal = zip4 || normalizeTextOrNull(cand.components?.zipcode);
        const dpv = normalizeTextOrNull(cand.analysis?.dpv_match_code);

        const wantCoords =
          options.withCoordinates &&
          (o.latitude === null || o.longitude === null || o.location === null);
        const canProvideCoords =
          typeof cand.metadata?.latitude === 'number' &&
          typeof cand.metadata?.longitude === 'number';
        const lat = canProvideCoords ? (cand.metadata?.latitude ?? null) : null;
        const lon = canProvideCoords ? (cand.metadata?.longitude ?? null) : null;

        const currentZip5 = normalizeZip5(o.postal_code);
        const newZip5 = zip4 ? zip4.slice(0, 5) : null;

        // Guardrail: only apply if current ZIP is empty or matches Smarty ZIP5.
        if (zip4 && currentZip5 && newZip5 && currentZip5 !== newZip5) {
          skipped += 1;
          continue;
        }

        // Keep original address fields untouched. Only fill normalization columns and missing coords.
        const updateRes = await pool.query(
          `
          UPDATE app.agency_offices
          SET
            normalized_address_line1 = CASE
              WHEN NULLIF(BTRIM(normalized_address_line1), '') IS NULL THEN $2::text
              ELSE normalized_address_line1
            END,
            normalized_address_line2 = CASE
              WHEN NULLIF(BTRIM(normalized_address_line2), '') IS NULL THEN $3::text
              ELSE normalized_address_line2
            END,
            normalized_city = CASE
              WHEN NULLIF(BTRIM(normalized_city), '') IS NULL THEN $4::text
              ELSE normalized_city
            END,
            normalized_state = CASE
              WHEN NULLIF(BTRIM(normalized_state), '') IS NULL THEN $5::text
              ELSE normalized_state
            END,
            normalized_postal_code = CASE
              WHEN NULLIF(BTRIM(normalized_postal_code), '') IS NULL THEN $6::text
              ELSE normalized_postal_code
            END,
            address_validation_provider = COALESCE(address_validation_provider, 'smarty_us_street'),
            address_validated_at = NOW(),
            address_validation_dpv_match_code = CASE
              WHEN NULLIF(BTRIM(address_validation_dpv_match_code), '') IS NULL THEN $7::text
              ELSE address_validation_dpv_match_code
            END,
            address_validation_metadata = COALESCE(address_validation_metadata, '{}'::jsonb) || $8::jsonb,
            latitude = CASE
              WHEN $9::boolean = true THEN COALESCE(latitude, $10::double precision)
              ELSE latitude
            END,
            longitude = CASE
              WHEN $9::boolean = true THEN COALESCE(longitude, $11::double precision)
              ELSE longitude
            END,
            location = CASE
              WHEN $9::boolean = false THEN location
              WHEN location IS NOT NULL THEN location
              WHEN $10::double precision IS NULL OR $11::double precision IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint($11::double precision, $10::double precision), 4326)::geography
            END,
            updated_at = NOW()
          WHERE id = $1
            AND (
              (NULLIF(BTRIM(normalized_address_line1), '') IS NULL AND $2::text IS NOT NULL)
              OR (NULLIF(BTRIM(normalized_city), '') IS NULL AND $4::text IS NOT NULL)
              OR (NULLIF(BTRIM(normalized_state), '') IS NULL AND $5::text IS NOT NULL)
              OR (NULLIF(BTRIM(normalized_postal_code), '') IS NULL AND $6::text IS NOT NULL)
              OR ($9::boolean = true AND (latitude IS NULL OR longitude IS NULL OR location IS NULL) AND $10::double precision IS NOT NULL AND $11::double precision IS NOT NULL)
            )
        `,
          [
            o.id,
            normLine1,
            normLine2,
            normCity,
            normState,
            normPostal,
            dpv,
            JSON.stringify({
              dpv_match_code: dpv,
              footnotes: normalizeTextOrNull(cand.analysis?.footnotes),
              last_line: normalizeTextOrNull(cand.last_line),
              // We keep metadata shallow to avoid storing full vendor response blobs.
              has_coords: Boolean(lat !== null && lon !== null),
            }),
            Boolean(wantCoords && canProvideCoords),
            lat,
            lon,
          ]
        );

        if (updateRes.rowCount > 0) {
          updated += 1;
          if (!o.normalized_address_line1 && normLine1) normalizedFilled += 1;
          if (wantCoords && canProvideCoords) coordsFilled += 1;
        } else {
          // Candidate existed, but nothing we were allowed to update.
          skipped += 1;
        }
      }

      process.stdout.write(
        `  Progress: ${Math.min(i + options.batchSize, offices.length)}/${offices.length} (updated=${updated}, no_match=${noMatch}, skipped=${skipped})\r`
      );

      await sleep(options.sleepMs);
    }

    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n');
    console.log(`✅ Done in ${seconds}s`);
    console.log(`  Updated: ${updated}`);
    console.log(`  No match/ZIP+4 missing: ${noMatch}`);
    console.log(`  Skipped (ZIP mismatch or already ZIP+4): ${skipped}`);
    console.log(`  Normalized filled (at least line1): ${normalizedFilled}`);
    console.log(`  Coords filled: ${coordsFilled}`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  enrichZip4(options).catch((err: unknown) => {
    const e = err as Error;
    console.error(`\n❌ ZIP+4 enrichment failed: ${e.message}`);
    process.exit(1);
  });
}

export { enrichZip4 };
