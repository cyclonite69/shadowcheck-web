/**
 * Geospatial Validation Schemas
 * Location and coordinate validation functions
 */

/**
 * Validates latitude value.
 * @param latitude - The latitude to validate
 * @returns { valid: boolean, error?: string, value?: number }
 */
export function validateLatitude(latitude: number | string): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  const value = parseFloat(String(latitude));

  if (isNaN(value)) {
    return { valid: false, error: 'Latitude must be a number' };
  }

  if (value < -90 || value > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }

  return { valid: true, value };
}

/**
 * Validates longitude value.
 * @param longitude - The longitude to validate
 * @returns { valid: boolean, error?: string, value?: number }
 */
export function validateLongitude(longitude: number | string): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  const value = parseFloat(String(longitude));

  if (isNaN(value)) {
    return { valid: false, error: 'Longitude must be a number' };
  }

  if (value < -180 || value > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { valid: true, value };
}

/**
 * Validates bounding box coordinates.
 * @param bbox - Array of [minLon, minLat, maxLon, maxLat]
 * @returns { valid: boolean, error?: string, value?: number[] }
 */
export function validateBoundingBox(bbox: number[] | string): {
  valid: boolean;
  error?: string;
  value?: number[];
} {
  if (!bbox) {
    return { valid: false, error: 'Bounding box is required' };
  }

  let coords: number[];

  if (typeof bbox === 'string') {
    try {
      coords = bbox.split(',').map((c) => parseFloat(c.trim()));
    } catch {
      return { valid: false, error: 'Invalid bounding box format' };
    }
  } else {
    coords = bbox;
  }

  if (coords.length !== 4) {
    return {
      valid: false,
      error: 'Bounding box must have 4 values: minLon, minLat, maxLon, maxLat',
    };
  }

  const [minLon, minLat, maxLon, maxLat] = coords;

  const minLonVal = validateLongitude(minLon);
  const maxLonVal = validateLongitude(maxLon);
  const minLatVal = validateLatitude(minLat);
  const maxLatVal = validateLatitude(maxLat);

  if (!minLonVal.valid || !maxLonVal.valid || !minLatVal.valid || !maxLatVal.valid) {
    return { valid: false, error: 'Invalid coordinate values in bounding box' };
  }

  if (minLon >= maxLon) {
    return { valid: false, error: 'minLon must be less than maxLon' };
  }

  if (minLat >= maxLat) {
    return { valid: false, error: 'minLat must be less than maxLat' };
  }

  return { valid: true, value: coords };
}

/**
 * Validates radius in meters.
 * @param radius - The radius to validate
 * @param maxRadius - Maximum allowed radius in meters
 * @returns { valid: boolean, error?: string, value?: number }
 */
export function validateRadius(
  radius: number | string,
  maxRadius = 50000
): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  const value = parseFloat(String(radius));

  if (isNaN(value)) {
    return { valid: false, error: 'Radius must be a number' };
  }

  if (value <= 0) {
    return { valid: false, error: 'Radius must be positive' };
  }

  if (value > maxRadius) {
    return { valid: false, error: `Radius cannot exceed ${maxRadius} meters` };
  }

  return { valid: true, value };
}

/**
 * Validates a GeoJSON point.
 * @param point - GeoJSON point object
 * @returns { valid: boolean, error?: string, value?: { lng: number; lat: number } }
 */
export function validateGeoJSONPoint(point: { type: string; coordinates: number[] }): {
  valid: boolean;
  error?: string;
  value?: { lng: number; lat: number };
} {
  if (!point || point.type !== 'Point') {
    return { valid: false, error: 'Must be a valid GeoJSON Point' };
  }

  if (!Array.isArray(point.coordinates) || point.coordinates.length !== 2) {
    return { valid: false, error: 'Point must have exactly 2 coordinates [lng, lat]' };
  }

  const [lng, lat] = point.coordinates;
  const lngValidation = validateLongitude(lng);
  const latValidation = validateLatitude(lat);

  if (!lngValidation.valid) {
    return { valid: false, error: lngValidation.error };
  }

  if (!latValidation.valid) {
    return { valid: false, error: latValidation.error };
  }

  return { valid: true, value: { lng: lng as number, lat: lat as number } };
}

/**
 * Validates a radius search query.
 * @param params - Object with lat, lng, and radius
 * @returns { valid: boolean, error?: string, value?: { lat: number; lng: number; radius: number } }
 */
export function validateRadiusSearch(params: {
  lat?: number | string;
  lng?: number | string;
  radius?: number | string;
}): {
  valid: boolean;
  error?: string;
  value?: { lat: number; lng: number; radius: number };
} {
  const { lat, lng, radius } = params;

  if (lat === undefined || lng === undefined || radius === undefined) {
    return { valid: false, error: 'lat, lng, and radius are required' };
  }

  const latValidation = validateLatitude(lat);
  const lngValidation = validateLongitude(lng);
  const radiusValidation = validateRadius(radius);

  if (!latValidation.valid) {
    return { valid: false, error: latValidation.error };
  }

  if (!lngValidation.valid) {
    return { valid: false, error: lngValidation.error };
  }

  if (!radiusValidation.valid) {
    return { valid: false, error: radiusValidation.error };
  }

  return {
    valid: true,
    value: {
      lat: lat as number,
      lng: lng as number,
      radius: radius as number,
    },
  };
}

/**
 * Validates US state code.
 * @param state - Two-letter state code
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateUSState(state: string): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const validStates = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
    'DC',
  ];

  if (!state || typeof state !== 'string') {
    return { valid: false, error: 'State must be a string' };
  }

  const normalized = state.toUpperCase().trim();

  if (!validStates.includes(normalized)) {
    return { valid: false, error: 'Invalid US state code' };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates country code.
 * @param country - Two-letter country code
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateCountryCode(country: string): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  if (!country || typeof country !== 'string') {
    return { valid: false, error: 'Country code must be a string' };
  }

  const normalized = country.toUpperCase().trim();

  if (normalized.length !== 2) {
    return { valid: false, error: 'Country code must be 2 characters' };
  }

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return { valid: false, error: 'Country code must be letters only' };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates postal code.
 * @param postalCode - Postal code to validate
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validatePostalCode(postalCode: string): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  if (!postalCode || typeof postalCode !== 'string') {
    return { valid: false, error: 'Postal code must be a string' };
  }

  const cleaned = postalCode.trim();

  if (cleaned.length > 20) {
    return { valid: false, error: 'Postal code too long' };
  }

  return { valid: true, value: cleaned };
}
