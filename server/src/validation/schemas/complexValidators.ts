/**
 * Complex Validators
 * Advanced validation functions that combine multiple rules
 */

import { validateString, validateEnum, validateIntegerRange } from './commonSchemas';
import { validateLatitude, validateLongitude, validateBoundingBox } from './geospatialSchemas';
import { validateTimestamp } from './temporalSchemas';
import {
  validateBSSID,
  validateSSID,
  validateNetworkType,
  validateAuthenticationType,
  validateEncryptionType,
  validateSignalStrength,
} from './networkSchemas';

/**
 * Validates confidence score (0-100).
 * @param confidence - The confidence score
 * @returns { valid: boolean, error?: string, value?: number }
 */
export function validateConfidence(confidence: unknown): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  return validateIntegerRange(confidence, 0, 100, 'Confidence');
}

/**
 * Validates severity score (0-100).
 * @param severity - The severity score
 * @returns { valid: boolean, error?: string, value?: number }
 */
export function validateSeverity(severity: unknown): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  return validateIntegerRange(severity, 0, 100, 'Severity');
}

/**
 * Validates threat level (LOW, MEDIUM, HIGH, CRITICAL).
 * @param threatLevel - The threat level
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateThreatLevel(threatLevel: unknown): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  return validateEnum(threatLevel, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 'Threat level');
}

/**
 * Validates network status (ACTIVE, INACTIVE, UNKNOWN).
 * @param status - The network status
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateNetworkStatus(status: unknown): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  return validateEnum(status, ['ACTIVE', 'INACTIVE', 'UNKNOWN'], 'Network status');
}

/**
 * Validates location object with lat/lng.
 * @param location - Object with latitude and longitude
 * @returns { valid: boolean, error?: string, value?: { lat: number; lng: number } }
 */
export function validateLocation(location: {
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
}): {
  valid: boolean;
  error?: string;
  value?: { lat: number; lng: number };
} {
  const lat = location.latitude ?? location.lat;
  const lng = location.longitude ?? location.lng;

  if (lat === undefined || lng === undefined) {
    return { valid: false, error: 'Latitude and longitude are required' };
  }

  const latValidation = validateLatitude(lat);
  const lngValidation = validateLongitude(lng);

  if (!latValidation.valid) {
    return { valid: false, error: latValidation.error };
  }

  if (!lngValidation.valid) {
    return { valid: false, error: lngValidation.error };
  }

  return {
    valid: true,
    value: { lat: latValidation.value as number, lng: lngValidation.value as number },
  };
}

/**
 * Validates complete network object for creation.
 * @param network - Network object to validate
 * @returns { valid: boolean, error?: string, value?: object }
 */
