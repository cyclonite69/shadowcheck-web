#!/usr/bin/env tsx
/**
 * Kismet Sidecar Importer
 *
 * Imports raw data from .kismet SQLite files into dedicated app.kismet_* tables.
 * This acts as a forensic context builder separate from the main observation pipeline.
 *
 * Usage:
 *   npx tsx etl/load/kismet-import.ts <kismet_file> [session_id]
 */

import * as fs from 'fs';
import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import '../loadEnv';
import * as path from 'path';

const CONFIG = {
  BATCH_SIZE: 500,
  DB_CONFIG: {
    user: process.env.DB_ADMIN_USER || 'shadowcheck_admin',
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'shadowcheck_db',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  },
};

class KismetImporter {
  private sqliteFile: string;
  private sessionId: string;
  private pool: Pool;
  private stats: Record<string, number> = {};

  constructor(sqliteFile: string, sessionId: string) {
    this.sqliteFile = sqliteFile;
    this.sessionId = sessionId;
    this.pool = new Pool(CONFIG.DB_CONFIG);
  }

  async start() {
    console.log(`\n🕵️  KISMET SIDECAR IMPORT`);
    console.log(`━`.repeat(50));
    console.log(`📁 File: ${this.sqliteFile}`);
    console.log(`🆔 Session: ${this.sessionId}\n`);

    try {
      const db = await this.openSqlite();

      // Granular import tasks
      const tasks = [
        {
          source: 'datasources',
          target: 'app.kismet_datasources',
          mapper: (row: any) => ({
            ts_sec: row.ts_sec,
            ts_usec: row.ts_usec,
            timestamp: new Date(row.ts_sec * 1000),
            datasource: row.datasource,
            json_data: row.datasource_serialized,
            session_id: this.sessionId,
          }),
        },
        {
          source: 'devices',
          target: 'app.kismet_devices',
          mapper: (row: any) => ({
            devkey: row.devkey,
            phyname: row.phyname,
            devmac: row.devmac,
            strongest_signal: row.strongest_signal,
            min_lat: row.min_lat,
            min_lon: row.min_lon,
            max_lat: row.max_lat,
            max_lon: row.max_lon,
            avg_lat: row.avg_lat,
            avg_lon: row.avg_lon,
            bytes_data: row.bytes_data,
            first_time: new Date(row.first_time * 1000),
            last_time: new Date(row.last_time * 1000),
            device_data: row.device_serialized,
            session_id: this.sessionId,
            lat: row.avg_lat,
            lon: row.avg_lon,
          }),
        },
        {
          source: 'packets',
          target: 'app.kismet_packets',
          mapper: (row: any) => ({
            ts_sec: row.ts_sec,
            ts_usec: row.ts_usec,
            timestamp: new Date(row.ts_sec * 1000),
            phyname: row.phyname,
            sourcemac: row.sourcemac,
            destmac: row.destmac,
            transmac: row.transmac,
            frequency: row.frequency,
            devkey: row.devkey,
            alt: row.alt,
            speed: row.speed,
            heading: row.heading,
            packet_len: row.packet_len,
            signal: row.signal,
            datasource: row.uuid,
            dlt: row.dlt,
            packet_data: row.packet_data,
            error_flag: row.error_flag,
            tags: row.tags,
            datarate: row.datarate,
            hash: row.hash,
            packetid: row.packetid,
            packet_full_len: row.packet_full_len,
            session_id: this.sessionId,
            lat: row.lat,
            lon: row.lon,
          }),
        },
        {
          source: 'alerts',
          target: 'app.kismet_alerts',
          mapper: (row: any) => ({
            ts_sec: row.ts_sec,
            ts_usec: row.ts_usec,
            timestamp: new Date(row.ts_sec * 1000),
            phyname: row.phyname,
            devmac: row.devmac,
            lat: row.lat,
            lon: row.lon,
            header: row.header,
            json_data: row.alert_json,
            session_id: this.sessionId,
          }),
        },
        {
          source: 'messages',
          target: 'app.kismet_messages',
          mapper: (row: any) => ({
            ts_sec: row.ts_sec,
            ts_usec: row.ts_usec,
            timestamp: new Date(row.ts_sec * 1000),
            msgtype: row.msgtype,
            message: row.message,
            session_id: this.sessionId,
          }),
        },
        {
          source: 'snapshots',
          target: 'app.kismet_snapshots',
          mapper: (row: any) => ({
            ts_sec: row.ts_sec,
            ts_usec: row.ts_usec,
            timestamp: new Date(row.ts_sec * 1000),
            snaptype: row.snaptype,
            json_data: row.snapshot_serialized,
            session_id: this.sessionId,
          }),
        },
        {
          source: 'data',
          target: 'app.kismet_data',
          mapper: (row: any) => ({
            ts_sec: row.ts_sec,
            ts_usec: row.ts_usec,
            timestamp: new Date(row.ts_sec * 1000),
            phyname: row.phyname,
            devmac: row.devmac,
            data_type: row.dataype,
            json_data: row.data_serialized,
            session_id: this.sessionId,
          }),
        },
      ];

      for (const task of tasks) {
        const count = await this.importTable(db, task.source, task.target, task.mapper);
        this.stats[task.source] = count;
      }

      console.log(`\n✅ Import Complete`);
      console.log(`📊 Summary:`);
      Object.entries(this.stats).forEach(([table, count]) => {
        if (count > 0) console.log(`   - ${table}: ${count.toLocaleString()} rows`);
      });

      // Special formatted line for the backend to parse
      console.log(`\nTOTAL_IMPORTED: ${Object.values(this.stats).reduce((a, b) => a + b, 0)}`);
    } catch (err: any) {
      console.error(`\n❌ Error: ${err.message}`);
    } finally {
      await this.pool.end();
    }
  }

