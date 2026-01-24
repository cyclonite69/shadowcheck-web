/**
 * Filter Query Builder Constants
 * Centralized filter keys, defaults, and configuration values.
 */

const NOISE_FLOOR_DBM = -95;
const MAX_GPS_ACCURACY_METERS = 1000;

const FILTER_KEYS = [
  'ssid',
  'bssid',
  'manufacturer',
  'networkId',
  'radioTypes',
  'frequencyBands',
  'channelMin',
  'channelMax',
  'rssiMin',
  'rssiMax',
  'encryptionTypes',
  'authMethods',
  'insecureFlags',
  'securityFlags',
  'timeframe',
  'temporalScope',
  'observationCountMin',
  'observationCountMax',
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
];

const DEFAULT_ENABLED = FILTER_KEYS.reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {});

const RELATIVE_WINDOWS = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: null,
};

const NETWORK_ONLY_FILTERS = new Set([
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
  'gpsAccuracyMax',
  'excludeInvalidCoords',
  'distanceFromHomeMin',
  'distanceFromHomeMax',
  'threatScoreMin',
  'threatScoreMax',
  'threatCategories',
]);

module.exports = {
  NOISE_FLOOR_DBM,
  MAX_GPS_ACCURACY_METERS,
  FILTER_KEYS,
  DEFAULT_ENABLED,
  RELATIVE_WINDOWS,
  NETWORK_ONLY_FILTERS,
};
