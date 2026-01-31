export {};
/**
 * Query Parameter Parsers
 * Reusable utilities for parsing and validating query parameters in route handlers.
 */

const { validateIntegerRange, validateNumberRange } = require('./schemas');

/**
 * Parses a required integer query parameter with bounds.
 * @param {any} value - Raw parameter value
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} fieldName - Parameter name for error messages
 * @param {string} missingMessage - Error message for missing value
 * @param {string} invalidMessage - Error message for invalid value
 * @returns {{ ok: boolean, value?: number, error?: string }}
 */
function parseRequiredInteger(value, min, max, fieldName, missingMessage, invalidMessage) {
  if (value === undefined) {
    return { ok: false, error: missingMessage };
  }

  const validation = validateIntegerRange(value, min, max, fieldName);
  if (!validation.valid) {
    return { ok: false, error: invalidMessage || validation.error };
  }

  return { ok: true, value: validation.value };
}

/**
 * Parses an optional number query parameter with bounds.
 * @param {any} value - Raw parameter value
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} fieldName - Parameter name for error messages
 * @returns {{ ok: boolean, value?: number|null, error?: string }}
 */
function parseOptionalNumber(value, min, max, fieldName) {
  if (value === undefined) {
    return { ok: true, value: null };
  }

  if (value === '') {
    return { ok: false, error: `Invalid ${fieldName} parameter.` };
  }

  const validation = validateNumberRange(value, min, max, fieldName);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  return { ok: true, value: validation.value };
}

/**
 * Parses an optional integer query parameter with bounds.
 * @param {any} value - Raw parameter value
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} fieldName - Parameter name for error messages
 * @returns {{ ok: boolean, value?: number|null, error?: string }}
 */
function parseOptionalInteger(value, min, max, fieldName) {
  if (value === undefined) {
    return { ok: true, value: null };
  }

  if (value === '') {
    return { ok: false, error: `Invalid ${fieldName} parameter.` };
  }

  const validation = validateIntegerRange(value, min, max, fieldName);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  return { ok: true, value: validation.value };
}

/**
 * Parses a comma-delimited list from a query parameter.
 * @param {any} value - Raw parameter value
 * @param {number} maxItems - Maximum allowed items
 * @returns {string[]|null} Normalized values or null
 */
function parseCommaList(value, maxItems = 50) {
  if (value === undefined) {
    return null;
  }

  const values = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return null;
  }

  return values.slice(0, maxItems);
}

/**
 * Parses a bounding box from query parameters.
 * Returns null when values are missing or invalid to preserve prior behavior.
 * @param {any} minLatRaw - Minimum latitude
 * @param {any} maxLatRaw - Maximum latitude
 * @param {any} minLngRaw - Minimum longitude
 * @param {any} maxLngRaw - Maximum longitude
 * @returns {{ ok: boolean, value?: object|null, error?: string }}
 */
function parseBoundingBoxParams(minLatRaw, maxLatRaw, minLngRaw, maxLngRaw) {
  if (
    minLatRaw === undefined ||
    maxLatRaw === undefined ||
    minLngRaw === undefined ||
    maxLngRaw === undefined
  ) {
    return { ok: true, value: null };
  }

  const minLat = parseFloat(minLatRaw);
  const maxLat = parseFloat(maxLatRaw);
  const minLng = parseFloat(minLngRaw);
  const maxLng = parseFloat(maxLngRaw);

  if (
    Number.isNaN(minLat) ||
    Number.isNaN(maxLat) ||
    Number.isNaN(minLng) ||
    Number.isNaN(maxLng)
  ) {
    return { ok: true, value: null };
  }

  if (
    minLat < -90 ||
    maxLat > 90 ||
    minLat > maxLat ||
    minLng < -180 ||
    maxLng > 180 ||
    minLng > maxLng
  ) {
    return { ok: true, value: null };
  }

  return {
    ok: true,
    value: {
      minLat,
      maxLat,
      minLng,
      maxLng,
    },
  };
}

/**
 * Parses radius filter values from query parameters.
 * Returns null when values are missing or invalid to preserve prior behavior.
 * @param {any} latRaw - Center latitude
 * @param {any} lngRaw - Center longitude
 * @param {any} radiusRaw - Radius meters
 * @returns {{ ok: boolean, value?: object|null, error?: string }}
 */
function parseRadiusParams(latRaw, lngRaw, radiusRaw) {
  if (latRaw === undefined || lngRaw === undefined || radiusRaw === undefined) {
    return { ok: true, value: null };
  }

  const centerLat = parseFloat(latRaw);
  const centerLng = parseFloat(lngRaw);
  const radius = parseFloat(radiusRaw);

  if (Number.isNaN(centerLat) || Number.isNaN(centerLng) || Number.isNaN(radius)) {
    return { ok: true, value: null };
  }

  if (centerLat < -90 || centerLat > 90 || centerLng < -180 || centerLng > 180 || radius <= 0) {
    return { ok: true, value: null };
  }

  return {
    ok: true,
    value: {
      centerLat,
      centerLng,
      radius,
    },
  };
}

module.exports = {
  parseRequiredInteger,
  parseOptionalNumber,
  parseOptionalInteger,
  parseCommaList,
  parseBoundingBoxParams,
  parseRadiusParams,
};
