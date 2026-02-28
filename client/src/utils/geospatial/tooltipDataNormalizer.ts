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

  const encryption = pickFirst(raw.security, raw.encryption, raw.capabilities);

  return {
    ssid: pickFirst(raw.ssid, raw.name, 'Hidden'),
    bssid: pickFirst(raw.bssid, raw.netid, 'UNKNOWN'),
    type: pickFirst(raw.type, '?'),
    threat_level: pickFirst(raw.threat_level, raw.threat, 'NONE'),
    threat_score: Number(pickFirst(raw.threat_score, 0)),
    signal: toNumberOrNull(pickFirst(raw.signal, raw.level, raw.bestlevel, raw.rssi)),
    security: encryption ? formatSecurity(String(encryption), 'Unknown') : null,
    frequency: toNumberOrNull(raw.frequency),
    channel: toNumberOrNull(raw.channel),
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
  };
};
