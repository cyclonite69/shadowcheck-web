import { formatSecurity } from '../wigle';

type AnyRecord = Record<string, any>;

const pickFirst = <T>(...values: T[]): T | null => {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
};

const toNumberOrNull = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function parseCapabilities(caps: string): { encryption: string; wps: boolean; mfpc: boolean } {
  if (!caps) return { encryption: 'Open', wps: false, mfpc: false };
  const lower = caps.toUpperCase();
  const enc =
    lower.includes('WPA3') || lower.includes('SAE')
      ? 'WPA3'
      : lower.includes('WPA2-EAP') || lower.includes('RSN-EAP')
        ? 'WPA2-Enterprise'
        : lower.includes('WPA2') || lower.includes('RSN')
          ? 'WPA2'
          : lower.includes('WPA')
            ? 'WPA'
            : 'Open';
  return {
    encryption: enc,
    wps: lower.includes('WPS'),
    mfpc: lower.includes('MFPC'),
  };
}

function freqToChannel(freq: number): number {
  if (freq >= 2412 && freq <= 2484) return Math.round((freq - 2407) / 5);
  if (freq >= 5180 && freq <= 5825) return Math.round((freq - 5000) / 5);
  if (freq >= 5955) return Math.round((freq - 5955) / 5) + 1;
  return 0;
}

function freqToBand(freq: number): string {
  if (freq === 0) return '';
  if (freq < 3000) return '2.4 GHz';
  if (freq < 6000) return '5 GHz';
  return '6 GHz';
}

/**
 * Normalize mixed network/observation payloads from Geospatial, Kepler, and WiGLE
 * into canonical tooltip fields consumed by renderNetworkTooltip.
 */
export const normalizeTooltipData = (raw: AnyRecord, fallbackPosition?: [number, number]) => {
  const lat = toNumberOrNull(
    pickFirst(raw.lat, raw.latitude, raw.trilat, raw.y, fallbackPosition?.[1])
  );
  const lon = toNumberOrNull(
    pickFirst(
      raw.lon,
      raw.lng,
      raw.longitude,
      raw.trilong,
      raw.trilon,
      raw.x,
      fallbackPosition?.[0]
    )
  );

  const rawCaps = String(pickFirst(raw.security, raw.encryption, raw.capabilities) || '');
  const caps = parseCapabilities(rawCaps);
  const freq = toNumberOrNull(raw.frequency) || 0;

  return {
    ssid: pickFirst(raw.ssid, raw.name, 'Hidden'),
    bssid: pickFirst(raw.bssid, raw.netid, 'UNKNOWN'),
    type: pickFirst(raw.type, '?'),
    radio_type:
      raw.radio_type === 'W'
        ? 'WiFi'
        : raw.radio_type === 'B'
          ? 'Bluetooth'
          : raw.radio_type === 'L'
            ? 'LTE'
            : raw.radio_type || 'WiFi',
    threat_level: pickFirst(raw.threat_level, raw.threat, 'NONE'),
    threat_score: Number(pickFirst(raw.threat_score, 0)),
    signal: toNumberOrNull(pickFirst(raw.signal, raw.level, raw.bestlevel, raw.rssi)),
    security: caps.encryption || formatSecurity(rawCaps, 'Unknown'),
    encryption: caps.encryption,
    wps: caps.wps,
    mfpc: caps.mfpc,
    frequency: freq,
    channel: toNumberOrNull(raw.channel) || freqToChannel(freq),
    band: pickFirst(raw.frequency_band, raw.band) || freqToBand(freq),
    lat,
    lon,
    altitude: toNumberOrNull(raw.altitude),
    manufacturer: pickFirst(raw.manufacturer, 'Unknown'),
    observation_count: Number(
      pickFirst(
        raw.observation_count,
        raw.obs_count,
        raw.observations,
        raw.wigle_v3_observation_count,
        0
      )
    ),
    timespan_days: toNumberOrNull(raw.timespan_days),
    time: pickFirst(raw.time, raw.timestamp, raw.last_seen, raw.lasttime, raw.observed_at),
    first_seen: pickFirst(raw.first_seen, raw.firsttime, raw.first_observed_at, raw.observed_at),
    last_seen: pickFirst(raw.last_seen, raw.lasttime, raw.lastupdt, raw.observed_at),
    distance_from_home_km: toNumberOrNull(
      pickFirst(raw.distance_from_home_km, raw.distance_from_home)
    ),
    max_distance_km: toNumberOrNull(raw.max_distance_km),
    unique_days: toNumberOrNull(raw.unique_days),
    accuracy: toNumberOrNull(pickFirst(raw.accuracy, raw.acc)),
    number: toNumberOrNull(raw.number),
    time_since_prior: pickFirst(raw.time_since_prior, null),
    distance_from_last_point_m: toNumberOrNull(raw.distance_from_last_point_m),
    sibling_count: toNumberOrNull(raw.sibling_count) || 0,
    wigle_match: Boolean(raw.wigle_match),
    is_mobile: Boolean(raw.is_mobile),
    quality_score: toNumberOrNull(raw.quality_score) || 0,
    notes: pickFirst(raw.notes, null),
    city: raw.city || '',
    region: raw.region || '',
    housenumber: raw.housenumber || '',
    road: raw.road || '',
  };
};
