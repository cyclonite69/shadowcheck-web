#!/usr/bin/env tsx
/**
 * Normalize phone numbers in app.agency_offices without overwriting the original phone field.
 *
 * Fills:
 * - phone_digits: digits-only extraction of phone
 * - normalized_phone: 10-digit US national number (XXXXXXXXXX) when parseable
 * - normalized_phone_display: (XXX) XXX-XXXX when the phone looks like a US 10-digit number
 *
 * Usage:
 *   # Dry run (no DB writes)
 *   npx tsx etl/transform/normalize-agency-offices-phone.ts --dry-run
 *
 *   # Live run (writes normalized columns)
 *   npx tsx etl/transform/normalize-agency-offices-phone.ts --live
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import dns from 'dns/promises';

dotenv.config();

type SecretsManager = {
  getSecret: (name: string) => Promise<string | null>;
};

function parseArgs(argv: string[]): { dryRun: boolean } {
  const dryRun = argv.includes('--dry-run') || !argv.includes('--live');
  return { dryRun };
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

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const secretsManager = require('../../server/src/services/secretsManager') as SecretsManager;

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

  console.log('☎️  Normalizing agency_offices phone numbers\n');
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  DB: ${dbUser}@${dbHost}:${dbPort}/${dbName}\n`);

  try {
    const candidatesRes = await pool.query<{ count: string }>(`
      WITH src AS (
        SELECT
          id,
          phone,
          regexp_replace(phone, '[^0-9]', '', 'g') AS digits
        FROM app.agency_offices
        WHERE NULLIF(BTRIM(phone), '') IS NOT NULL
      ),
      norm AS (
        SELECT
          id,
          digits,
          CASE
            WHEN length(digits) = 10 THEN digits
            WHEN length(digits) = 11 AND left(digits, 1) = '1' THEN substring(digits from 2 for 10)
            ELSE NULL
          END AS d10
        FROM src
      )
      SELECT COUNT(*)::text AS count
      FROM app.agency_offices ao
      JOIN norm ON norm.id = ao.id
      WHERE
        ao.phone_digits IS DISTINCT FROM norm.digits
        OR (norm.d10 IS NOT NULL AND ao.normalized_phone IS DISTINCT FROM norm.d10)
        OR (norm.d10 IS NOT NULL AND NULLIF(BTRIM(ao.normalized_phone_display), '') IS NULL)
    `);

    const candidates = Number(candidatesRes.rows[0]?.count || '0');
    console.log(`  Candidate rows: ${candidates}`);

    if (dryRun) {
      const sample = await pool.query(
        `
        SELECT
          id,
          phone,
          regexp_replace(phone, '[^0-9]', '', 'g') AS phone_digits,
          CASE
            WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10 THEN regexp_replace(phone, '[^0-9]', '', 'g')
            WHEN length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11 AND left(regexp_replace(phone, '[^0-9]', '', 'g'), 1) = '1'
              THEN substring(regexp_replace(phone, '[^0-9]', '', 'g') from 2 for 10)
            ELSE NULL
          END AS normalized_phone
        FROM app.agency_offices
        WHERE NULLIF(BTRIM(phone), '') IS NOT NULL
        ORDER BY id
        LIMIT 10
      `
      );
      console.log('\n  Sample (first 10):');
      for (const r of sample.rows as any[]) {
        console.log(
          `    id=${r.id} phone=${JSON.stringify(r.phone)} -> digits=${r.phone_digits} normalized=${r.normalized_phone}`
        );
      }
      console.log('\n  [DRY RUN] No DB updates performed.');
      return;
    }

    const updateRes = await pool.query<{ rowCount: number }>(`
      WITH src AS (
        SELECT
          id,
          regexp_replace(phone, '[^0-9]', '', 'g') AS digits
        FROM app.agency_offices
        WHERE NULLIF(BTRIM(phone), '') IS NOT NULL
      ),
      norm AS (
        SELECT
          id,
          digits,
          CASE
            WHEN length(digits) = 10 THEN digits
            WHEN length(digits) = 11 AND left(digits, 1) = '1' THEN substring(digits from 2 for 10)
            ELSE NULL
          END AS d10
        FROM src
      )
      UPDATE app.agency_offices ao
      SET
        -- phone_digits is derived; always keep it in sync with phone.
        phone_digits = norm.digits,
        normalized_phone = CASE
          WHEN norm.d10 IS NULL THEN ao.normalized_phone
          ELSE norm.d10
        END,
        normalized_phone_display = CASE
          WHEN norm.d10 IS NULL THEN ao.normalized_phone_display
          WHEN NULLIF(BTRIM(ao.normalized_phone_display), '') IS NULL THEN
            '(' || substring(norm.d10 from 1 for 3) || ') ' ||
            substring(norm.d10 from 4 for 3) || '-' ||
            substring(norm.d10 from 7 for 4)
          ELSE ao.normalized_phone_display
        END,
        updated_at = NOW()
      FROM norm
      WHERE ao.id = norm.id
        AND (
          (ao.phone_digits IS DISTINCT FROM norm.digits)
          OR (norm.d10 IS NOT NULL AND ao.normalized_phone IS DISTINCT FROM norm.d10)
          OR (NULLIF(BTRIM(ao.normalized_phone_display), '') IS NULL AND norm.d10 IS NOT NULL)
        )
    `);

    // pg doesn't expose UPDATE rowCount via typed query above in all drivers; run a follow-up count.
    const filledRes = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM app.agency_offices
      WHERE NULLIF(BTRIM(phone), '') IS NOT NULL
        AND NULLIF(BTRIM(normalized_phone), '') IS NOT NULL
    `);

    console.log(`\n✅ Normalization applied.`);
    console.log(`  Updated rows: ${updateRes.rowCount}`);
    console.log(`  Rows with phone + normalized_phone: ${Number(filledRes.rows[0]?.count || '0')}`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ Phone normalization failed: ${e?.message || String(e)}`);
    process.exit(1);
  });
}
