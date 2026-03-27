#!/usr/bin/env tsx
import { Pool, QueryResult } from 'pg';
import * as fs from 'fs';
import '../loadEnv';

interface LocationRow {
  bssid: string;
  ssid: string | null;
  lat: number;
  lon: number;
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function exportMissingGeocodes(): Promise<void> {
  const query = `
    SELECT DISTINCT
      bssid,
      ssid,
      lat,
      lon
    FROM app.locations_legacy
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    LIMIT 10000;
  `;

  const result: QueryResult<LocationRow> = await pool.query(query);

  const csv = ['lat,lon,bssid,ssid'];
  result.rows.forEach((row) => {
    csv.push(`${row.lat},${row.lon},${row.bssid},${row.ssid || ''}`);
  });

  fs.writeFileSync('locations_to_reverse_geocode.csv', csv.join('\n'));
  console.log(`✓ Exported ${result.rows.length} locations to locations_to_reverse_geocode.csv`);

  await pool.end();
}

exportMissingGeocodes().catch(console.error);
