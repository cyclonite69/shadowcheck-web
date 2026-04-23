import sqlite3 from 'sqlite3';
import { SqliteLocationRow, SqliteNetworkRow } from './types';

export class SqliteReader {
  private sqliteFile: string;

  constructor(sqliteFile: string) {
    this.sqliteFile = sqliteFile;
  }

  async getLatestTimestamp(): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.get('SELECT MAX(time) as latest FROM location', (err, row: { latest: number }) => {
        db.close();
        if (err) reject(err);
        else resolve(row.latest || 0);
      });
    });
  }

  async getTotalCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.get('SELECT COUNT(*) as count FROM location', (err, row: { count: number }) => {
        db.close();
        if (err) reject(err);
        else resolve(row.count || 0);
      });
    });
  }

  async getAlreadyImportedCount(since: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.get(
        'SELECT COUNT(*) as count FROM location WHERE time <= ?',
        [since],
        (err, row: { count: number }) => {
          db.close();
          if (err) reject(err);
          else resolve(row.count || 0);
        }
      );
    });
  }

  async loadNetworkCache(): Promise<Map<string, SqliteNetworkRow>> {
    const networkCache = new Map<string, SqliteNetworkRow>();
    await new Promise<void>((resolve, reject) => {
      const db = new sqlite3.Database(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.all('SELECT * FROM network', (err, rows: SqliteNetworkRow[]) => {
        db.close();
        if (err) {
          reject(err);
          return;
        }
        for (const row of rows) {
          networkCache.set(row.bssid.toUpperCase(), row);
        }
        resolve();
      });
    });
    return networkCache;
  }

  async fetchNewObservations(since: number): Promise<SqliteLocationRow[]> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.sqliteFile, sqlite3.OPEN_READONLY);
      db.all(
        'SELECT * FROM location WHERE time > ? ORDER BY time ASC',
        [since],
        (err, rows: SqliteLocationRow[]) => {
          db.close();
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
}