export function validateNetworkForCreate(network: {
  bssid?: string;
  ssid?: string;
  latitude?: number | string;
  longitude?: number | string;
  status?: string;
}): {
  valid: boolean;
  error?: string;
  value?: Record<string, unknown>;
} {
  const errors: string[] = [];

  const bssidValidation = validateBSSID(network.bssid ?? '');
  if (!bssidValidation.valid) {
    errors.push(`BSSID: ${bssidValidation.error}`);
  }

  const ssidValidation = validateSSID(network.ssid ?? '');
  if (!ssidValidation.valid) {
    errors.push(`SSID: ${ssidValidation.error}`);
  }

  const locationValidation = validateLocation({
    latitude: network.latitude,
    longitude: network.longitude,
  });
  if (!locationValidation.valid) {
    errors.push(`Location: ${locationValidation.error}`);
  }

  if (network.status !== undefined) {
    const statusValidation = validateNetworkStatus(network.status);
    if (!statusValidation.valid) {
      errors.push(`Status: ${statusValidation.error}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return {
    valid: true,
    value: {
      bssid: bssidValidation.cleaned,
      ssid: ssidValidation.cleaned,
      latitude: locationValidation.value?.lat,
      longitude: locationValidation.value?.lng,
      status: network.status ?? 'UNKNOWN',
    },
  };
}

/**
 * Validates observation object.
 * @param observation - Observation object to validate
 * @returns { valid: boolean, error?: string, value?: object }
 */
export function validateObservation(observation: {
  bssid?: string;
  ssid?: string;
  signal?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  timestamp?: string | Date;
}): {
  valid: boolean;
  error?: string;
  value?: Record<string, unknown>;
} {
  const errors: string[] = [];

  const bssidValidation = validateBSSID(observation.bssid ?? '');
  if (!bssidValidation.valid) {
    errors.push(`BSSID: ${bssidValidation.error}`);
  }

  if (observation.ssid !== undefined) {
    const ssidValidation = validateSSID(observation.ssid);
    if (!ssidValidation.valid) {
      errors.push(`SSID: ${ssidValidation.error}`);
    }
  }

  if (observation.signal !== undefined) {
    const signalValidation = validateSignalStrength(observation.signal);
    if (!signalValidation.valid) {
      errors.push(`Signal: ${signalValidation.error}`);
    }
  }

  if (observation.latitude !== undefined || observation.longitude !== undefined) {
    const locationValidation = validateLocation({
      latitude: observation.latitude,
      longitude: observation.longitude,
    });
    if (!locationValidation.valid) {
      errors.push(`Location: ${locationValidation.error}`);
    }
  }

  if (observation.timestamp !== undefined) {
    const timestampValidation = validateTimestamp(observation.timestamp);
    if (!timestampValidation.valid) {
      errors.push(`Timestamp: ${timestampValidation.error}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return {
    valid: true,
    value: {
      bssid: bssidValidation.cleaned,
      ssid: observation.ssid,
      signal: observation.signal,
      latitude: observation.latitude,
      longitude: observation.longitude,
      timestamp: observation.timestamp,
    },
  };
}

/**
 * Validates tag object for creation/update.
 * @param tag - Tag object to validate
 * @returns { valid: boolean, error?: string, value?: object }
 */
export function validateTag(tag: {
  bssid?: string;
  tagType?: string;
  confidence?: unknown;
  threatLevel?: string;
  notes?: string;
}): {
  valid: boolean;
  error?: string;
  value?: Record<string, unknown>;
} {
  const errors: string[] = [];

  const bssidValidation = validateBSSID(tag.bssid ?? '');
  if (!bssidValidation.valid) {
    errors.push(`BSSID: ${bssidValidation.error}`);
  }

  if (tag.tagType !== undefined) {
    const validTags = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];
    const tagTypeValidation = validateEnum(tag.tagType, validTags, 'Tag type');
    if (!tagTypeValidation.valid) {
      errors.push(tagTypeValidation.error);
    }
  }

  if (tag.confidence !== undefined) {
    const confidenceValidation = validateConfidence(tag.confidence);
    if (!confidenceValidation.valid) {
      errors.push(`Confidence: ${confidenceValidation.error}`);
    }
  }

  if (tag.threatLevel !== undefined) {
    const threatLevelValidation = validateThreatLevel(tag.threatLevel);
    if (!threatLevelValidation.valid) {
      errors.push(`Threat level: ${threatLevelValidation.error}`);
    }
  }

  if (tag.notes !== undefined) {
    const notesValidation = validateString(tag.notes, 'Notes');
    if (!notesValidation.valid) {
      errors.push(`Notes: ${notesValidation.error}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return {
    valid: true,
    value: {
      bssid: bssidValidation.cleaned,
      tagType: tag.tagType,
      confidence: tag.confidence,
      threatLevel: tag.threatLevel,
      notes: tag.notes,
    },
  };
}

/**
 * Validates filter object.
 * @param filters - Filter object to validate
 * @returns { valid: boolean, error?: string, value?: object }
 */
export function validateFilters(filters: {
  bssid?: string;
  ssid?: string;
  boundingBox?: number[] | string;
  status?: string;
  networkType?: string;
  authentication?: string;
  encryption?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  minSignal?: number | string;
  maxSignal?: number | string;
}): {
  valid: boolean;
  error?: string;
  value?: Record<string, unknown>;
} {
  const errors: string[] = [];
  const validFilters: Record<string, unknown> = {};

  if (filters.bssid !== undefined) {
    const bssidValidation = validateBSSID(filters.bssid);
    if (!bssidValidation.valid) {
      errors.push(`BSSID: ${bssidValidation.error}`);
    } else {
      validFilters.bssid = bssidValidation.cleaned;
    }
  }

  if (filters.ssid !== undefined) {
    const ssidValidation = validateSSID(filters.ssid);
    if (!ssidValidation.valid) {
      errors.push(`SSID: ${ssidValidation.error}`);
    } else {
      validFilters.ssid = ssidValidation.cleaned;
    }
  }

  if (filters.boundingBox !== undefined) {
    const bboxValidation = validateBoundingBox(filters.boundingBox);
    if (!bboxValidation.valid) {
      errors.push(`Bounding box: ${bboxValidation.error}`);
    } else {
      validFilters.boundingBox = bboxValidation.value;
    }
  }

  if (filters.status !== undefined) {
    const statusValidation = validateNetworkStatus(filters.status);
    if (!statusValidation.valid) {
      errors.push(`Status: ${statusValidation.error}`);
    } else {
      validFilters.status = statusValidation.value;
    }
  }

  if (filters.networkType !== undefined) {
    const typeValidation = validateNetworkType(filters.networkType);
    if (!typeValidation.valid) {
      errors.push(`Network type: ${typeValidation.error}`);
    } else {
      validFilters.networkType = typeValidation.value;
    }
  }

  if (filters.authentication !== undefined) {
    const authValidation = validateAuthenticationType(filters.authentication);
    if (!authValidation.valid) {
      errors.push(`Authentication: ${authValidation.error}`);
    } else {
      validFilters.authentication = authValidation.value;
    }
  }

  if (filters.encryption !== undefined) {
    const encValidation = validateEncryptionType(filters.encryption);
    if (!encValidation.valid) {
      errors.push(`Encryption: ${encValidation.error}`);
    } else {
      validFilters.encryption = encValidation.value;
    }
  }

  if (filters.startDate !== undefined || filters.endDate !== undefined) {
    if (filters.startDate === undefined || filters.endDate === undefined) {
      errors.push('Both startDate and endDate are required for date range filtering');
    } else {
      const startValidation = validateTimestamp(filters.startDate);
      const endValidation = validateTimestamp(filters.endDate);

      if (!startValidation.valid) {
        errors.push(`Start date: ${startValidation.error}`);
      }
      if (!endValidation.valid) {
        errors.push(`End date: ${endValidation.error}`);
      }

      if (startValidation.valid && endValidation.valid) {
        const start = startValidation.value as Date;
        const end = endValidation.value as Date;

        if (start >= end) {
          errors.push('Start date must be before end date');
        } else {
          validFilters.startDate = start;
          validFilters.endDate = end;
        }
      }
    }
  }

  if (filters.minSignal !== undefined) {
    const minSignalValidation = validateSignalStrength(filters.minSignal);
    if (!minSignalValidation.valid) {
      errors.push(`Min signal: ${minSignalValidation.error}`);
    } else {
      validFilters.minSignal = minSignalValidation.value;
    }
  }

  if (filters.maxSignal !== undefined) {
    const maxSignalValidation = validateSignalStrength(filters.maxSignal);
    if (!maxSignalValidation.valid) {
      errors.push(`Max signal: ${maxSignalValidation.error}`);
    } else {
      validFilters.maxSignal = maxSignalValidation.value;
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return { valid: true, value: validFilters };
}
