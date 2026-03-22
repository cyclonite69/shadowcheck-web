import type { NetworkData } from '../components/kepler/types';

type GeoFeature = {
  geometry?: {
    coordinates?: unknown[];
  };
  properties?: Record<string, unknown>;
};

type KeplerGeoJsonLike = {
  features?: GeoFeature[];
};

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toPosition = (feature: GeoFeature): [number, number] | null => {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = toNumber(coords[0], NaN);
  const lat = toNumber(coords[1], NaN);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
};

export function mapKeplerFeatureToNetworkData(feature: GeoFeature): NetworkData | null {
  const position = toPosition(feature);
  if (!position) return null;
  const props = feature.properties || {};
  const [lon, lat] = position;

  const signal = toNumber(props.signal ?? props.rssi, -100);
  const level = toNumber(props.level ?? props.signal, -100);

  return {
    ...props,
    position,
    lon,
    lat,
    longitude: lon,
    latitude: lat,
    bssid: String(props.bssid || ''),
    ssid: String(props.ssid || 'Hidden'),
    type: String(props.type || 'unknown'),
    signal,
    level,
    encryption: String(props.encryption || props.security || 'Unknown'),
    channel: toNumber(props.channel, 0),
    frequency: toNumber(props.frequency, 0),
    manufacturer: String(props.manufacturer || 'Unknown'),
    device_type: String(props.device_type || props.type || 'unknown'),
    capabilities: String(props.capabilities || props.security || 'Unknown'),
    threat_level: String(props.threat_level || 'none'),
    threat_score: toOptionalNumber(props.threat_score),
    timestamp: String(props.timestamp || props.time || ''),
    last_seen: String(props.last_seen || props.time || ''),
    obs_count: toOptionalNumber(props.obs_count ?? props.observation_count),
    distance_from_home: toOptionalNumber(props.distance_from_home),
    accuracy: toOptionalNumber(props.accuracy),
    altitude: toOptionalNumber(props.altitude),
  };
}

export function mapKeplerGeoJsonToNetworkData(geojson: KeplerGeoJsonLike): NetworkData[] {
  const features = Array.isArray(geojson.features) ? geojson.features : [];
  return features
    .map(mapKeplerFeatureToNetworkData)
    .filter((row): row is NetworkData => Boolean(row));
}
