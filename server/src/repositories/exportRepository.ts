export {};

const db = require('../config/database');
const { adminQuery } = require('../services/adminDbService');

const quoteIdent = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

export async function queryObservationsForCSV(): Promise<any[]> {
  const result = await db.query(`
    SELECT
      bssid,
      ssid,
      lat as latitude,
      lon as longitude,
      level as signal_dbm,
      time as observed_at,
      radio_type,
      radio_frequency as frequency,
      radio_capabilities as capabilities,
      accuracy
    FROM app.observations
    ORDER BY time DESC
    LIMIT 50000
  `);
  return result.rows;
}

export async function queryObservationsForJSON(): Promise<any[]> {
  const result = await db.query(`
    SELECT
      bssid,
      ssid,
      lat,
      lon,
      level,
      time,
      radio_type,
      radio_frequency,
      radio_capabilities,
      accuracy,
      altitude
    FROM app.observations
    ORDER BY time DESC
    LIMIT 20000
  `);
  return result.rows;
}

export async function queryNetworksForJSON(): Promise<any[]> {
  const result = await db.query(`
    SELECT
      bssid,
      ssid,
      type,
      lasttime_ms,
      bestlat,
      bestlon,
      frequency,
      capabilities,
      threat_score_v2 as threat_score,
      threat_level
    FROM app.networks
    ORDER BY lasttime_ms DESC NULLS LAST
    LIMIT 10000
  `);
  return result.rows;
}

export async function queryObservationsForGeoJSON(): Promise<any[]> {
  const result = await db.query(`
    SELECT
      bssid,
      ssid,
      lat as latitude,
      lon as longitude,
      level as signal_dbm,
      time as observed_at,
      radio_type,
      radio_frequency as frequency,
      radio_capabilities as capabilities,
      accuracy
    FROM app.observations
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    ORDER BY time DESC
    LIMIT 50000
  `);
  return result.rows;
}

export async function queryAppTableNames(): Promise<string[]> {
  const result = await adminQuery(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'app'
      ORDER BY tablename
    `
  );
  return result.rows.map((row: any) => String(row.tablename));
}

export async function queryTableRowCount(tableName: string): Promise<number> {
  const qualifiedTable = `${quoteIdent('app')}.${quoteIdent(tableName)}`;
  const result = await adminQuery(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedTable}`);
  return Number(result.rows[0]?.count || 0);
}

export async function queryTableRows(tableName: string, limit: number): Promise<any[]> {
  if (limit <= 0) return [];
  const qualifiedTable = `${quoteIdent('app')}.${quoteIdent(tableName)}`;
  const result = await adminQuery(`SELECT * FROM ${qualifiedTable} LIMIT ${limit}`);
  return Array.isArray(result.rows) ? result.rows : [];
}

export async function queryObservationsForKML(bssids: string[]): Promise<any[]> {
  const placeholders = bssids.map((_, i) => `$${i + 1}`).join(',');
  const result = await db.query(
    `
    SELECT
      bssid,
      ssid,
      lat,
      lon,
      level as signal_dbm,
      time as observed_at,
      radio_type,
      radio_frequency as frequency,
      radio_capabilities as capabilities,
      accuracy,
      altitude
    FROM app.observations
    WHERE bssid IN (${placeholders})
      AND lat IS NOT NULL
      AND lon IS NOT NULL
    ORDER BY time DESC
    LIMIT 10000
  `,
    bssids
  );
  return result.rows;
}

module.exports = {
  queryObservationsForCSV,
  queryObservationsForJSON,
  queryNetworksForJSON,
  queryObservationsForGeoJSON,
  queryAppTableNames,
  queryTableRowCount,
  queryTableRows,
  queryObservationsForKML,
};
