/**
 * Filter Validators
 * Validation logic for filter payloads.
 */

const { NOISE_FLOOR_DBM, MAX_GPS_ACCURACY_METERS } = require('./constants');
const { normalizeEnabled, normalizeFilters } = require('./normalizers');

const validateFilterPayload = (filters, enabled) => {
  const errors = [];
  const normalized = normalizeFilters(filters);
  const flags = normalizeEnabled(enabled);

  if (flags.rssiMin && normalized.rssiMin < NOISE_FLOOR_DBM) {
    errors.push(`RSSI minimum below noise floor (${NOISE_FLOOR_DBM} dBm).`);
  }
  if (flags.rssiMax && normalized.rssiMax > 0) {
    errors.push('RSSI maximum above 0 dBm.');
  }
  if (flags.rssiMin && flags.rssiMax && normalized.rssiMin > normalized.rssiMax) {
    errors.push('RSSI minimum greater than maximum.');
  }
  if (flags.gpsAccuracyMax && normalized.gpsAccuracyMax > MAX_GPS_ACCURACY_METERS) {
    errors.push('GPS accuracy limit too high (>1000m).');
  }
  if (flags.threatScoreMin && (normalized.threatScoreMin < 0 || normalized.threatScoreMin > 100)) {
    errors.push('Threat score minimum out of range (0-100).');
  }
  if (flags.threatScoreMax && (normalized.threatScoreMax < 0 || normalized.threatScoreMax > 100)) {
    errors.push('Threat score maximum out of range (0-100).');
  }
  if (
    flags.stationaryConfidenceMin &&
    (normalized.stationaryConfidenceMin < 0 || normalized.stationaryConfidenceMin > 1)
  ) {
    errors.push('Stationary confidence minimum out of range (0.0-1.0).');
  }
  if (
    flags.stationaryConfidenceMax &&
    (normalized.stationaryConfidenceMax < 0 || normalized.stationaryConfidenceMax > 1)
  ) {
    errors.push('Stationary confidence maximum out of range (0.0-1.0).');
  }
  return { errors, filters: normalized, enabled: flags };
};

module.exports = {
  validateFilterPayload,
};
