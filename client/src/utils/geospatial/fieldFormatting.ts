/**
 * SIGINT Intel Table Field Formatting
 *
 * All functions preserve raw values; formatting is display-only.
 * Source values remain unmodified in DB and component state.
 */

const EM_DASH = '—';

/** Latitude/Longitude — detail view (5 decimals ≈ 1m precision) */
export const formatCoord = (value?: number | null, places = 5): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EM_DASH;
  }
  return value.toFixed(places);
};

/** Convenience: format lat/lon pair */
export const formatCoordinates = (lat?: number | null, lon?: number | null, places = 5): string => {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return EM_DASH;
  }
  return `${formatCoord(lat, places)}, ${formatCoord(lon, places)}`;
};

/** Overview table variant: 4 decimals (≈ 11m precision) */
export const formatCoordOverview = (value?: number | null): string => formatCoord(value, 4);

/** Altitude (meters, whole number) */
export const formatAltitude = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EM_DASH;
  }
  return `${Math.round(value)} m`;
};

/** Accuracy (meters, whole number) */
export const formatAccuracy = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EM_DASH;
  }
  return `${Math.round(value)} m`;
};

/** RSSI signal strength (dBm, integer) */
export const formatRSSI = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EM_DASH;
  }
  return `${Math.round(value)} dBm`;
};

/** Heading/Bearing (degrees, 0 decimals) */
export const formatHeading = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EM_DASH;
  }
  return `${Math.round(value)}°`;
};

/** Confidence/Quality Score (0–1 scale → percentage, or raw 1-decimal) */
export const formatConfidence = (value?: number | null, asPercentage = false): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EM_DASH;
  }
  if (asPercentage) {
    return `${Math.round(value <= 1 ? value * 100 : value)}%`;
  }
  return value.toFixed(1);
};

/** Timestamp — clean human-readable "2026-03-30 14:25:03" */
export const formatTimestamp = (value?: string | number | Date | null): string => {
  if (!value) {
    return EM_DASH;
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return EM_DASH;
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

/** DateTime for tooltip display — "2026-02-08 02:42:50" (local time, full seconds precision) */
export const formatDateTime = (value?: string | number | Date | null): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const date = typeof value === 'number' ? new Date(value) : new Date(value as string | Date);
  if (isNaN(date.getTime())) {
    return '—';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
