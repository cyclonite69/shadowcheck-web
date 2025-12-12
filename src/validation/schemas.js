/**
 * Input Validation Schemas
 * Defines strict validation rules for all API inputs using JSON schema patterns
 * All queries must pass validation before reaching business logic
 */

/**
 * Validates BSSID (MAC address or tower identifier)
 * @param {string} bssid - The BSSID to validate
 * @returns {object} { valid: boolean, error?: string, cleaned?: string }
 */
function validateBSSID(bssid) {
  if (!bssid || typeof bssid !== 'string') {
    return { valid: false, error: 'BSSID must be a non-empty string' };
  }

  const cleaned = bssid.trim().toUpperCase();

  if (cleaned.length > 64) {
    return { valid: false, error: 'BSSID exceeds maximum length (64 chars)' };
  }

  // Valid MAC address format: AA:BB:CC:DD:EE:FF
  if (/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(cleaned)) {
    return { valid: true, cleaned };
  }

  // Valid alphanumeric tower ID (up to 32 chars)
  if (/^[A-Z0-9_-]{1,32}$/.test(cleaned)) {
    return { valid: true, cleaned };
  }

  return {
    valid: false,
    error: 'BSSID must be MAC address (AA:BB:CC:DD:EE:FF) or alphanumeric identifier',
  };
}

/**
 * Validates pagination parameters
 * @param {any} page - Page number
 * @param {any} limit - Results per page
 * @param {number} maxLimit - Maximum allowed limit (default 5000)
 * @returns {object} { valid: boolean, error?: string, page?: number, limit?: number }
 */
function validatePagination(page, limit, maxLimit = 5000) {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum <= 0) {
    return { valid: false, error: 'Page must be a positive integer' };
  }

  if (isNaN(limitNum) || limitNum <= 0) {
    return { valid: false, error: 'Limit must be a positive integer' };
  }

  if (limitNum > maxLimit) {
    return { valid: false, error: `Limit cannot exceed ${maxLimit}` };
  }

  return { valid: true, page: pageNum, limit: limitNum };
}

/**
 * Validates geographic coordinates
 * @param {any} latitude - Latitude value
 * @param {any} longitude - Longitude value
 * @returns {object} { valid: boolean, error?: string, lat?: number, lon?: number }
 */
function validateCoordinates(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be a number between -90 and 90' };
  }

  if (isNaN(lon) || lon < -180 || lon > 180) {
    return { valid: false, error: 'Longitude must be a number between -180 and 180' };
  }

  return { valid: true, lat, lon };
}

/**
 * Validates tag type
 * @param {string} tagType - Tag type value
 * @returns {object} { valid: boolean, error?: string, normalized?: string }
 */
function validateTagType(tagType) {
  const validTags = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];

  if (!tagType || typeof tagType !== 'string') {
    return { valid: false, error: 'Tag type must be a string' };
  }

  const normalized = tagType.toUpperCase().trim();

  if (!validTags.includes(normalized)) {
    return { valid: false, error: `Tag type must be one of: ${validTags.join(', ')}` };
  }

  return { valid: true, normalized };
}

/**
 * Validates confidence score
 * @param {any} confidence - Confidence value (0-100)
 * @returns {object} { valid: boolean, error?: string, value?: number }
 */
function validateConfidence(confidence) {
  const value = parseFloat(confidence);

  if (isNaN(value) || value < 0 || value > 100) {
    return { valid: false, error: 'Confidence must be a number between 0 and 100' };
  }

  return { valid: true, value };
}

/**
 * Validates string field with length limits
 * @param {string} value - String to validate
 * @param {number} minLength - Minimum allowed length
 * @param {number} maxLength - Maximum allowed length
 * @param {string} fieldName - Name of field for error messages
 * @returns {object} { valid: boolean, error?: string }
 */
