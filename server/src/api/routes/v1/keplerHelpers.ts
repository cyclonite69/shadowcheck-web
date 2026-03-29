import { frequencyToChannel } from '../../../utils/frequencyUtils';

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
}

interface KeplerBssidRow {
  bssid: string | null;
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
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        properties: mapProperties(row),
      };
    }),
});

export const parseJsonParam = (value: unknown, fallback: unknown, name: string) => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    throw new Error(`Invalid JSON for ${name}`);
  }
};

export function inferRadioType(
  radioType: string | null | undefined,
  ssid: string | null | undefined,
  frequency: string | number | null | undefined,
  capabilities: string | null | undefined
) {
  if (radioType && radioType !== '' && radioType !== null) {
    return radioType;
  }

  const ssidUpper = String(ssid || '').toUpperCase();
  const capUpper = String(capabilities || '').toUpperCase();

  if (ssidUpper.includes('5G') || capUpper.includes('NR') || capUpper.includes('5G NR')) {
    return 'N';
  }

  if (
    ssidUpper.includes('LTE') ||
    ssidUpper.includes('4G') ||
    capUpper.includes('LTE') ||
    capUpper.includes('EARFCN')
  ) {
    return 'L';
  }

  if (
    ssidUpper.includes('WCDMA') ||
    ssidUpper.includes('3G') ||
    ssidUpper.includes('UMTS') ||
    capUpper.includes('WCDMA') ||
    capUpper.includes('UMTS') ||
    capUpper.includes('UARFCN')
  ) {
    return 'D';
  }

  if (
    ssidUpper.includes('GSM') ||
    ssidUpper.includes('2G') ||
    capUpper.includes('GSM') ||
    capUpper.includes('ARFCN')
  ) {
    return 'G';
  }

  if (ssidUpper.includes('CDMA') || capUpper.includes('CDMA')) {
    return 'C';
  }

  const cellularKeywords = ['T-MOBILE', 'VERIZON', 'AT&T', 'ATT', 'SPRINT', 'CARRIER', '3GPP'];
  if (cellularKeywords.some((keyword) => ssidUpper.includes(keyword))) {
    return 'L';
  }

  if (
    ssidUpper.includes('[UNKNOWN / SPOOFED RADIO]') ||
    ssidUpper.includes('BLE') ||
    ssidUpper.includes('BTLE') ||
    capUpper.includes('BLE') ||
    capUpper.includes('BTLE') ||
    capUpper.includes('BLUETOOTH LOW ENERGY')
  ) {
    return 'E';
  }

  if (ssidUpper.includes('BLUETOOTH') || capUpper.includes('BLUETOOTH')) {
    if (!capUpper.includes('LOW ENERGY') && !capUpper.includes('BLE')) {
      return 'B';
    }
    return 'E';
  }

  if (frequency) {
    const freq = parseInt(String(frequency), 10);

    if (freq >= 2412 && freq <= 2484) {
      return 'W';
    }

    if (freq >= 5000 && freq <= 5900) {
      return 'W';
    }

    if (freq >= 5925 && freq <= 7125) {
      return 'W';
    }
  }

  if (
    capUpper.includes('WPA') ||
    capUpper.includes('WEP') ||
    capUpper.includes('WPS') ||
    capUpper.includes('RSN') ||
    capUpper.includes('ESS') ||
    capUpper.includes('CCMP') ||
    capUpper.includes('TKIP')
  ) {
    return 'W';
  }

  return '?';
}

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
      first_seen: row.first_seen || row.observed_at,
      last_seen: row.last_seen || row.observed_at,
      timestamp: row.last_seen || row.observed_at,
      manufacturer: row.manufacturer || 'Unknown',
      device_type: 'Unknown',
      type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
      channel: frequencyToChannel(row.frequency),
      frequency: row.frequency || null,
      capabilities: row.capabilities || '',
      encryption: row.capabilities || 'Open/Unknown',
      altitude: row.last_altitude_m ?? null,
      accuracy: row.accuracy_meters ?? null,
      obs_count: row.observations || 0,
      threat_level: row.threat?.level || null,
      threat_score: row.threat?.score || null,
      distance_from_home: row.distance_from_home_km || null,
      max_distance_km: row.max_distance_meters ? row.max_distance_meters / 1000 : null,
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
    (row) => ({
      bssid: row.bssid,
      ssid: row.ssid || 'Hidden Network',
      bestlevel: row.level || 0,
      signal: row.level || 0,
      first_seen: row.time,
      last_seen: row.time,
      timestamp: row.time,
      manufacturer: row.manufacturer || 'Unknown',
      device_type: 'Unknown',
      type: inferRadioType(row.radio_type, row.ssid, row.radio_frequency, row.radio_capabilities),
      channel: frequencyToChannel(row.radio_frequency),
      frequency: row.radio_frequency || null,
      capabilities: row.radio_capabilities || '',
      encryption: row.radio_capabilities || 'Open/Unknown',
      device_id: row.device_id,
      source_tag: row.source_tag,
      altitude: row.altitude,
      accuracy: row.accuracy,
      threat_level: row.threat_level || null,
      threat_score: row.threat_score || null,
      distance_from_home: row.distance_from_home_km || null,
    })
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
      first_seen: row.first_seen || row.first_observed_at,
      last_seen: row.last_seen || row.last_observed_at,
      timestamp: row.last_seen || row.last_observed_at,
      manufacturer: row.manufacturer || 'Unknown',
      device_type: 'Unknown',
      type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
      channel: frequencyToChannel(row.frequency),
      frequency: row.frequency || null,
      capabilities: row.capabilities || '',
      encryption: row.capabilities || 'Open/Unknown',
      altitude: row.last_altitude_m ?? null,
      accuracy: row.accuracy_meters ?? null,
      obs_count: row.observations || 0,
      observation_count: row.observations || 0,
      observations: row.observations || 0,
      threat_level: row.threat?.level || null,
      threat_score: row.threat?.score || null,
      distance_from_home: row.distance_from_home_km || null,
      max_distance_km: row.max_distance_meters ? row.max_distance_meters / 1000 : null,
      timespan_days:
        row.first_seen && row.last_seen
          ? Math.ceil(
              ((new Date(row.last_seen as string) as unknown as number) -
                (new Date(row.first_seen as string) as unknown as number)) /
                86400000
            )
          : null,
      unique_days: row.unique_days || null,
    })
  );
