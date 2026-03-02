/**
 * Export Service Layer
 * Encapsulates database queries for data export operations
 */

const { query } = require('../config/database');

export async function getObservationsForCSV(): Promise<any[]> {
  const result = await query(`
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
  `);
  return result.rows;
}

export async function getObservationsAndNetworksForJSON(): Promise<{
  observations: any[];
  networks: any[];
}> {
  const [observations, networks] = await Promise.all([
    query(`
      SELECT * FROM app.observations
      ORDER BY time DESC
    `),
    query(`
      SELECT * FROM app.networks
      ORDER BY lasttime_ms DESC
    `),
  ]);

  return {
    observations: observations.rows,
    networks: networks.rows,
  };
}

export async function getObservationsForGeoJSON(): Promise<any[]> {
  const result = await query(`
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
  `);
  return result.rows;
}

module.exports = {
  getObservationsForCSV,
  getObservationsAndNetworksForJSON,
  getObservationsForGeoJSON,
};
