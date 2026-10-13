export {};
const { query } = require('../config/database');
const logger = require('../logging/logger');

export interface LayerCounts {
  home: number;
  fieldObservations: number;
  wigleKml: number;
  wigleV2: number;
  wigleV3: number;
  courthouses: number;
  fieldOffices: number;
  residentAgencies: number;
  alpr: number;
  shotspotterZones: number;
  shotspotterSensors: number;
}

const handleCountQuery = async (sql: string, layerName: string, key = 'count'): Promise<number> => {
  try {
    const res = await query(sql);
    return Number(res?.rows?.[0]?.[key] ?? 0);
  } catch (err) {
    logger.warn(`[LayerCountsRepository] Failed to query count for ${layerName}:`, err);
    return 0;
  }
};

const handleAgencyQuery = async (): Promise<{ fieldOffices: number; residentAgencies: number }> => {
  try {
    const sql = `
      SELECT 
        COUNT(*) FILTER (WHERE office_type = 'field_office')::int AS field_offices,
        COUNT(*) FILTER (WHERE office_type = 'resident_agency')::int AS resident_agencies
      FROM app.agency_offices;
    `;
    const res = await query(sql);
    return {
      fieldOffices: Number(res?.rows?.[0]?.field_offices ?? 0),
      residentAgencies: Number(res?.rows?.[0]?.resident_agencies ?? 0),
    };
  } catch (err) {
    logger.warn('[LayerCountsRepository] Failed to query count for agency offices:', err);
    return { fieldOffices: 0, residentAgencies: 0 };
  }
};

/**
 * Fetches authoritative record counts for all 11 Geospatial Explorer layers.
 * Queries 10 physical tables in parallel with isolated error handling.
 *
 * @returns {Promise<LayerCounts>} Count totals for each layer key
 */
export async function fetchAuthoritativeLayerCounts(): Promise<LayerCounts> {
  const [
    home,
    fieldObservations,
    wigleKml,
    wigleV2,
    wigleV3,
    courthouses,
    agencies,
    alpr,
    shotspotterZones,
    shotspotterSensors,
  ] = await Promise.all([
    handleCountQuery(
      "SELECT COUNT(*)::int AS count FROM app.location_markers WHERE marker_type = 'home'",
      'home'
    ),
    handleCountQuery('SELECT COUNT(*)::int AS count FROM app.observations', 'fieldObservations'),
    handleCountQuery('SELECT COUNT(*)::int AS count FROM app.kml_points', 'wigleKml'),
    handleCountQuery('SELECT COUNT(*)::int AS count FROM app.wigle_v2_networks_search', 'wigleV2'),
    handleCountQuery('SELECT COUNT(*)::int AS count FROM app.wigle_v3_observations', 'wigleV3'),
    handleCountQuery(
      'SELECT COUNT(*)::int AS count FROM app.federal_courthouses WHERE active = true',
      'courthouses'
    ),
    handleAgencyQuery(),
    handleCountQuery('SELECT COUNT(*)::int AS count FROM app.alpr_cameras', 'alpr'),
    handleCountQuery(
      'SELECT COUNT(*)::int AS count FROM app.shotspotter_zones',
      'shotspotterZones'
    ),
    handleCountQuery(
      'SELECT COUNT(*)::int AS count FROM app.shotspotter_sensors',
      'shotspotterSensors'
    ),
  ]);

  return {
    home,
    fieldObservations,
    wigleKml,
    wigleV2,
    wigleV3,
    courthouses,
    fieldOffices: agencies.fieldOffices,
    residentAgencies: agencies.residentAgencies,
    alpr,
    shotspotterZones,
    shotspotterSensors,
  };
}

module.exports = {
  fetchAuthoritativeLayerCounts,
};