  private openSqlite(): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.sqliteFile, sqlite3.OPEN_READONLY, (err) => {
        if (err) reject(err);
        else resolve(db);
      });
    });
  }

  private async importTable(
    db: sqlite3.Database,
    sourceTable: string,
    targetTable: string,
    mapper: (row: any) => any
  ): Promise<number> {
    console.log(`📦 Processing ${sourceTable}...`);

    return new Promise<number>((resolve, reject) => {
      db.all(`SELECT * FROM ${sourceTable}`, async (err, rows) => {
        if (err) {
          console.warn(`   ⚠️  Source table '${sourceTable}' not found or empty. Skipping.`);
          return resolve(0);
        }

        if (rows.length === 0) return resolve(0);

        let totalInserted = 0;
        const chunks = this.chunkArray(rows, CONFIG.BATCH_SIZE);
        for (const chunk of chunks) {
          const mapped = chunk.map(mapper);
          const result = await this.insertBatch(targetTable, mapped);
          totalInserted += result;
        }

        console.log(`   ✔️  Imported ${totalInserted} rows into ${targetTable}`);
        resolve(totalInserted);
      });
    });
  }

  private async insertBatch(table: string, records: any[]): Promise<number> {
    if (records.length === 0) return 0;

    const keys = Object.keys(records[0]).filter((k) => k !== 'lat' && k !== 'lon');
    const hasCoords = 'lat' in records[0] && 'lon' in records[0];

    const placeholders = records
      .map((_, rIdx) => {
        const rowStart = rIdx * keys.length + 1;
        let p = `(${keys.map((_, kIdx) => `$${rowStart + kIdx}`).join(', ')}`;
        if (hasCoords) {
          const latIdx = rowStart + keys.length;
          const lonIdx = latIdx + 1;
          p += `, ST_SetSRID(ST_MakePoint($${lonIdx}, $${latIdx}), 4326)`;
        }
        return p + `)`;
      })
      .join(', ');

    const values: any[] = [];
    records.forEach((r) => {
      keys.forEach((k) => values.push(r[k]));
      if (hasCoords) {
        values.push(r.lat);
        values.push(r.lon);
      }
    });

    const columns = hasCoords ? [...keys, 'location'] : keys;
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;

    try {
      const result = await this.pool.query(sql, values);
      return result.rowCount || 0;
    } catch (err: any) {
      console.error(`   ❌ Batch Error in ${table}: ${err.message}`);
      return 0;
    }
  }

  private chunkArray(array: any[], size: number) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }
}

// CLI Execution
const [file, tag] = process.argv.slice(2);
if (!file) {
  console.log('Usage: npx tsx etl/load/kismet-import.ts <file.kismet> [session_id]');
  process.exit(1);
}

const sessionId = tag || path.basename(file, '.kismet');
new KismetImporter(file, sessionId).start();
