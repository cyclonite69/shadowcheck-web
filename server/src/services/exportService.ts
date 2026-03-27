/**
 * Export Service Layer
 * Encapsulates database queries for data export operations
 */

const db = require('../config/database');
const { adminQuery } = require('./adminDbService');

const quoteIdent = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

export async function getObservationsForCSV(): Promise<any[]> {
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

export async function getObservationsAndNetworksForJSON(): Promise<{
  observations: any[];
  networks: any[];
}> {
  const [observations, networks] = await Promise.all([
    db.query(`
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
    `),
    db.query(`
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
    `),
  ]);

  return {
    observations: observations.rows,
    networks: networks.rows,
  };
}

export async function getObservationsForGeoJSON(): Promise<any[]> {
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

export async function getFullDatabaseSnapshot(): Promise<{
  schema: string;
  exported_at: string;
  tables: Record<string, { rowCount: number; rows: any[] }>;
}> {
  const tableList = await adminQuery(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'app'
      ORDER BY tablename
    `
  );

  const tables: Record<string, { rowCount: number; rows: any[] }> = {};

  for (const row of tableList.rows) {
    const tableName = String(row.tablename);
    const qualifiedTable = `${quoteIdent('app')}.${quoteIdent(tableName)}`;
    const result = await adminQuery(`SELECT * FROM ${qualifiedTable}`);

    tables[tableName] = {
      rowCount: result.rows.length,
      rows: result.rows,
    };
  }

  return {
    schema: 'app',
    exported_at: new Date().toISOString(),
    tables,
  };
}

module.exports = {
  getObservationsForCSV,
  getObservationsAndNetworksForJSON,
  getObservationsForGeoJSON,
  getFullDatabaseSnapshot,
};
