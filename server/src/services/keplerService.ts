/**
 * Kepler Service Layer
 * Encapsulates database queries and data shaping for Kepler.gl operations
 */

const { query } = require('../config/database');
const filterQueryBuilder = require('./filterQueryBuilder');
const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;

export interface KeplerNetworkRow {
  bssid: string | null;
  ssid: string | null;
  signal: number | null;
  lon: number | null;
  lat: number | null;
  first_seen: unknown;
  last_seen: unknown;
  observed_at: unknown;
  manufacturer: string | null;
  type: string | null;
  frequency: number | null;
  capabilities: string | null;
  last_altitude_m: number | null;
  accuracy_meters: number | null;
  observations: number | null;
  threat: { level?: string; score?: number } | null;
  distance_from_home_km: number | null;
  max_distance_meters: number | null;
  unique_days: number | null;
  first_observed_at: unknown;
  last_observed_at: unknown;
  geocoded_address?: string | null;
  geocoded_poi_name?: string | null;
}

export interface KeplerObsRow {
  bssid: string | null;
  ssid: string | null;
  level: number | null;
  lon: number | null;
  lat: number | null;
  time: unknown;
  manufacturer: string | null;
  radio_type: string | null;
  radio_frequency: number | null;
  radio_capabilities: string | null;
  device_id: string | null;
  source_tag: string | null;
  altitude: number | null;
  accuracy: number | null;
  threat_level: string | null;
  threat_score: number | null;
  distance_from_home_km: number | null;
  first_observed_at: unknown;
  last_observed_at: unknown;
  observations: number | null;
  unique_days: number | null;
  max_distance_meters: number | null;
  stationary_confidence: number | null;
  geocoded_address?: string | null;
  geocoded_poi_name?: string | null;
}

interface KeplerBssidRow {
  bssid: string | null;
}

export function inferRadioType(
  radioType: string | null | undefined,
  ssid: string | null | undefined,
  frequency: string | number | null | undefined,
  capabilities: string | null | undefined
): string {
  if (radioType && radioType !== '' && radioType !== null) return radioType;
  const ssidUpper = String(ssid || '').toUpperCase();
  const capUpper = String(capabilities || '').toUpperCase();
  if (ssidUpper.includes('5G') || capUpper.includes('NR') || capUpper.includes('5G NR')) return 'N';
  if (
    ssidUpper.includes('LTE') ||
    ssidUpper.includes('4G') ||
    capUpper.includes('LTE') ||
    capUpper.includes('EARFCN')
  )
    return 'L';
  if (
    ssidUpper.includes('WCDMA') ||
    ssidUpper.includes('3G') ||
    ssidUpper.includes('UMTS') ||
    capUpper.includes('WCDMA') ||
    capUpper.includes('UMTS') ||
    capUpper.includes('UARFCN')
  )
    return 'D';
  if (
    ssidUpper.includes('GSM') ||
    ssidUpper.includes('2G') ||
    capUpper.includes('GSM') ||
    capUpper.includes('ARFCN')
  )
    return 'G';
  if (ssidUpper.includes('CDMA') || capUpper.includes('CDMA')) return 'C';
  const cellularKeywords = ['T-MOBILE', 'VERIZON', 'AT&T', 'ATT', 'SPRINT', 'CARRIER', '3GPP'];
  if (cellularKeywords.some((k) => ssidUpper.includes(k))) return 'L';
  if (
    ssidUpper.includes('[UNKNOWN / SPOOFED RADIO]') ||
    ssidUpper.includes('BLE') ||
    ssidUpper.includes('BTLE') ||
    capUpper.includes('BLE') ||
    capUpper.includes('BTLE') ||
    capUpper.includes('BLUETOOTH LOW ENERGY')
  )
    return 'E';
  if (ssidUpper.includes('BLUETOOTH') || capUpper.includes('BLUETOOTH')) {
    return !capUpper.includes('LOW ENERGY') && !capUpper.includes('BLE') ? 'B' : 'E';
  }
  if (frequency) {
    const freq = parseInt(String(frequency), 10);
    if (freq >= 2412 && freq <= 2484) return 'W';
    if (freq >= 5000 && freq <= 5900) return 'W';
    if (freq >= 5925 && freq <= 7125) return 'W';
  }
  if (
    capUpper.includes('WPA') ||
    capUpper.includes('WEP') ||
    capUpper.includes('WPS') ||
    capUpper.includes('RSN') ||
    capUpper.includes('ESS') ||
    capUpper.includes('CCMP') ||
    capUpper.includes('TKIP')
  )
    return 'W';
  return '?';
}

