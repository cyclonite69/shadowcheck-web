/**
 * WiGLE API Specification
 * Single source of truth for valid endpoints and parameters per WiGLE swagger spec.
 * Retrieved from: https://api.wigle.net/swagger.json
 */

export {};

export class WigleValidationError extends Error {
  constructor(
    message: string,
    public readonly invalidKey?: string,
    public readonly invalidValue?: string
  ) {
    super(message);
    this.name = 'WigleValidationError';
  }
}

/**
 * Valid WiGLE API endpoints (from official swagger spec)
 */
export const WIGLE_ENDPOINTS = {
  // Search endpoints (v2 only — WiGLE has no v3 network search endpoint per spec)
  NETWORK_SEARCH: '/api/v2/network/search',

  // Detail endpoints (v3 only)
  WIFI_DETAIL: '/api/v3/detail/wifi',
  BT_DETAIL: '/api/v3/detail/bt',

  // Profile/stats endpoints
  PROFILE_USER: '/api/v2/profile/user',
} as const;

/**
 * Validator functions for each parameter type
 */
const validators = {
  mac: (value: string): boolean => {
    // MAC address: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX (case insensitive)
    return /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/.test(value);
  },

  latitude: (value: string): boolean => {
    const num = parseFloat(value);
    return Number.isFinite(num) && num >= -90 && num <= 90;
  },

  longitude: (value: string): boolean => {
    const num = parseFloat(value);
    return Number.isFinite(num) && num >= -180 && num <= 180;
  },

  iso3166: (value: string): boolean => {
    // ISO 3166-1 alpha-2 country codes (exactly 2 uppercase letters)
    return /^[A-Z]{2}$/.test(value);
  },

  positiveInteger: (value: string): boolean => {
    const num = parseInt(value, 10);
    return Number.isFinite(num) && num > 0 && num <= 1000;
  },

  stringMaxLength:
    (maxLen: number) =>
    (value: string): boolean => {
      return value.length <= maxLen;
    },

  cursorString: (value: string): boolean => {
    // Opaque string cursor from WiGLE API response
    // Must be non-empty and reasonably short (arbitrary but defensive)
    return value.length > 0 && value.length <= 1000;
  },
};

/**
 * Definition of every valid query parameter for /api/v2/network/search
 * (from WiGLE swagger spec: https://api.wigle.net/swagger.json)
 */
export const WIGLE_SEARCH_PARAMS = {
  ssidlike: {
    type: 'string' as const,
    required: false,
    description: 'Network name wildcard filter (% for any string, _ for single char)',
    validator: validators.stringMaxLength(100),
  },

  netid: {
    type: 'string' as const,
    required: false,
    description: 'MAC address of network (full or first 3 octets)',
    validator: validators.mac,
  },

  latrange1: {
    type: 'number' as const,
    required: false,
    description: 'Lesser of two latitudes (-90 to +90)',
    validator: validators.latitude,
  },

  latrange2: {
    type: 'number' as const,
    required: false,
    description: 'Greater of two latitudes (-90 to +90)',
    validator: validators.latitude,
  },

  longrange1: {
    type: 'number' as const,
    required: false,
    description: 'Lesser of two longitudes (-180 to +180)',
    validator: validators.longitude,
  },

  longrange2: {
    type: 'number' as const,
    required: false,
    description: 'Greater of two longitudes (-180 to +180)',
    validator: validators.longitude,
  },

  country: {
    type: 'string' as const,
    required: false,
    description: 'ISO 3166-1 alpha-2 country code (2 uppercase letters)',
    validator: validators.iso3166,
  },

  region: {
    type: 'string' as const,
    required: false,
    description: 'Street address region/state',
    validator: validators.stringMaxLength(50),
  },

  city: {
    type: 'string' as const,
    required: false,
    description: 'Street address city',
    validator: validators.stringMaxLength(100),
  },

  resultsPerPage: {
    type: 'number' as const,
    required: false,
    description: 'Results per page (1-1000)',
    validator: validators.positiveInteger,
  },

  searchAfter: {
    type: 'string' as const,
    required: false,
    description: 'Opaque cursor from previous response for pagination',
    validator: validators.cursorString,
  },
} as const;

type ParamKey = keyof typeof WIGLE_SEARCH_PARAMS;

/**
 * Validate that all parameters in a URLSearchParams are valid for /api/v2/network/search
 * Throws WigleValidationError if any parameter is invalid.
 *
 * @param params URLSearchParams to validate
 * @throws {WigleValidationError} if a parameter is not in spec or value fails validation
 */
export function validateWigleSearchParams(params: URLSearchParams): void {
  for (const [key, value] of params.entries()) {
    // Check if parameter is in spec
    if (!(key in WIGLE_SEARCH_PARAMS)) {
      throw new WigleValidationError(
        `Parameter "${key}" not in WiGLE /api/v2/network/search spec`,
        key,
        value
      );
    }

    // Validate parameter value
    const paramSpec = WIGLE_SEARCH_PARAMS[key as ParamKey];
    if (!paramSpec.validator(value)) {
      throw new WigleValidationError(
        `Parameter "${key}" value "${value}" failed validation: ${paramSpec.description}`,
        key,
        value
      );
    }
  }
}
