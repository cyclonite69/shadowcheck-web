#!/usr/bin/env tsx
/**
 * FBI Resident Agency address enrichment (public non-.gov listings)
 *
 * Loads a curated CSV of resident-agency addresses from public listings
 * (e.g., Yelp, MapQuest) and updates app.agency_offices with source_status=unverified.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createPool } from '../utils/db';

interface PublicResidentAgencyRecord {
  name: string;
  city: string | null;
  state: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  phone: string | null;
  parentOffice: string | null;
  sourceUrl: string;
  sourceRetrievedAt: Date;
}

const DEFAULT_CSV_PATH = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'csv',
  'fbi_resident_agencies_public_listings.csv'
);

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function loadCsv(filePath: string): PublicResidentAgencyRecord[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('CSV does not contain any data rows.');
  }

  const header = parseCsvLine(lines[0]).map((col) => col.toLowerCase());
  const rows: PublicResidentAgencyRecord[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};

    header.forEach((key, idx) => {
      row[key] = cols[idx] ?? '';
    });

    rows.push({
      name: row.name,
      city: row.city || null,
      state: row.state || null,
      addressLine1: row.address_line1 || null,
      addressLine2: row.address_line2 || null,
      postalCode: row.postal_code || null,
      phone: row.phone || null,
      parentOffice: row.parent_office || null,
      sourceUrl: row.source_url,
      sourceRetrievedAt: row.source_retrieved_at ? new Date(row.source_retrieved_at) : new Date(),
    });
  }

  return rows;
}

async function upsertPublicResidentAgency(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }> },
  record: PublicResidentAgencyRecord
): Promise<'updated' | 'inserted' | 'skipped'> {
  // Only fill missing contact fields. Do not overwrite existing values.
  // Note: We intentionally do not require city to match; (name,state) is unique in the dataset,
  // and some offices have a physical address in a different city than the one used in the listing.
  const updateSql = `
    UPDATE app.agency_offices
    SET
      address_line1 = CASE
        WHEN NULLIF(BTRIM(address_line1), '') IS NULL THEN NULLIF($4::text, '')
        ELSE address_line1
      END,
      address_line2 = CASE
        WHEN NULLIF(BTRIM(address_line2), '') IS NULL THEN NULLIF($5::text, '')
        ELSE address_line2
      END,
      city = CASE
        WHEN NULLIF(BTRIM(city), '') IS NULL THEN NULLIF($2::text, '')
        ELSE city
      END,
      state = CASE
        WHEN NULLIF(BTRIM(state), '') IS NULL THEN NULLIF($3::text, '')
        ELSE state
      END,
      postal_code = CASE
        WHEN NULLIF(BTRIM(postal_code), '') IS NULL THEN NULLIF($6::text, '')
        ELSE postal_code
      END,
      phone = CASE
        WHEN NULLIF(BTRIM(phone), '') IS NULL THEN NULLIF($7::text, '')
        ELSE phone
      END,
      parent_office = CASE
        WHEN NULLIF(BTRIM(parent_office), '') IS NULL THEN NULLIF($8::text, '')
        ELSE parent_office
      END,
      -- Preserve the existing official link (usually from fbi-offices.ts) before overwriting provenance.
      website = CASE
        WHEN NULLIF(BTRIM(website), '') IS NULL THEN source_url
        ELSE website
      END,
      source_url = $9::text,
      source_retrieved_at = $10::timestamp,
      source_status = 'unverified',
      updated_at = NOW()
    WHERE agency = 'FBI'
      AND office_type = 'resident_agency'
      AND name = $1::text
      AND ($3::text IS NULL OR state = $3::text OR state IS NULL)
      AND ($8::text IS NULL OR parent_office = $8::text)
      AND (
        (NULLIF(BTRIM(address_line1), '') IS NULL AND NULLIF($4::text, '') IS NOT NULL)
        OR (NULLIF(BTRIM(address_line2), '') IS NULL AND NULLIF($5::text, '') IS NOT NULL)
        OR (NULLIF(BTRIM(postal_code), '') IS NULL AND NULLIF($6::text, '') IS NOT NULL)
        OR (NULLIF(BTRIM(phone), '') IS NULL AND NULLIF($7::text, '') IS NOT NULL)
      )
  `;

  const updateResult = await client.query(updateSql, [
    record.name,
    record.city,
    record.state,
    record.addressLine1,
    record.addressLine2,
    record.postalCode,
    record.phone,
    record.parentOffice,
    record.sourceUrl,
    record.sourceRetrievedAt,
  ]);

  if (updateResult.rowCount > 0) {
    return 'updated';
  }

  // If the office already exists but didn't need enrichment, treat as a no-op.
  const existsSql = `
    SELECT 1
    FROM app.agency_offices
    WHERE agency = 'FBI'
      AND office_type = 'resident_agency'
      AND name = $1::text
      AND ($3::text IS NULL OR state = $3::text OR state IS NULL)
      AND ($8::text IS NULL OR parent_office = $8::text)
    LIMIT 1
  `;
  const existsResult = await client.query(existsSql, [
    record.name,
    record.city,
    record.state,
    record.addressLine1,
    record.addressLine2,
    record.postalCode,
    record.phone,
    record.parentOffice,
  ]);

  if (existsResult.rowCount > 0) {
    return 'skipped';
  }

  const insertSql = `
    INSERT INTO app.agency_offices (
      agency,
      office_type,
      name,
      parent_office,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      phone,
      source_url,
      source_retrieved_at,
      source_status,
      updated_at
    ) VALUES (
      'FBI',
      'resident_agency',
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      'unverified',
      NOW()
    )
  `;

  await client.query(insertSql, [
    record.name,
    record.parentOffice,
    record.addressLine1,
    record.addressLine2,
    record.city,
    record.state,
    record.postalCode,
    record.phone,
    record.sourceUrl,
    record.sourceRetrievedAt,
  ]);

  return 'inserted';
}

async function main(): Promise<void> {
  const csvPath =
    process.argv.find((arg) => arg.startsWith('--csv='))?.split('=')[1] || DEFAULT_CSV_PATH;
  const records = loadCsv(csvPath);

  const pool = createPool();
  const client = await pool.connect();

  let updated = 0;
  let inserted = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    for (const record of records) {
      const result = await upsertPublicResidentAgency(client, record);
      if (result === 'updated') {
        updated += 1;
      } else if (result === 'inserted') {
        inserted += 1;
      } else {
        skipped += 1;
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`Public listing resident agency enrichment complete.`);
  console.log(`Updated: ${updated}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped: ${skipped}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
