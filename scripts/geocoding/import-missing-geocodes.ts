#!/usr/bin/env tsx
import * as fs from 'fs';
import { Pool } from 'pg';
import '../loadEnv';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main(): Promise<void> {
  const data = fs.readFileSync('missing_geocodes_result.csv', 'utf8');
  const lines = data.trim().split('\n').slice(1);

  let updated = 0;
  for (const line of lines) {
    const match = line.match(/^(\d+),([^,]+),([^,]+),"?([^"]*)"?$/);
    if (!match) {
      continue;
    }

    const [, id, _lat, _lon, address] = match;
    if (!address) {
      continue;
    }

    await pool.query(
      "UPDATE app.locations_legacy SET geocoded_address = $1, geocoded_at = NOW(), geocode_source = 'mapbox_reverse' WHERE _id = $2",
      [address, id]
    );
    updated++;
  }

  console.log(`✓ Updated ${updated} addresses`);
  await pool.end();
}

main().catch(console.error);
