/**
 * WiGLE Detail — Pure Transform Utilities
 * Stateless helpers for null-byte sanitization, JSON parsing, and API shape mapping.
 */

export const stripNullBytes = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/\u0000/g, '');
  return cleaned === '' ? null : cleaned;
};

export const stripNullBytesKeepEmpty = (value: any): any => {
  if (value === undefined || value === null) return value;
  return String(value).replace(/\u0000/g, '');
};

export const stripNullBytesDeep = (value: any): any => {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') return stripNullBytesKeepEmpty(value);
  if (Array.isArray(value)) return value.map((item) => stripNullBytesDeep(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, stripNullBytesDeep(val)])
    );
  }
  return value;
};

export const parseJsonObject = (value: any): any | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const parseJsonArray = (value: any): any[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export function mapCachedDetailToApiShape(cached: any): any {
  return {
    networkId: cached.netid,
    name: cached.name ?? cached.ssid ?? null,
    ssid: cached.ssid ?? cached.name ?? null,
    encryption: cached.encryption ?? null,
    type: cached.type ?? null,
    channel: cached.channel ?? null,
    firstSeen: cached.first_seen ?? null,
    lastSeen: cached.last_seen ?? null,
    lastUpdate: cached.last_observed_at ?? cached.last_seen ?? null,
    trilateratedLatitude: cached.trilat ?? cached.last_lat ?? null,
    trilateratedLongitude: cached.trilon ?? cached.last_lon ?? null,
    streetAddress: parseJsonObject(cached.street_address),
    locationClusters: parseJsonArray(cached.location_clusters),
    comment: cached.comment ?? null,
    bestClusterWiGLEQoS: cached.qos ?? null,
  };
}

export const inferWigleEndpoint = (networkType: string | null | undefined): 'wifi' | 'bt' => {
  const normalized = String(networkType || '')
    .trim()
    .toUpperCase();
  return normalized === 'B' || normalized === 'E' ? 'bt' : 'wifi';
};

export function parseIncludeTotalFlag(value: any): {
  valid: boolean;
  value?: boolean;
  error?: string;
} {
  if (value === undefined || value === null || value === '') return { valid: true, value: false };
  if (value === '1' || value === 'true') return { valid: true, value: true };
  if (value === '0' || value === 'false') return { valid: true, value: false };
  return { valid: false, error: `Invalid include_total value: ${value}` };
}
