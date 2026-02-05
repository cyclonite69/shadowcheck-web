#!/usr/bin/env tsx
/**
 * FBI Resident Agency official (.gov) address enrichment
 *
 * Loads a curated CSV of resident-agency addresses sourced from official .gov documents
 * and updates app.agency_offices.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createPool } from '../utils/db';

interface GovResidentAgencyRecord {
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
  'fbi_resident_agencies_gov.csv'
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

function loadCsv(filePath: string): GovResidentAgencyRecord[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('CSV does not contain any data rows.');
  }

  const header = parseCsvLine(lines[0]).map((col) => col.toLowerCase());
  const rows: GovResidentAgencyRecord[] = [];

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

async function upsertGovResidentAgency(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }> },
  record: GovResidentAgencyRecord
): Promise<'updated' | 'inserted'> {
  const updateSql = `
    UPDATE app.agency_offices
    SET
      address_line1 = $4::text,
      address_line2 = $5::text,
      city = COALESCE($2::text, city),
      state = COALESCE($3::text, state),
      postal_code = $6::text,
      phone = $7::text,
      parent_office = COALESCE($8::text, parent_office),
      source_url = $9::text,
      source_retrieved_at = $10::timestamp,
      updated_at = NOW()
    WHERE agency = 'FBI'
      AND office_type = 'resident_agency'
      AND name = $1::text
      AND ($2::text IS NULL OR city = $2::text OR city IS NULL)
      AND ($3::text IS NULL OR state = $3::text OR state IS NULL)
      AND ($8::text IS NULL OR parent_office = $8::text)
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

  try {
    await client.query('BEGIN');

    for (const record of records) {
      const result = await upsertGovResidentAgency(client, record);
      if (result === 'updated') {
        updated += 1;
      } else {
        inserted += 1;
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

  console.log(`Official resident agency enrichment complete.`);
  console.log(`Updated: ${updated}`);
  console.log(`Inserted: ${inserted}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
