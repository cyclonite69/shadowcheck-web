#!/usr/bin/env tsx
/**
 * Repair: populate app.networks from SQLite for BSSIDs that are in
 * observations but missing from networks.
 *
 * Usage:
 *   DB_ADMIN_PASSWORD=xxx npx tsx etl/repair/repair-missing-networks.ts <sqlite_file>
 */

import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import { createPool } from '../utils/db';

const sqliteFile = process.argv[2];
if (!sqliteFile || !fs.existsSync(sqliteFile)) {
  console.error('Usage: tsx repair-missing-networks.ts <sqlite_file>');
  process.exit(1);
}

const pool = createPool();

const cleanStr = (s: string | null | undefined) => {
  if (!s) {
    return '';
  }
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x00/g, '').trim();
};

async function main() {
  console.log('\n🔧 REPAIR: populate app.networks from SQLite');
  console.log('━'.repeat(60));

  // Find BSSIDs in observations but missing from networks
  const { rows: missing } = await pool.query<{ bssid: string }>(
    `SELECT DISTINCT o.bssid
     FROM app.observations o
     WHERE o.bssid IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM app.networks n WHERE n.bssid = o.bssid)`
  );
  console.log(`Found ${missing.length} BSSIDs in observations but missing from networks`);

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
              lastlat, lastlon
       FROM network`,
      (err: Error | null, rows: any[]) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });

  // Filter to only missing BSSIDs
  const toUpsert = rows.filter((r) => missingSet.has(r.bssid));
  console.log(`Found ${toUpsert.length} of those in SQLite network table`);

  let ok = 0;
  let fail = 0;

  for (const n of toUpsert) {
    try {
      await pool.query(
        `INSERT INTO app.networks
           (bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
            lasttime_ms, lastlat, lastlon)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (bssid) DO UPDATE SET
           ssid       = COALESCE(NULLIF(EXCLUDED.ssid, ''), app.networks.ssid),
           frequency  = COALESCE(NULLIF(EXCLUDED.frequency, 0), app.networks.frequency),
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
        ]
      );
      ok++;
    } catch (e: any) {
      fail++;
      if (process.env.DEBUG === 'true') {
        console.error(`  Failed ${n.bssid}: ${e.message}`);
      }
    }
  }

  console.log(`\n✅ Upserted: ${ok}  ❌ Failed: ${fail}`);

  // Recompute best positions from core observations only
  console.log('\n📍 Recomputing best positions from core observations...');
  const recompResult = await pool.query(`
    UPDATE app.networks n SET
      bestlevel = sub.bestlevel,
      bestlat = sub.bestlat,
      bestlon = sub.bestlon
    FROM (
      SELECT DISTINCT ON (bssid)
        bssid,
        level AS bestlevel,
        lat AS bestlat,
        lon AS bestlon
      FROM app.observations
      WHERE lat IS NOT NULL AND lon IS NOT NULL
        AND lat != 0 AND lon != 0
      ORDER BY bssid, level DESC NULLS LAST, time DESC NULLS LAST
    ) sub
    WHERE n.bssid = sub.bssid
      AND (n.bestlat IS DISTINCT FROM sub.bestlat
        OR n.bestlon IS DISTINCT FROM sub.bestlon
        OR n.bestlevel IS DISTINCT FROM sub.bestlevel)
  `);
  console.log(`   Updated ${recompResult.rowCount?.toLocaleString() || 0} network(s)`);

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
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
