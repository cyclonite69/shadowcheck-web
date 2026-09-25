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

import { existsSync } from 'fs';
import { Pool } from 'pg';
import '../loadEnv';

import { parseIncrementalImportCliArgs } from './sqlite/cli';
import { importObservationRows } from './sqlite/importObservations';
import { runImportPreflight } from './sqlite/preflight';
import { ensureDeviceSource, ensureNetworksOrphansTable } from './sqlite/schemaSetup';
import { SqliteImportReader } from './sqlite/reader';
import {
  buildImportSummary,
  logImportBanner,
  logNoNewRecords,
  logProgressComplete,
  printImportSummary,
  writeImportProgress,
} from './sqlite/reporting';
import {
  upsertNetworks,
  backfillMissingNetworksFromObservations,
  recomputeBestPositions,
  moveOrphanNetworksToHoldingTable,
} from './sqlite/networkReconciliation';
import type { SqliteNetworkRow, ImportSummary } from './sqlite/types';

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
  private readonly sqliteReader: SqliteImportReader;
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
    this.sqliteReader = new SqliteImportReader(sqliteFile);
    this.startTime = Date.now();
  }

  async start(): Promise<ImportSummary> {
    logImportBanner(this.sqliteFile, this.sourceTag, CONFIG.BATCH_SIZE, CONFIG.DEBUG);

    try {
      await this.validateInputs();
      await this.getLatestImportedTime();
      await this.countRecords();

      if (this.toImport === 0) {
        logNoNewRecords();
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
      await recomputeBestPositions(this.pool);
      await backfillMissingNetworksFromObservations(this.pool, this.sourceTag, this.latestTimeMs);
      await moveOrphanNetworksToHoldingTable(this.pool);
      await this.refreshMaterializedViews();
      printImportSummary(this.getSummary());

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
    return buildImportSummary({
      imported: this.imported,
      failed: this.failed,
      errors: this.errors,
      startTime: this.startTime,
    });
  }

  private async validateInputs(): Promise<void> {
    console.log('🔍 Validating inputs...');

    const preflight = await runImportPreflight({
      sqliteFile: this.sqliteFile,
      sourceTag: this.sourceTag,
      pool: this.pool,
      sqliteReader: this.sqliteReader,
      existsSync,
    });

    console.log(`✅ PostgreSQL connected as ${preflight.postgresUser}`);
    console.log('✅ SQLite schema validated');
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

    this.totalInSqlite = await this.sqliteReader.countLocations();
    this.alreadyImported = await this.sqliteReader.countLocationsAtOrBefore(this.latestTimeMs);

    this.toImport = this.totalInSqlite - this.alreadyImported;

    console.log(`   Total in SQLite: ${this.totalInSqlite.toLocaleString()}`);
    console.log(`   Already imported: ${this.alreadyImported.toLocaleString()}`);
    console.log(`   New to import: ${this.toImport.toLocaleString()}`);
  }

  private async loadNetworkCache(): Promise<void> {
    console.log('\n📡 Loading network metadata...');

    this.networkCache = await this.sqliteReader.loadNetworkCache();
    console.log(`   Loaded ${this.networkCache.size.toLocaleString()} networks`);
  }

  private async importNewObservations(): Promise<void> {
    console.log('\n⚡ Importing new observations...');

    const rows = await this.sqliteReader.fetchNewObservations(this.latestTimeMs);

    console.log(`   Fetched ${rows.length.toLocaleString()} records from SQLite`);

    const result = await importObservationRows({
      rows,
      networkCache: this.networkCache,
      sourceTag: this.sourceTag,
      pool: this.pool,
      batchSize: CONFIG.BATCH_SIZE,
      debug: CONFIG.DEBUG,
      initialImported: this.imported,
      onProgress: (progress) => {
        writeImportProgress(
          progress.imported,
          progress.totalRows,
          progress.startTime,
          progress.processedRows
        );
      },
    });

    this.imported += result.imported;
    this.failed += result.failed;
    this.errors.push(...result.errors);

    logProgressComplete();
  }

  private async refreshMaterializedViews(): Promise<void> {
    console.log('\n🔄 Refreshing materialized views...');

    try {
      const result = await this.pool.query('SELECT * FROM app.refresh_all_materialized_views()');
      console.log('   Materialized views refreshed:');
      for (const row of result.rows) {
        console.log(`     - ${row.view_name}`);
      }

      console.log('   Analyzing table statistics...');
      await this.pool.query('ANALYZE app.observations');
      await this.pool.query('ANALYZE app.networks');
      console.log('   ✅ Table stats analyzed for observations and networks');
    } catch (error) {
      const err = error as Error;
      console.warn(`   ⚠️ MV refresh failed: ${err.message}`);
    }
  }
}

/* istanbul ignore next */
if (require.main === module) {
  const parseResult = parseIncrementalImportCliArgs(process.argv.slice(2));

  if (!parseResult.ok) {
    if (parseResult.stream === 'stdout') {
      console.log(parseResult.message);
    } else {
      console.error(parseResult.message);
    }
    process.exit(1);
  }

  const importer = new IncrementalImporter(
    parseResult.request.sqliteFile,
    parseResult.request.sourceTag
  );
  importer.start().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { IncrementalImporter };