const buildActualCounts = (rows: KeplerBssidRow[], rowCount: number | null | undefined) => ({
  observations: rowCount || 0,
  networks: new Set(rows.map((row) => row.bssid).filter(Boolean)).size,
});

const buildFeatureCollection = <TRow>(
  rows: TRow[],
  rowCount: number | null | undefined,
  getCoordinates: (row: TRow) => [number | null, number | null],
  mapProperties: (row: TRow) => Record<string, unknown>
) => ({
  type: 'FeatureCollection',
  actualCounts: buildActualCounts(rows as KeplerBssidRow[], rowCount),
  features: rows
    .filter((row) => {
      const [lon, lat] = getCoordinates(row);
      return lon !== null && lat !== null;
    })
    .map((row) => {
      const [lon, lat] = getCoordinates(row);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: mapProperties(row),
      };
    }),
});

export const buildKeplerDataGeoJson = (
  rows: KeplerNetworkRow[],
  rowCount: number | null | undefined
) =>
  buildFeatureCollection(
    rows,
    rowCount,
    (row) => [row.lon, row.lat],
    (row) => ({
      bssid: row.bssid,
      ssid: row.ssid || 'Hidden Network',
      bestlevel: row.signal || 0,
      signal: row.signal || 0,
      level: row.signal || 0,
      manufacturer: row.manufacturer || 'Unknown',
      type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
      threat_level: row.threat?.level || null,
      threat_score: row.threat?.score || null,
      observation_count: row.observations || 0,
      obs_count: row.observations || 0,
      unique_days: row.unique_days || 0,
      max_distance_meters: row.max_distance_meters || 0,
      first_observed_at: row.first_observed_at,
      last_observed_at: row.last_observed_at,
      geocoded_address: row.geocoded_address,
      geocoded_poi_name: row.geocoded_poi_name,
    })
  );

export const buildKeplerObservationsGeoJson = (
  rows: KeplerObsRow[],
  rowCount: number | null | undefined
) =>
  buildFeatureCollection(
    rows,
    rowCount,
    (row) => [row.lon, row.lat],
    (row) => {
      const firstObs = row.first_observed_at ? new Date(String(row.first_observed_at)) : null;
      const lastObs = row.last_observed_at ? new Date(String(row.last_observed_at)) : null;
      const timespanDays =
        firstObs && lastObs ? (lastObs.getTime() - firstObs.getTime()) / (1000 * 60 * 60 * 24) : 0;
      return {
        bssid: row.bssid,
        ssid: row.ssid || 'Hidden Network',
        bestlevel: row.level || 0,
        signal: row.level || 0,
        level: row.level || 0,
        manufacturer: row.manufacturer || 'Unknown',
        type: inferRadioType(row.radio_type, row.ssid, row.radio_frequency, row.radio_capabilities),
        threat_level: row.threat_level || null,
        threat_score: row.threat_score || null,
        observation_count: row.observations || 0,
        obs_count: row.observations || 0,
        unique_days: row.unique_days || 0,
        max_distance_meters: row.max_distance_meters || 0,
        max_distance_km: (row.max_distance_meters || 0) / 1000,
        first_observed_at: row.first_observed_at,
        last_observed_at: row.last_observed_at,
        timespan_days: Math.round(timespanDays * 10) / 10,
        stationary_confidence: row.stationary_confidence,
        geocoded_address: row.geocoded_address,
        geocoded_poi_name: row.geocoded_poi_name,
      };
    }
  );

