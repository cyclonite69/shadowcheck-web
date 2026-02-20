#!/usr/bin/env tsx
/**
 * Repair: populate app.networks from SQLite for BSSIDs that are in
 * access_points but missing from networks (caused by upsertNetworks()
 * not being called during incremental import).
 *
 * Usage:
 *   DB_ADMIN_PASSWORD=xxx npx tsx etl/repair/repair-missing-networks.ts <sqlite_file>
 */

import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';

const sqliteFile = process.argv[2];
if (!sqliteFile || !fs.existsSync(sqliteFile)) {
  console.error(`Usage: tsx repair-missing-networks.ts <sqlite_file>`);
  process.exit(1);
}

const pool = new Pool({
  user: process.env.DB_ADMIN_USER || 'shadowcheck_admin',
  password: process.env.DB_ADMIN_PASSWORD,
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'shadowcheck_db',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

console.log('\n🔧 REPAIR: populate app.networks from SQLite');
console.log('━'.repeat(60));

// Find BSSIDs in access_points but missing from networks
const { rows: missing } = await pool.query<{ bssid: string }>(
  `SELECT ap.bssid FROM app.access_points ap
   WHERE NOT EXISTS (SELECT 1 FROM app.networks n WHERE n.bssid = ap.bssid)`
);
console.log(`Found ${missing.length} BSSIDs in access_points but missing from networks`);

if (missing.length === 0) {
  console.log('✅ Nothing to repair.');
  await pool.end();
  process.exit(0);
}

const missingSet = new Set(missing.map((r) => r.bssid));

// Load all network metadata from SQLite
const rows = await new Promise<any[]>((resolve, reject) => {
  const db = new (sqlite3.verbose().Database)(sqliteFile, sqlite3.OPEN_READONLY);
  db.all(
    `SELECT UPPER(bssid) as bssid, ssid, type, frequency, capabilities,
            service, rcois, mfgrid, lasttime as lasttime_ms,
            lastlat, lastlon, bestlevel, bestlat, bestlon
     FROM network`,
    (err: Error | null, rows: any[]) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    }
  );
});

// Filter to only missing BSSIDs
const toUpsert = rows.filter((r) => missingSet.has(r.bssid));
console.log(`Found ${toUpsert.length} of those in SQLite network table`);

const cleanStr = (s: string | null | undefined) => {
  if (!s) return '';
  return s.replace(/\x00/g, '').trim();
};

let ok = 0;
let fail = 0;

for (const n of toUpsert) {
  try {
    await pool.query(
      `INSERT INTO app.networks
         (bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
          lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (bssid) DO UPDATE SET
         ssid       = COALESCE(NULLIF(EXCLUDED.ssid, ''), app.networks.ssid),
         frequency  = COALESCE(NULLIF(EXCLUDED.frequency, 0), app.networks.frequency),
         bestlevel  = GREATEST(EXCLUDED.bestlevel, app.networks.bestlevel),
         lasttime_ms = GREATEST(EXCLUDED.lasttime_ms, app.networks.lasttime_ms),
         lastlat    = CASE WHEN EXCLUDED.lasttime_ms > app.networks.lasttime_ms THEN EXCLUDED.lastlat ELSE app.networks.lastlat END,
         lastlon    = CASE WHEN EXCLUDED.lasttime_ms > app.networks.lasttime_ms THEN EXCLUDED.lastlon ELSE app.networks.lastlon END`,
      [
        n.bssid,
        cleanStr(n.ssid),
        n.type || 'W',
        n.frequency || 0,
        cleanStr(n.capabilities),
        cleanStr(n.service),
        cleanStr(n.rcois),
        n.mfgrid || 0,
        n.lasttime_ms || 0,
        n.lastlat || 0,
        n.lastlon || 0,
        n.bestlevel || 0,
        n.bestlat || 0,
        n.bestlon || 0,
      ]
    );
    ok++;
  } catch (e: any) {
    fail++;
    if (process.env.DEBUG === 'true') console.error(`  Failed ${n.bssid}: ${e.message}`);
  }
}

console.log(`\n✅ Upserted: ${ok}  ❌ Failed: ${fail}`);

// Refresh materialized views
console.log('\n🔄 Refreshing materialized views...');
try {
  await pool.query('SELECT * FROM app.refresh_all_materialized_views()');
  console.log('✅ MVs refreshed');
} catch (e: any) {
  console.warn(`⚠️  MV refresh failed: ${e.message}`);
}

await pool.end();
console.log('━'.repeat(60));
