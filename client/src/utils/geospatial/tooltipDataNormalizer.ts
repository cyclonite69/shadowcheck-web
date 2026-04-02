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
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  // Extract first numeric-looking part (handles "2412 MHz", "1,234", etc.)
  const clean = String(value)
    .replace(/,/g, '')
    .match(/[-+]?\d*\.?\d+/);
  if (!clean) return null;

  const n = Number(clean[0]);
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

function normalizeDistanceFromHomeKm(raw: AnyRecord): number | null {
  const explicitKm = toNumberOrNull(raw.distance_from_home_km);
  if (explicitKm !== null) return explicitKm;

  const meters = toNumberOrNull(raw.distance_from_home_meters ?? raw.distance_from_home_m);
  if (meters !== null) return meters / 1000.0;

  const ambiguous = toNumberOrNull(raw.distance_from_home);
  if (ambiguous === null) return null;

  // Older payloads sometimes expose this field in meters despite the generic name.
  return ambiguous > 1000 ? ambiguous / 1000.0 : ambiguous;
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

  const rawCaps = String(
    pickFirst(raw.radio_capabilities, raw.capabilities, raw.security, raw.encryption) || ''
  );
  const caps = parseCapabilities(rawCaps);
  const freq = toNumberOrNull(pickFirst(raw.frequency, raw.radio_frequency)) || 0;
  const rawChan = toNumberOrNull(pickFirst(raw.channel, raw.chan));
  const chan = rawChan || (freq > 0 ? freqToChannel(freq) : 0);
  const canonicalSecurity = formatSecurity(rawCaps, 'Unknown');

  // Calculate quality score if not provided
  // Factor 1: Observation count (up to 20 obs for full points)
  // Factor 2: GPS accuracy (under 10m for full points)
  const obsCount = Number(
    pickFirst(
      raw.observation_count,
      raw.obs_count,
      raw.observations,
      raw.wigle_v3_observation_count,
      0
    )
  );
  const accuracy = toNumberOrNull(pickFirst(raw.accuracy, raw.acc));
  const explicitQuality = toNumberOrNull(pickFirst(raw.quality_score, raw.data_quality));

  const calculatedQuality = (() => {
    if (explicitQuality !== null) {
      return explicitQuality;
    }

    let score = 0;
    // Observations: 0 to 0.6 weight
    score += Math.min(0.6, (obsCount / 20) * 0.6);
    // Accuracy: 0 to 0.4 weight
    if (accuracy !== null) {
      const accBonus = Math.max(0, 0.4 * (1 - accuracy / 50));
      score += accBonus;
    }
    return Math.min(1, score);
  })();

  return {
    ssid: pickFirst(raw.ssid, raw.name, 'Hidden'),
    bssid: pickFirst(raw.bssid, raw.netid, 'UNKNOWN'),
    type: pickFirst(raw.type, '?'),
    radio_type: pickFirst(raw.radio_type, raw.type, '?'),
    threat_level: pickFirst(raw.threat_level, raw.threat, 'NONE'),
    threat_score: Number(pickFirst(raw.threat_score, 0)),
    signal: toNumberOrNull(
      pickFirst(
        raw.signal,
        raw.level,
        raw.bestlevel,
        raw.rssi,
        raw.signalDbm,
        raw.maxSignal,
        raw.max_signal
      )
    ),
    security: canonicalSecurity,
    encryption: canonicalSecurity,
    capabilities_raw: rawCaps || null,
    wps: caps.wps,
    mfpc: caps.mfpc,
    frequency: freq,
    channel: chan,
    band: pickFirst(raw.frequency_band, raw.band) || freqToBand(freq),
    lat,
    lon,
    altitude: toNumberOrNull(raw.altitude),
    manufacturer: pickFirst(raw.manufacturer, 'Unknown'),
    observation_count: obsCount,
    timespan_days: toNumberOrNull(raw.timespan_days),
    time: pickFirst(raw.time, raw.timestamp, raw.last_seen, raw.lasttime, raw.observed_at),
    first_seen: pickFirst(
      raw.first_seen,
      raw.firsttime,
      raw.first,
      raw.first_observed_at,
      raw.observed_at
    ),
    last_seen: pickFirst(raw.last_seen, raw.lasttime, raw.last, raw.lastupdt, raw.observed_at),
    distance_from_home_km: normalizeDistanceFromHomeKm(raw),
    max_distance_km:
      toNumberOrNull(raw.max_distance_km) ??
      (toNumberOrNull(raw.max_distance_meters) !== null
        ? toNumberOrNull(raw.max_distance_meters)! / 1000.0
        : null),
    unique_days: toNumberOrNull(raw.unique_days),
    accuracy,
    number: toNumberOrNull(raw.number),
    time_since_prior: pickFirst(raw.time_since_prior, null),
    distance_from_last_point_m: toNumberOrNull(raw.distance_from_last_point_m),
    sibling_count: toNumberOrNull(raw.sibling_count) || 0,
    wigle_match: Boolean(raw.wigle_match),
    is_mobile: Boolean(raw.is_mobile),
    quality_score: calculatedQuality,
    notes: pickFirst(raw.notes, null),
    city: raw.city || '',
    region: raw.region || '',
    housenumber: raw.housenumber || '',
    road: raw.road || '',
    threat_factors: raw.threat_factors || null,
  };
};
