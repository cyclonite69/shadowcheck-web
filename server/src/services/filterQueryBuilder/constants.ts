/**
 * Filter Query Builder Constants
 * Centralized filter keys, defaults, and configuration values.
 */

export const NOISE_FLOOR_DBM = -95;
export const MAX_GPS_ACCURACY_METERS = 1000;

export const FILTER_KEYS = [
  'ssid',
  'bssid',
  'manufacturer',
  'radioTypes',
  'frequencyBands',
  'channelMin',
  'channelMax',
  'rssiMin',
  'rssiMax',
  'encryptionTypes',
  'securityFlags',
  'timeframe',
  'temporalScope',
  'observationCountMin',
  'observationCountMax',
  'has_notes',
  'tag_type',
  'wigle_v3_observation_count_min',
  'gpsAccuracyMax',
  'excludeInvalidCoords',
  'qualityFilter',
  'distanceFromHomeMin',
  'distanceFromHomeMax',
  'boundingBox',
  'radiusFilter',
  'threatScoreMin',
  'threatScoreMax',
  'threatCategories',
  'stationaryConfidenceMin',
  'stationaryConfidenceMax',
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

export const DEFAULT_ENABLED: Record<FilterKey, boolean> = FILTER_KEYS.reduce(
  (acc, key) => {
    acc[key] = false;
    return acc;
  },
  {} as Record<FilterKey, boolean>
);

export const RELATIVE_WINDOWS: Record<string, string | null> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: null,
};

export const NETWORK_ONLY_FILTERS = new Set<FilterKey>([
  'ssid',
  'bssid',
  'manufacturer',
  'radioTypes',
  'frequencyBands',
  'channelMin',
  'channelMax',
  'rssiMin',
  'rssiMax',
  'encryptionTypes',
  'securityFlags',
  'observationCountMin',
  'observationCountMax',
  'has_notes',
  'tag_type',
  'wigle_v3_observation_count_min',
  'gpsAccuracyMax',
  'excludeInvalidCoords',
  'distanceFromHomeMin',
  'distanceFromHomeMax',
  'threatScoreMin',
  'threatScoreMax',
  'threatCategories',
]);
