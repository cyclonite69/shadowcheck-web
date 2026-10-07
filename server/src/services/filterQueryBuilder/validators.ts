/**
 * Filter Validators
 * Validation logic for filter payloads.
 */

import { NOISE_FLOOR_DBM, MAX_GPS_ACCURACY_METERS } from './constants';
import { normalizeEnabled, normalizeFilters } from './normalizers';
import type { ValidationResult } from './types';

const validateFilterPayload = (filters: unknown, enabled: unknown): ValidationResult => {
  const errors: string[] = [];
  const normalized = normalizeFilters(filters);
  const flags = normalizeEnabled(enabled);

  if (flags.radiusFilter) {
    const value = normalized.radiusFilter;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push('Radius filter must include latitude, longitude, and radiusMeters.');
    } else {
      const radiusFilter = value as unknown as Record<string, unknown>;
      const latitude = radiusFilter.latitude;
      const longitude = radiusFilter.longitude;
      const radiusMeters = radiusFilter.radiusMeters;

      if (
        typeof latitude !== 'number' ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        errors.push('Radius filter latitude must be a finite number between -90 and 90.');
      }
      if (
        typeof longitude !== 'number' ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        errors.push('Radius filter longitude must be a finite number between -180 and 180.');
      }
      if (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
        errors.push('Radius filter radiusMeters must be a finite number greater than 0.');
      }
    }
  }

  if (flags.rssiMin && normalized.rssiMin !== undefined && normalized.rssiMin < NOISE_FLOOR_DBM) {
    errors.push(`RSSI minimum below noise floor (${NOISE_FLOOR_DBM} dBm).`);
  }
  if (flags.rssiMax && normalized.rssiMax !== undefined && normalized.rssiMax > 0) {
    errors.push('RSSI maximum above 0 dBm.');
  }
  if (
    flags.rssiMin &&
    flags.rssiMax &&
    normalized.rssiMin !== undefined &&
    normalized.rssiMax !== undefined &&
    normalized.rssiMin > normalized.rssiMax
  ) {
    errors.push('RSSI minimum greater than maximum.');
  }
  if (
    flags.gpsAccuracyMax &&
    normalized.gpsAccuracyMax !== undefined &&
    normalized.gpsAccuracyMax > MAX_GPS_ACCURACY_METERS
  ) {
    errors.push('GPS accuracy limit too high (>1000m).');
  }
  if (
    flags.threatScoreMin &&
    normalized.threatScoreMin !== undefined &&
    (normalized.threatScoreMin < 0 || normalized.threatScoreMin > 100)
  ) {
    errors.push('Threat score minimum out of range (0-100).');
  }
  if (
    flags.threatScoreMax &&
    normalized.threatScoreMax !== undefined &&
    (normalized.threatScoreMax < 0 || normalized.threatScoreMax > 100)
  ) {
    errors.push('Threat score maximum out of range (0-100).');
  }
  if (
    flags.stationaryConfidenceMin &&
    normalized.stationaryConfidenceMin !== undefined &&
    (normalized.stationaryConfidenceMin < 0 || normalized.stationaryConfidenceMin > 1)
  ) {
    errors.push('Stationary confidence minimum out of range (0.0-1.0).');
  }
  if (
    flags.stationaryConfidenceMax &&
    normalized.stationaryConfidenceMax !== undefined &&
    (normalized.stationaryConfidenceMax < 0 || normalized.stationaryConfidenceMax > 1)
  ) {
    errors.push('Stationary confidence maximum out of range (0.0-1.0).');
  }
  if (
    flags.wigle_v3_observation_count_min &&
    normalized.wigle_v3_observation_count_min !== undefined &&
    normalized.wigle_v3_observation_count_min < 0
  ) {
    errors.push('WiGLE v3 observation count minimum cannot be negative.');
  }
  return { errors, filters: normalized, enabled: flags };
};

export { validateFilterPayload };
