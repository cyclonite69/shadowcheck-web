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

import { validateAndEnrich } from './sqlite/validateAndEnrich';
import { ensureDeviceSource, ensureNetworksOrphansTable } from './sqlite/schemaSetup';
import { insertBatch } from './sqlite/insertObservations';
import {
  upsertNetworks,
  backfillMissingNetworksFromObservations,
  moveOrphanNetworksToHoldingTable,
} from './sqlite/networkReconciliation';
import type { SqliteLocationRow, SqliteNetworkRow, ImportSummary } from './sqlite/types';

// ============================================================================
// CONFIGURATION
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
// ORCHESTRATOR
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

  async start(): Promise<ImportSummary> {
    console.log('\n📦 INCREMENTAL IMPORT - WiGLE SQLite');
    console.log('━'.repeat(60));
    console.log(`📁 Source: ${this.sqliteFile}`);
    console.log(`🏷️  Source tag: ${this.sourceTag}`);
    console.log(`📦 Batch size: ${CONFIG.BATCH_SIZE}`);
    console.log(`🐛 Debug: ${CONFIG.DEBUG ? 'ON' : 'OFF'}\n`);

    try {
      await this.validateInputs();
      await this.getLatestImportedTime();
      await this.countRecords();

      if (this.toImport === 0) {
        console.log('\n✅ Database is up to date - no new records to import.');
        return this.getSummary();
      }

      await this.loadNetworkCache();
      await ensureDeviceSource(this.pool, this.sourceTag);
      await ensureNetworksOrphansTable(this.pool);
      await upsertNetworks(
        this.pool,
        this.sqliteFile,
        this.latestTimeMs,
        this.networkCache,
        CONFIG.DEBUG
      );
      await this.importNewObservations();
      await backfillMissingNetworksFromObservations(this.pool, this.sourceTag, this.latestTimeMs);
      await moveOrphanNetworksToHoldingTable(this.pool);
      await this.refreshMaterializedViews();
      this.printSummary();

      return this.getSummary();
    } catch (error) {
      const err = error as Error;
      console.error('\n❌ IMPORT FAILED:', err.message);
      if (CONFIG.DEBUG) {
        console.error('Stack trace:', err.stack);
      }
      throw err;
    } finally {
      await this.pool.end();
    }
  }

  private getSummary(): ImportSummary {
    const duration = (Date.now() - this.startTime) / 1000;
    const speed = this.imported > 0 ? Math.round(this.imported / duration) : 0;
    return {
      imported: this.imported,
      failed: this.failed,
      durationS: duration,
      speed,
      errors: this.errors,
    };
  }

  private async validateInputs(): Promise<void> {
    console.log('🔍 Validating inputs...');

    if (!fs.existsSync(this.sqliteFile)) {
      throw new Error(`SQLite file not found: ${this.sqliteFile}`);
    }

    if (!this.sourceTag || !/^[a-zA-Z0-9_-]+$/.test(this.sourceTag)) {
      throw new Error('Source tag must be alphanumeric with underscores/hyphens only');
    }

    try {
      const result = await this.pool.query('SELECT NOW() as now, current_user as user');
      console.log(`✅ PostgreSQL connected as ${result.rows[0].user}`);
    } catch (error) {
      const err = error as Error;
      throw new Error(`PostgreSQL connection failed: ${err.message}`);
    }

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
    type ValidObs = NonNullable<ReturnType<typeof validateAndEnrich>>;
    let validBatch: ValidObs[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validated = validateAndEnrich(row, this.networkCache, this.sourceTag, this.errors);

      if (!validated) {
        this.failed++;
        continue;
      }

      validBatch.push(validated);

      if (validBatch.length >= CONFIG.BATCH_SIZE) {
        try {
          const result = await insertBatch(this.pool, validBatch, CONFIG.DEBUG);
          this.imported += result.inserted;
          this.failed += result.failed;
          this.errors.push(...result.errors);
        } catch (error) {
          const e = error as Error;
          this.errors.push(`Batch insert error: ${e.message}`);
          if (CONFIG.DEBUG) {
            console.error(`\n   Batch error: ${e.message}`);
          }
        }
        validBatch = [];

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? Math.round(this.imported / elapsed) : 0;
        const percent = Math.round(((i + 1) / rows.length) * 100);
        process.stdout.write(
          `\r   Progress: ${this.imported.toLocaleString()}/${rows.length.toLocaleString()} (${percent}%) | ${speed.toLocaleString()} rec/s`
        );
      }
    }

    if (validBatch.length > 0) {
      try {
        const result = await insertBatch(this.pool, validBatch, CONFIG.DEBUG);
        this.imported += result.inserted;
        this.failed += result.failed;
        this.errors.push(...result.errors);
      } catch (error) {
        const e = error as Error;
        this.errors.push(`Final batch error: ${e.message}`);
      }
    }

    console.log(''); // newline after progress
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
