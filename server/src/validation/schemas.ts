/**
 * Input Validation Schemas
 * Barrel export for backward compatibility.
 *
 * Validation functions are organized by domain:
 * - network-schemas.ts: network/BSSID/SSID validation
 * - geospatial-schemas.ts: coordinate/location validation
 * - temporal-schemas.ts: timestamp/date range validation
 * - common-schemas.ts: generic validators
 * - complex-validators.ts: advanced validators
 */

// Re-export all validators from sub-modules for backward compatibility
export * from './schemas/networkSchemas';
export * from './schemas/geospatialSchemas';
export * from './schemas/temporalSchemas';
export * from './schemas/commonSchemas';
export * from './schemas/complexValidators';

/**
 * Validates pagination parameters
 */
export function validatePagination(page: string, limit: string, maxLimit = 5000) {
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
 * Validates tag type
 */
export function validateTagType(tagType: string) {
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
 */
export function validateConfidence(confidence: unknown) {
  const value = parseFloat(String(confidence));

  if (isNaN(value) || value < 0 || value > 100) {
    return { valid: false, error: 'Confidence must be a number between 0 and 100' };
  }

  return { valid: true, value };
}

/**
 * Validates range parameter for analytics
 */
export function validateTimeRange(range: string) {
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
 */
export function validateSort(sort: string, allowedColumns: Record<string, unknown>) {
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
 */
export function validateSortOrder(order: string) {
  const normalized = (order || 'DESC').toUpperCase();

  if (!['ASC', 'DESC'].includes(normalized)) {
    return { valid: false, error: 'Sort order must be ASC or DESC' };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates severity score
 */
export function validateSeverity(severity: unknown) {
  const value = parseInt(String(severity), 10);

  if (isNaN(value) || value < 0 || value > 100) {
    return { valid: false, error: 'Severity must be between 0 and 100' };
  }

  return { valid: true, value };
}

/**
 * Validates integer within an inclusive range
 */
export function validateIntegerRange(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  fieldName = 'Value'
) {
  const parsed = parseInt(String(value), 10);

  if (Number.isNaN(parsed)) {
    return { valid: false, error: `${fieldName} must be an integer` };
  }

  if (parsed < min || parsed > max) {
    return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }

  return { valid: true, value: parsed };
}

/**
 * Validates numeric value within an inclusive range
 */
export function validateNumberRange(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  fieldName = 'Value'
) {
  const parsed = parseFloat(String(value));

  if (Number.isNaN(parsed)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  if (parsed < min || parsed > max) {
    return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }

  return { valid: true, value: parsed };
}

/**
 * Combines multiple validation results
 */
export function combineValidations(...results: { valid: boolean; error?: string }[]) {
  const errors = results.filter((r) => !r.valid).map((r) => r.error);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
