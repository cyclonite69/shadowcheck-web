/**
 * Filter → URLSearchParams assembly helpers.
 * Extracted from useNetworkData.ts to make the logic independently testable.
 *
 * The live-distance block is intentionally kept in the hook because it reads
 * live Zustand state that cannot be passed into a pure function without coupling.
 */

// Parse a value to a finite number, or null if unparseable / non-finite / absent.
export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Parse a relative time window string (e.g. "30d", "12h", "2mo", "1y") to milliseconds.
// Returns null when the string is unrecognised or malformed.
export function parseRelativeTimeframeToMs(relativeWindow: string): number | null {
  const unit = relativeWindow.slice(-2) === 'mo' ? 'mo' : relativeWindow.slice(-1);
  const value = parseInt(relativeWindow.slice(0, unit === 'mo' ? -2 : -1), 10);
  if (Number.isNaN(value)) return null;

  if (unit === 'h') return value * 3600000;
  if (unit === 'm') return value * 60000;
  if (unit === 'mo') return value * 30.44 * 86400000;
  if (unit === 'y') return value * 365 * 86400000;
  return value * 86400000; // default: days
}

// Append all standard filter parameters to an existing URLSearchParams instance.
// Mutates `params` in-place (caller appends baseline params first).
export function appendNetworkFilterParams(
  params: URLSearchParams,
  filters: Record<string, any>,
  enabled: Record<string, boolean>
): void {
  if (enabled.ssid && filters.ssid) {
    params.set('ssid', String(filters.ssid));
  }
  if (enabled.bssid && filters.bssid) {
    params.set('bssid', String(filters.bssid));
  }
  if (enabled.radioTypes && Array.isArray(filters.radioTypes) && filters.radioTypes.length > 0) {
    params.set('radioTypes', filters.radioTypes.join(','));
  }
  if (
    enabled.encryptionTypes &&
    Array.isArray(filters.encryptionTypes) &&
    filters.encryptionTypes.length > 0
  ) {
    params.set('encryptionTypes', filters.encryptionTypes.join(','));
  }
  if (
    enabled.securityFlags &&
    Array.isArray(filters.securityFlags) &&
    filters.securityFlags.length > 0
  ) {
    params.set('securityFlags', filters.securityFlags.join(','));
  }
  if (enabled.rssiMin && filters.rssiMin !== undefined) {
    params.set('min_signal', String(filters.rssiMin));
  }
  if (enabled.rssiMax && filters.rssiMax !== undefined) {
    params.set('max_signal', String(filters.rssiMax));
  }
  if (enabled.observationCountMin && filters.observationCountMin !== undefined) {
    params.set('min_obs_count', String(filters.observationCountMin));
  }
  if (enabled.observationCountMax && filters.observationCountMax !== undefined) {
    params.set('max_obs_count', String(filters.observationCountMax));
  }
  if (
    enabled.threatCategories &&
    Array.isArray(filters.threatCategories) &&
    filters.threatCategories.length > 0
  ) {
    params.set('threat_categories', JSON.stringify(filters.threatCategories));
  }

  const maxDistance = toFiniteNumber(filters.distanceFromHomeMax);
  if (enabled.distanceFromHomeMax && maxDistance !== null) {
    params.set('distance_from_home_km_max', String(maxDistance / 1000));
  }
  const minDistance = toFiniteNumber(filters.distanceFromHomeMin);
  if (enabled.distanceFromHomeMin && minDistance !== null) {
    params.set('distance_from_home_km_min', String(minDistance / 1000));
  }

  // Bounding box filter
  if (enabled.boundingBox && filters.boundingBox) {
    const { north, south, east, west } = filters.boundingBox;
    const minLat = toFiniteNumber(south);
    const maxLat = toFiniteNumber(north);
    const minLng = toFiniteNumber(west);
    const maxLng = toFiniteNumber(east);

    if (
      minLat !== null &&
      maxLat !== null &&
      minLng !== null &&
      maxLng !== null &&
      minLat >= -90 &&
      maxLat <= 90 &&
      minLat <= maxLat &&
      minLng >= -180 &&
      maxLng <= 180 &&
      minLng <= maxLng
    ) {
      params.set('bbox_min_lat', String(minLat));
      params.set('bbox_max_lat', String(maxLat));
      params.set('bbox_min_lng', String(minLng));
      params.set('bbox_max_lng', String(maxLng));
    }
  }

  // Radius filter
  if (enabled.radiusFilter && filters.radiusFilter) {
    const { latitude, longitude, radiusMeters } = filters.radiusFilter;
    const centerLat = toFiniteNumber(latitude);
    const centerLng = toFiniteNumber(longitude);
    const radius = toFiniteNumber(radiusMeters);

    if (
      centerLat !== null &&
      centerLng !== null &&
      radius !== null &&
      centerLat >= -90 &&
      centerLat <= 90 &&
      centerLng >= -180 &&
      centerLng <= 180 &&
      radius > 0
    ) {
      params.set('radius_center_lat', String(centerLat));
      params.set('radius_center_lng', String(centerLng));
      params.set('radius_meters', String(radius));
    }
  }
}