function validateString(value, minLength = 0, maxLength = 1000, fieldName = 'Field') {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  if (value.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} cannot exceed ${maxLength} characters` };
  }

  return { valid: true };
}

/**
 * Validates range parameter for analytics
 * @param {string} range - Range value (24h, 7d, 30d, 90d, all)
 * @returns {object} { valid: boolean, error?: string, value?: string }
 */
function validateTimeRange(range) {
  const validRanges = ['24h', '7d', '30d', '90d', 'all'];

  if (!range || typeof range !== 'string') {
    return { valid: false, error: 'Range must be a string' };
  }

  const normalized = range.trim().toLowerCase();

  if (!validRanges.includes(normalized)) {
    return { valid: false, error: `Range must be one of: ${validRanges.join(', ')}` };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates sort parameter
 * @param {string} sort - Sort column name
 * @param {object} allowedColumns - Map of allowed column names
 * @returns {object} { valid: boolean, error?: string, column?: string }
 */
function validateSort(sort, allowedColumns) {
  if (!sort || typeof sort !== 'string') {
    return { valid: false, error: 'Sort must be a string' };
  }

  const normalized = sort.toLowerCase();

  if (!allowedColumns[normalized]) {
    return {
      valid: false,
      error: `Invalid sort column. Allowed: ${Object.keys(allowedColumns).join(', ')}`,
    };
  }

  return { valid: true, column: normalized };
}

/**
 * Validates sort order direction
 * @param {string} order - Sort order (ASC or DESC)
 * @returns {object} { valid: boolean, error?: string, value?: string }
 */
function validateSortOrder(order) {
  const normalized = (order || 'DESC').toUpperCase();

  if (!['ASC', 'DESC'].includes(normalized)) {
    return { valid: false, error: 'Sort order must be ASC or DESC' };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates signal strength in dBm
 * @param {any} signal - Signal value
 * @returns {object} { valid: boolean, error?: string, value?: number }
 */
function validateSignalStrength(signal) {
  const value = parseInt(signal);

  if (isNaN(value) || value < -100 || value > 0) {
    return { valid: false, error: 'Signal strength must be between -100 and 0 dBm' };
  }

  return { valid: true, value };
}

/**
 * Validates severity score
 * @param {any} severity - Severity value
 * @returns {object} { valid: boolean, error?: string, value?: number }
 */
function validateSeverity(severity) {
  const value = parseInt(severity);

  if (isNaN(value) || value < 0 || value > 100) {
    return { valid: false, error: 'Severity must be between 0 and 100' };
  }

  return { valid: true, value };
}

/**
 * Validates boolean query parameter
 * @param {string} value - String representation of boolean
 * @returns {object} { valid: boolean, error?: string, value?: boolean }
 */
function validateBoolean(value) {
  if (value === undefined || value === null) {
    return { valid: true, value: false };
  }

  if (typeof value === 'boolean') {
    return { valid: true, value };
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return { valid: true, value: true };
    }
    if (value.toLowerCase() === 'false') {
      return { valid: true, value: false };
    }
  }

  return { valid: false, error: 'Boolean parameter must be "true" or "false"' };
}

/**
 * Validates a set of enum values
 * @param {string} value - Value to check
 * @param {array} allowed - Array of allowed values
 * @param {string} fieldName - Field name for error messages
 * @returns {object} { valid: boolean, error?: string, value?: string }
 */
function validateEnum(value, allowed, fieldName = 'Field') {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  const normalized = value.toUpperCase();

  if (!allowed.map((v) => v.toUpperCase()).includes(normalized)) {
    return { valid: false, error: `${fieldName} must be one of: ${allowed.join(', ')}` };
  }

  return { valid: true, value: normalized };
}

/**
 * Combines multiple validation results
 * @param {array} results - Array of validation result objects
 * @returns {object} { valid: boolean, errors?: array }
 */
function combineValidations(...results) {
  const errors = results.filter((r) => !r.valid).map((r) => r.error);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = {
  validateBSSID,
  validatePagination,
  validateCoordinates,
  validateTagType,
  validateConfidence,
  validateString,
  validateTimeRange,
  validateSort,
  validateSortOrder,
  validateSignalStrength,
  validateSeverity,
  validateBoolean,
  validateEnum,
  combineValidations,
};
