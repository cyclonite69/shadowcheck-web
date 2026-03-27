#!/usr/bin/env tsx
/**
 * WiGLE SQLite → PostgreSQL importer
 *
 * Only imports observations newer than the latest timestamp already in the database.
 * Matches the actual app.observations schema.
 *
 * Usage:
 *   npx tsx etl/load/sqlite-import.ts <sqlite_file> [source_tag]
 *
 * Example:
 *   npx tsx etl/load/sqlite-import.ts ~/Downloads/backup.sqlite s22_new
 */

import * as fs from 'fs';
import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import '../loadEnv';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface Config {
  BATCH_SIZE: number;
  DEBUG: boolean;
  DB_CONFIG: {
    user: string;
    password?: string;
    host: string;
    database: string;
    port: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
}

interface SqliteLocationRow {
  _id: number;
  bssid: string;
  level: number;
  lat: number;
  lon: number;
  altitude: number;
  accuracy: number;
  time: number; // milliseconds since epoch
  external: number;
  mfgrid: number;
}

interface SqliteNetworkRow {
  bssid: string;
  ssid: string;
  frequency: number;
  capabilities: string;
  lasttime: number;
  lastlat: number;
  lastlon: number;
  type: string;
  bestlevel: number;
  bestlat: number;
  bestlon: number;
  rcois: string;
  mfgrid: number;
  service: string;
}

interface ValidatedObservation {
  source_pk: string;
  device_id: string;
  bssid: string;
  ssid: string | null;
  radio_type: string | null;
  radio_frequency: number | null;
  radio_capabilities: string | null;
  radio_service: string | null;
  radio_rcois: string | null;
  radio_lasttime_ms: number | null;
  level: number;
  lat: number;
  lon: number;
  altitude: number;
  accuracy: number;
  time: Date;
  time_ms: number;
  observed_at_ms: number;
  external: boolean;
  mfgrid: number;
  source_tag: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: Config = {
  BATCH_SIZE: parseInt(process.env.IMPORT_BATCH_SIZE || '500', 10),
  DEBUG: process.env.DEBUG === 'true',
  DB_CONFIG: {
    user: process.env.DB_ADMIN_USER || 'shadowcheck_admin',
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'shadowcheck_db',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
};

// ============================================================================
// INCREMENTAL IMPORTER
// ============================================================================

class IncrementalImporter {
  private sqliteFile: string;
  private sourceTag: string;
  private pool: Pool;
  private networkCache: Map<string, SqliteNetworkRow> = new Map();

  private totalInSqlite = 0;
  private alreadyImported = 0;
  private toImport = 0;
  private imported = 0;
  private failed = 0;
  private errors: string[] = [];
  private startTime: number;
  private latestTimeMs = 0;

  constructor(sqliteFile: string, sourceTag: string) {
    this.sqliteFile = sqliteFile;
    this.sourceTag = sourceTag;
    this.pool = new Pool(CONFIG.DB_CONFIG);
    this.startTime = Date.now();
  }

  async start(): Promise<void> {
    console.log('\n📦 INCREMENTAL IMPORT - WiGLE SQLite');
    console.log('━'.repeat(60));
    console.log(`📁 Source: ${this.sqliteFile}`);
    console.log(`🏷️  Source tag: ${this.sourceTag}`);
    console.log(`📦 Batch size: ${CONFIG.BATCH_SIZE}`);
    console.log(`🐛 Debug: ${CONFIG.DEBUG ? 'ON' : 'OFF'}\n`);

    try {
      // 1. Validate files and connections
      await this.validateInputs();

      // 2. Get latest imported timestamp from database
      await this.getLatestImportedTime();

      // 3. Count records to import
      await this.countRecords();

      if (this.toImport === 0) {
        console.log('\n✅ Database is up to date - no new records to import.');
        return;
      }

      // 4. Load network metadata cache from SQLite
      await this.loadNetworkCache();

      // 5. Ensure device_source exists (FK constraint)
      await this.ensureDeviceSource();

      // 6. Upsert access_points FIRST (FK constraint)
      await this.upsertAccessPoints();

      // 7. Upsert networks (rich metadata for MV/UI)
      await this.upsertNetworks();

      // 8. Import new observations
      await this.importNewObservations();

      // 9. Backfill any missing network rows from newly imported observations.
      await this.backfillMissingNetworksFromObservations();

      // 10. Remove orphan networks (no access_points entry — no coords, no SSID)
      await this.pruneOrphanNetworks();

      // 11. Refresh materialized views
      await this.refreshMaterializedViews();

      // 12. Print summary
      this.printSummary();
    } catch (error) {
      const err = error as Error;
      console.error('\n❌ IMPORT FAILED:', err.message);
      if (CONFIG.DEBUG) {
        console.error('Stack trace:', err.stack);
      }
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }

  private async validateInputs(): Promise<void> {
    console.log('🔍 Validating inputs...');

    // Check SQLite file exists
    if (!fs.existsSync(this.sqliteFile)) {
      throw new Error(`SQLite file not found: ${this.sqliteFile}`);
    }

    // Validate source tag
    if (!this.sourceTag || !/^[a-zA-Z0-9_-]+$/.test(this.sourceTag)) {
      throw new Error('Source tag must be alphanumeric with underscores/hyphens only');
    }

    // Test PostgreSQL connection
    try {
      const result = await this.pool.query('SELECT NOW() as now, current_user as user');
      console.log(`✅ PostgreSQL connected as ${result.rows[0].user}`);
    } catch (error) {
      const err = error as Error;
      throw new Error(`PostgreSQL connection failed: ${err.message}`);
    }

    // Verify SQLite has location table
    await new Promise<void>((resolve, reject) => {
      const db = new (sqlite3.verbose().Database)(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.get(
        'SELECT COUNT(*) as count FROM sqlite_master WHERE type="table" AND name="location"',
        (err: Error | null, row: { count: number }) => {
          db.close();
          if (err) {
            reject(new Error(`SQLite error: ${err.message}`));
          } else if (row.count === 0) {
            reject(new Error('SQLite database missing "location" table'));
          } else {
            console.log('✅ SQLite schema validated');
            resolve();
          }
        }
      );
    });
  }

  private async getLatestImportedTime(): Promise<void> {
    console.log(`\n🔍 Checking latest import for source_tag='${this.sourceTag}'...`);

    const result = await this.pool.query(
      'SELECT COALESCE(MAX(time_ms), 0) as latest_ms FROM app.observations WHERE source_tag = $1',
      [this.sourceTag]
    );

    this.latestTimeMs = parseInt(result.rows[0].latest_ms, 10) || 0;

    if (this.latestTimeMs > 0) {
      const latestDate = new Date(this.latestTimeMs);
      console.log(`   Latest imported: ${latestDate.toISOString()} (${this.latestTimeMs})`);
    } else {
      console.log('   No existing records - will import all');
    }
  }

  private async countRecords(): Promise<void> {
    console.log('\n📊 Counting records...');

    // Count total in SQLite
    this.totalInSqlite = await new Promise<number>((resolve, reject) => {
      const db = new (sqlite3.verbose().Database)(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.get(
        'SELECT COUNT(*) as count FROM location',
        (err: Error | null, row: { count: number }) => {
          db.close();
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Count already imported (time <= latestTimeMs)
    this.alreadyImported = await new Promise<number>((resolve, reject) => {
      const db = new (sqlite3.verbose().Database)(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.get(
        'SELECT COUNT(*) as count FROM location WHERE time <= ?',
        [this.latestTimeMs],
        (err: Error | null, row: { count: number }) => {
          db.close();
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    this.toImport = this.totalInSqlite - this.alreadyImported;

    console.log(`   Total in SQLite: ${this.totalInSqlite.toLocaleString()}`);
    console.log(`   Already imported: ${this.alreadyImported.toLocaleString()}`);
    console.log(`   New to import: ${this.toImport.toLocaleString()}`);
  }

  private async loadNetworkCache(): Promise<void> {
    console.log('\n📡 Loading network metadata...');

    await new Promise<void>((resolve, reject) => {
      const db = new (sqlite3.verbose().Database)(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.all('SELECT * FROM network', (err: Error | null, rows: SqliteNetworkRow[]) => {
        db.close();
        if (err) {
          reject(err);
          return;
        }

        for (const row of rows) {
          this.networkCache.set(row.bssid.toUpperCase(), row);
        }
        console.log(`   Loaded ${this.networkCache.size.toLocaleString()} networks`);
        resolve();
      });
    });
  }

  private async importNewObservations(): Promise<void> {
    console.log('\n⚡ Importing new observations...');

    // Fetch all new records at once (db.each with async doesn't work correctly)
    const rows = await new Promise<SqliteLocationRow[]>((resolve, reject) => {
      const db = new (sqlite3.verbose().Database)(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.all(
        `SELECT * FROM location WHERE time > ? ORDER BY time ASC`,
        [this.latestTimeMs],
        (err: Error | null, rows: SqliteLocationRow[]) => {
          db.close();
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    console.log(`   Fetched ${rows.length.toLocaleString()} records from SQLite`);

    const startTime = Date.now();
    let batch: ValidatedObservation[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validated = this.validateAndEnrich(row);

      if (!validated) {
        this.failed++;
        continue;
      }

      batch.push(validated);

      if (batch.length >= CONFIG.BATCH_SIZE) {
        try {
          await this.insertBatch(batch);
          this.imported += batch.length;
        } catch (error) {
          const e = error as Error;
          this.failed += batch.length;
          this.errors.push(`Batch insert error: ${e.message}`);
          if (CONFIG.DEBUG) {
            console.error(`\n   Batch error: ${e.message}`);
          }
        }
        batch = [];

        // Progress update
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? Math.round(this.imported / elapsed) : 0;
        const percent = Math.round(((i + 1) / rows.length) * 100);
        process.stdout.write(
          `\r   Progress: ${this.imported.toLocaleString()}/${rows.length.toLocaleString()} (${percent}%) | ${speed.toLocaleString()} rec/s`
        );
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      try {
        await this.insertBatch(batch);
        this.imported += batch.length;
      } catch (error) {
        const e = error as Error;
        this.failed += batch.length;
        this.errors.push(`Final batch error: ${e.message}`);
      }
    }

    console.log(''); // newline after progress
  }

  private validateAndEnrich(row: SqliteLocationRow): ValidatedObservation | null {
    // Validate coordinates
    if (
      typeof row.lat !== 'number' ||
      typeof row.lon !== 'number' ||
      row.lat < -90 ||
      row.lat > 90 ||
      row.lon < -180 ||
      row.lon > 180 ||
      !isFinite(row.lat) ||
      !isFinite(row.lon)
    ) {
      return null;
    }

    // Validate time (after Jan 1, 2000)
    const MIN_TIMESTAMP = 946684800000;
    if (typeof row.time !== 'number' || row.time < MIN_TIMESTAMP) {
      return null;
    }

    // Get network metadata
    const bssid = row.bssid.toUpperCase();
    const network = this.networkCache.get(bssid);

    // Strip null bytes from strings (WiGLE uses \x00 for hidden networks)
    const cleanString = (s: string | null | undefined): string | null => {
      if (!s) return null;
      const cleaned = s.replace(/\x00/g, '').trim();
      return cleaned || null;
    };

    return {
      source_pk: String(row._id),
      device_id: this.sourceTag, // Use source tag as device ID
      bssid: bssid,
      ssid: cleanString(network?.ssid),
      radio_type: network?.type || 'W',
      radio_frequency: network?.frequency || null,
      radio_capabilities: cleanString(network?.capabilities),
      radio_service: cleanString(network?.service),
      radio_rcois: cleanString(network?.rcois),
      radio_lasttime_ms: network?.lasttime || null,
      level: row.level,
      lat: row.lat,
      lon: row.lon,
      altitude: row.altitude || 0,
      accuracy: row.accuracy || 0,
      time: new Date(row.time),
      time_ms: row.time,
      observed_at_ms: row.time,
      external: row.external === 1,
      mfgrid: row.mfgrid || 0,
      source_tag: this.sourceTag,
    };
  }

  private async insertBatch(records: ValidatedObservation[]): Promise<void> {
    if (records.length === 0) return;

    const values: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const r of records) {
      values.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, ` +
          `$${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 11}, $${idx + 12}, $${idx + 13}, ` +
          `$${idx + 14}, $${idx + 15}, $${idx + 16}, $${idx + 17}, $${idx + 18}, $${idx + 19}, $${idx + 20}, ` +
          `ST_SetSRID(ST_MakePoint($${idx + 12}, $${idx + 11}), 4326))`
      );

      params.push(
        r.device_id,
        r.bssid,
        r.ssid,
        r.radio_type,
        r.radio_frequency,
        r.radio_capabilities,
        r.radio_service,
        r.radio_rcois,
        r.radio_lasttime_ms,
        r.level,
        r.lat,
        r.lon,
        r.altitude,
        r.accuracy,
        r.time,
        r.observed_at_ms,
        r.external,
        r.mfgrid,
        r.source_tag,
        r.source_pk,
        r.time_ms
      );

      idx += 21;
    }

    const sql = `
      INSERT INTO app.observations (
        device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities,
        radio_service, radio_rcois, radio_lasttime_ms, level, lat, lon, altitude,
        accuracy, time, observed_at_ms, external, mfgrid, source_tag, source_pk, time_ms, geom
      )
      VALUES ${values.join(', ')}
      ON CONFLICT (device_id, source_pk, bssid, level, lat, lon, altitude, accuracy, observed_at_ms, external, mfgrid) DO NOTHING
    `;

    await this.pool.query(sql, params);
  }

  private async ensureDeviceSource(): Promise<void> {
    console.log('\n📱 Ensuring device source exists...');

    await this.pool.query(
      `
      INSERT INTO app.device_sources (code, label)
      VALUES ($1, $2)
      ON CONFLICT (code) DO NOTHING
      `,
      [this.sourceTag, `WiGLE Import: ${this.sourceTag}`]
    );

    console.log(`   Device source '${this.sourceTag}' ready`);
  }

  private async upsertAccessPoints(): Promise<void> {
    console.log('\n📡 Upserting access points (before observations for FK constraint)...');

    // Get unique BSSIDs from NEW SQLite records
    const bssids = await new Promise<string[]>((resolve, reject) => {
      const db = new (sqlite3.verbose().Database)(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.all(
        `SELECT DISTINCT UPPER(bssid) as bssid FROM location WHERE time > ?`,
        [this.latestTimeMs],
        (err: Error | null, rows: { bssid: string }[]) => {
          db.close();
          if (err) reject(err);
          else resolve(rows.map((r) => r.bssid));
        }
      );
    });

    console.log(`   Found ${bssids.length.toLocaleString()} unique BSSIDs`);

    // Strip null bytes from strings
    const cleanString = (s: string | null | undefined): string | null => {
      if (!s) return null;
      const cleaned = s.replace(/\x00/g, '').trim();
      return cleaned || null;
    };

    let upserted = 0;

    for (const bssid of bssids) {
      const network = this.networkCache.get(bssid);

      try {
        await this.pool.query(
          `
          INSERT INTO app.access_points (bssid, latest_ssid, first_seen, last_seen, total_observations)
          VALUES ($1, $2, NOW(), NOW(), 0)
          ON CONFLICT (bssid) DO UPDATE SET
            latest_ssid = COALESCE(NULLIF(EXCLUDED.latest_ssid, ''), app.access_points.latest_ssid),
            last_seen = GREATEST(EXCLUDED.last_seen, app.access_points.last_seen)
          `,
          [bssid, cleanString(network?.ssid) || null]
        );
        upserted++;
      } catch (error) {
        if (CONFIG.DEBUG) {
          const e = error as Error;
          console.error(`   Access point upsert failed for ${bssid}: ${e.message}`);
        }
      }
    }

    console.log(`   Upserted ${upserted.toLocaleString()} access points`);
  }

  private async upsertNetworks(): Promise<void> {
    console.log('\n📡 Upserting networks...');

    // Get unique BSSIDs from NEW SQLite records (not from DB)
    const bssids = await new Promise<string[]>((resolve, reject) => {
      const db = new (sqlite3.verbose().Database)(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.all(
        `SELECT DISTINCT UPPER(bssid) as bssid FROM location WHERE time > ?`,
        [this.latestTimeMs],
        (err: Error | null, rows: { bssid: string }[]) => {
          db.close();
          if (err) reject(err);
          else resolve(rows.map((r) => r.bssid));
        }
      );
    });

    console.log(`   Found ${bssids.length.toLocaleString()} unique BSSIDs to upsert`);

    // Strip null bytes from strings
    const cleanString = (s: string | null | undefined): string | null => {
      if (!s) return null;
      const cleaned = s.replace(/\x00/g, '').trim();
      return cleaned || null;
    };

    let upserted = 0;
    let skipped = 0;

    for (const bssid of bssids) {
      const network = this.networkCache.get(bssid);
      if (!network) {
        skipped++;
        continue;
      }

      try {
        await this.pool.query(
          `
          INSERT INTO app.networks (
            bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
            lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (bssid) DO UPDATE SET
            ssid = COALESCE(NULLIF(EXCLUDED.ssid, ''), app.networks.ssid),
            frequency = COALESCE(NULLIF(EXCLUDED.frequency, 0), app.networks.frequency),
            bestlevel = GREATEST(EXCLUDED.bestlevel, app.networks.bestlevel),
            lasttime_ms = GREATEST(EXCLUDED.lasttime_ms, app.networks.lasttime_ms),
            lastlat = CASE WHEN EXCLUDED.lasttime_ms > app.networks.lasttime_ms THEN EXCLUDED.lastlat ELSE app.networks.lastlat END,
            lastlon = CASE WHEN EXCLUDED.lasttime_ms > app.networks.lasttime_ms THEN EXCLUDED.lastlon ELSE app.networks.lastlon END
          `,
          [
            bssid,
            cleanString(network.ssid) || '',
            network.type || 'W',
            network.frequency || 0,
            cleanString(network.capabilities) || '',
            cleanString(network.service) || '',
            cleanString(network.rcois) || '',
            network.mfgrid || 0,
            network.lasttime || 0,
            network.lastlat || 0,
            network.lastlon || 0,
            network.bestlevel || 0,
            network.bestlat || 0,
            network.bestlon || 0,
          ]
        );
        upserted++;
      } catch (error) {
        if (CONFIG.DEBUG) {
          const e = error as Error;
          console.error(`   Network upsert failed for ${bssid}: ${e.message}`);
        }
      }
    }

    console.log(
      `   Upserted ${upserted.toLocaleString()} networks (${skipped} skipped - no metadata)`
    );
  }

  /**
   * Ensure every newly imported BSSID has a row in app.networks.
   * SQLite backups can contain location rows without a matching network row.
   */
  private async backfillMissingNetworksFromObservations(): Promise<void> {
    console.log('\n🩹 Backfilling missing networks from imported observations...');

    const result = await this.pool.query(
      `
      WITH new_obs AS (
        SELECT *
        FROM app.observations
        WHERE source_tag = $1
          AND time_ms > $2
      ),
      latest AS (
        SELECT DISTINCT ON (UPPER(bssid))
          UPPER(bssid) AS bssid,
          COALESCE(ssid, '') AS ssid,
          COALESCE(radio_type, 'W') AS type,
          COALESCE(radio_frequency, 0) AS frequency,
          COALESCE(radio_capabilities, '') AS capabilities,
          COALESCE(radio_service, '') AS service,
          COALESCE(radio_rcois, '') AS rcois,
          COALESCE(mfgrid, 0) AS mfgrid,
          COALESCE(time_ms, observed_at_ms, (EXTRACT(EPOCH FROM time) * 1000)::bigint) AS lasttime_ms,
          COALESCE(lat, 0) AS lastlat,
          COALESCE(lon, 0) AS lastlon
        FROM new_obs
        ORDER BY
          UPPER(bssid),
          COALESCE(time_ms, observed_at_ms, (EXTRACT(EPOCH FROM time) * 1000)::bigint) DESC NULLS LAST
      ),
      best AS (
        SELECT DISTINCT ON (UPPER(bssid))
          UPPER(bssid) AS bssid,
          COALESCE(level, 0) AS bestlevel,
          COALESCE(lat, 0) AS bestlat,
          COALESCE(lon, 0) AS bestlon
        FROM new_obs
        ORDER BY
          UPPER(bssid),
          COALESCE(level, 0) DESC,
          COALESCE(time_ms, observed_at_ms, (EXTRACT(EPOCH FROM time) * 1000)::bigint) DESC NULLS LAST
      )
      INSERT INTO app.networks (
        bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
        lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon
      )
      SELECT
        l.bssid,
        l.ssid,
        l.type,
        l.frequency,
        l.capabilities,
        l.service,
        l.rcois,
        l.mfgrid,
        l.lasttime_ms,
        l.lastlat,
        l.lastlon,
        COALESCE(b.bestlevel, 0),
        COALESCE(b.bestlat, l.lastlat),
        COALESCE(b.bestlon, l.lastlon)
      FROM latest l
      LEFT JOIN best b ON b.bssid = l.bssid
      LEFT JOIN app.networks n ON UPPER(n.bssid) = l.bssid
      WHERE n.bssid IS NULL
      ON CONFLICT (bssid) DO NOTHING
      `,
      [this.sourceTag, this.latestTimeMs]
    );

    console.log(`   Backfilled ${result.rowCount?.toLocaleString() || 0} missing network(s)`);
  }

  private async pruneOrphanNetworks(): Promise<void> {
    console.log('\n🧹 Pruning orphan networks...');
    try {
      const result = await this.pool.query(
        `DELETE FROM app.networks
         WHERE NOT EXISTS (
           SELECT 1 FROM app.access_points ap WHERE ap.bssid = networks.bssid
         )`
      );
      const deleted = result.rowCount ?? 0;
      if (deleted > 0) {
        console.log(`   Removed ${deleted.toLocaleString()} orphan network(s) (no observations)`);
      } else {
        console.log('   No orphans found');
      }
    } catch (error) {
      const err = error as Error;
      console.warn(`   ⚠️ Orphan prune failed: ${err.message}`);
    }
  }

  private async refreshMaterializedViews(): Promise<void> {
    console.log('\n🔄 Refreshing materialized views...');

    try {
      const result = await this.pool.query('SELECT * FROM app.refresh_all_materialized_views()');
      console.log('   Materialized views refreshed:');
      for (const row of result.rows) {
        console.log(`     - ${row.view_name}`);
      }
    } catch (error) {
      const err = error as Error;
      console.warn(`   ⚠️ MV refresh failed: ${err.message}`);
    }
  }

  private printSummary(): void {
    const duration = (Date.now() - this.startTime) / 1000;
    const speed = this.imported > 0 ? Math.round(this.imported / duration) : 0;

    console.log(`\n${'━'.repeat(60)}`);
    console.log('✅ INCREMENTAL IMPORT COMPLETE!\n');
    console.log(`⏱️  Duration: ${duration.toFixed(1)}s`);
    console.log(`📈 Speed: ${speed.toLocaleString()} records/second`);
    console.log(`✔️  Imported: ${this.imported.toLocaleString()}`);
    console.log(`❌ Failed: ${this.failed.toLocaleString()}`);

    if (this.errors.length > 0) {
      console.log('\n⚠️  Sample errors (first 5):');
      this.errors.slice(0, 5).forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }

    console.log(`${'━'.repeat(60)}\n`);
  }
}

// ============================================================================
// CLI
// ============================================================================

function sanitizeSourceTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

function deriveSourceTag(sqliteFile: string): string {
  const base = path.basename(sqliteFile, path.extname(sqliteFile));
  const tag = sanitizeSourceTag(base);
  return tag || 'wigle_import';
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    const scriptName = path.basename(process.argv[1]);
    console.log(`
Usage: npx tsx ${scriptName} <sqlite_file> [source_tag]

Arguments:
  sqlite_file   Path to WiGLE SQLite backup file
  source_tag    Optional unique identifier for this data source (defaults to filename)

Examples:
  npx tsx ${scriptName} ~/Downloads/backup.sqlite s22_backup
  npx tsx ${scriptName} /path/to/wigle.sqlite

Environment:
  DB_HOST       PostgreSQL host (default: 127.0.0.1)
  DB_PORT       PostgreSQL port (default: 5432)
  DB_NAME       Database name (default: shadowcheck_db)
  DB_ADMIN_USER Admin user (default: shadowcheck_admin)
  DB_ADMIN_PASSWORD  Admin password
  DEBUG         Set to 'true' for verbose output
`);
    process.exit(1);
  }

  const [sqliteFile, sourceTagArg] = args;

  if (!fs.existsSync(sqliteFile)) {
    console.error(`❌ File not found: ${sqliteFile}`);
    process.exit(1);
  }

  const selectedTag =
    sourceTagArg ||
    process.env.IMPORT_SOURCE_TAG ||
    process.env.SOURCE_TAG ||
    deriveSourceTag(sqliteFile);
  const sourceTag = sanitizeSourceTag(selectedTag);

  if (!sourceTag) {
    console.error('❌ source_tag could not be derived; provide it explicitly.');
    process.exit(1);
  }

  const importer = new IncrementalImporter(sqliteFile, sourceTag);
  importer.start().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { IncrementalImporter };
