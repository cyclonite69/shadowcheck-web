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
  'wigle_v3_observation_count_max',
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
  'geocodedAddress',
  'geocodedCity',
  'geocodedState',
  'geocodedPostalCode',
  'geocodedCountry',
  'geocodedPoiName',
  'geocodedPoiCategory',
  'geocodedFeatureType',
  'geocodedProvider',
  'geocodedConfidenceMin',
  'geocodedConfidenceMax',
  'uniqueDaysMin',
  'uniqueDaysMax',
  'uniqueLocationsMin',
  'uniqueLocationsMax',
  'ruleBasedScoreMin',
  'ruleBasedScoreMax',
  'mlThreatScoreMin',
  'mlThreatScoreMax',
  'mlWeightMin',
  'mlWeightMax',
  'mlBoostMin',
  'mlBoostMax',
  'modelVersion',
  'maxDistanceMetersMin',
  'maxDistanceMetersMax',
  'wigleV3LastImportBefore',
  'wigleV3LastImportAfter',
  'surveillance',
  'shotspotter',
  'bwc',
  'dashcam',
  'residential_cam',
  'flock',
  'deviceClass',
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
  // 'manufacturer', // Removed: MV doesn't have this column, needs radio_manufacturers join
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
  'wigle_v3_observation_count_max',
  'gpsAccuracyMax',
  'excludeInvalidCoords',
  // NOTE: qualityFilter removed - now handled at database level before MV refresh
  'distanceFromHomeMin',
  'distanceFromHomeMax',
  'threatScoreMin',
  'threatScoreMax',
  'threatCategories',
  // timeframe removed - must remain observation-level for forensic precision
  'stationaryConfidenceMin', // Use ne.stationary_confidence from MV
  'stationaryConfidenceMax', // Use ne.stationary_confidence from MV
  'geocodedAddress',
  'geocodedCity',
  'geocodedState',
  'geocodedPostalCode',
  'geocodedCountry',
  'geocodedPoiName',
  'geocodedPoiCategory',
  'geocodedFeatureType',
  'geocodedProvider',
  'geocodedConfidenceMin',
  'geocodedConfidenceMax',
  'uniqueDaysMin',
  'uniqueDaysMax',
  'uniqueLocationsMin',
  'uniqueLocationsMax',
  'ruleBasedScoreMin',
  'ruleBasedScoreMax',
  'mlThreatScoreMin',
  'mlThreatScoreMax',
  'mlWeightMin',
  'mlWeightMax',
  'mlBoostMin',
  'mlBoostMax',
  'modelVersion',
  'maxDistanceMetersMin',
  'maxDistanceMetersMax',
  'wigleV3LastImportBefore',
  'wigleV3LastImportAfter',
  'surveillance',
  // deviceClass is network-only: filter uses EXISTS subqueries against
  // surveillance_detections + oui_device_groups, both joinable from ne.bssid
  'deviceClass',
]);