export const buildKeplerNetworksGeoJson = (
  rows: KeplerNetworkRow[],
  rowCount: number | null | undefined
) =>
  buildFeatureCollection(
    rows,
    rowCount,
    (row) => [row.lon, row.lat],
    (row) => ({
      bssid: row.bssid,
      ssid: row.ssid || 'Hidden Network',
      bestlevel: row.signal || 0,
      signal: row.signal || 0,
      level: row.signal || 0,
      manufacturer: row.manufacturer || 'Unknown',
      type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
      threat_level: row.threat?.level || null,
      threat_score: row.threat?.score || null,
      observation_count: row.observations || 0,
      obs_count: row.observations || 0,
      unique_days: row.unique_days || 0,
      max_distance_meters: row.max_distance_meters || 0,
      first_observed_at: row.first_observed_at,
      last_observed_at: row.last_observed_at,
      geocoded_address: row.geocoded_address,
      geocoded_poi_name: row.geocoded_poi_name,
    })
  );

export async function checkHomeLocationExists(): Promise<boolean> {
  try {
    const home = await query(
      "SELECT 1 FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
    );
    return home.rowCount > 0;
  } catch (err: any) {
    if (err && err.code === '42P01') {
      throw new Error('Home location markers table is missing (app.location_markers).');
    }
    throw err;
  }
}

export async function executeKeplerQuery(sql: string, params: any[]): Promise<any> {
  await query("SET LOCAL statement_timeout = '120000ms'");
  const result = await query(sql, params);
  return result;
}

/**
 * Ensures home location exists if distance filters are enabled
 */
async function assertHomeExistsIfNeeded(enabled: Record<string, any>) {
  if (enabled?.distanceFromHomeMin || enabled?.distanceFromHomeMax) {
    const exists = await checkHomeLocationExists();
    if (!exists) {
      throw new Error('Home location is required for distance filters.');
    }
  }
}

/**
 * Get latest observation per network for Kepler.gl
 */
export async function getKeplerData(
  filters: any,
  enabled: any,
  limit: number | null,
  offset: number = 0
) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    throw { status: 400, errors };
  }

  await assertHomeExistsIfNeeded(enabled);

  const builder = new UniversalFilterQueryBuilder(filters, enabled);
  const { sql, params } = builder.buildNetworkListQuery({ limit, offset });

  const result = await executeKeplerQuery(sql, params);
  return buildKeplerDataGeoJson(result.rows || [], result.rowCount);
}

/**
 * Get full observations dataset for Kepler.gl
 */
export async function getKeplerObservations(filters: any, enabled: any, limit: number | null) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    throw { status: 400, errors };
  }

  await assertHomeExistsIfNeeded(enabled);

  const builder = new UniversalFilterQueryBuilder(filters, enabled);
  const { sql, params } = builder.buildGeospatialQuery({ limit });

  const result = await executeKeplerQuery(sql, params);
  return buildKeplerObservationsGeoJson(result.rows || [], result.rowCount);
}

/**
 * Get network summaries for Kepler.gl
 */
export async function getKeplerNetworks(
  filters: any,
  enabled: any,
  limit: number | null,
  offset: number = 0
) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    throw { status: 400, errors };
  }

  await assertHomeExistsIfNeeded(enabled);

  const builder = new UniversalFilterQueryBuilder(filters, enabled);
  const { sql, params } = builder.buildNetworkListQuery({ limit, offset });

  const result = await executeKeplerQuery(sql, params);
  return buildKeplerNetworksGeoJson(result.rows || [], result.rowCount);
}

module.exports = {
  checkHomeLocationExists,
  executeKeplerQuery,
  getKeplerData,
  getKeplerObservations,
  getKeplerNetworks,
  inferRadioType,
  buildKeplerDataGeoJson,
  buildKeplerObservationsGeoJson,
  buildKeplerNetworksGeoJson,
};
