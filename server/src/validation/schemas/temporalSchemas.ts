/**
 * Temporal Validation Schemas
 * Timestamp and date range validation functions
 */

/**
 * Validates a timestamp string.
 * @param timestamp - The timestamp to validate
 * @returns { valid: boolean, error?: string, value?: Date }
 */
export function validateTimestamp(timestamp: string | Date): {
  valid: boolean;
  error?: string;
  value?: Date;
} {
  if (!timestamp) {
    return { valid: false, error: 'Timestamp is required' };
  }

  let date: Date;

  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  return { valid: true, value: date };
}

/**
 * Validates ISO 8601 date string.
 * @param dateStr - The date string to validate
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateDateString(dateStr: string): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  if (!dateStr || typeof dateStr !== 'string') {
    return { valid: false, error: 'Date string is required' };
  }

  const regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

  if (!regex.test(dateStr)) {
    return { valid: false, error: 'Invalid ISO 8601 date format' };
  }

  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }

  return { valid: true, value: dateStr };
}

/**
 * Validates date range (start and end dates).
 * @param startDate - Start of the range
 * @param endDate - End of the range
 * @param maxDays - Maximum allowed days between start and end
 * @returns { valid: boolean, error?: string, value?: { start: Date; end: Date } }
 */
export function validateDateRange(
  startDate: string | Date,
  endDate: string | Date,
  maxDays = 365
): {
  valid: boolean;
  error?: string;
  value?: { start: Date; end: Date };
} {
  const startValidation = validateTimestamp(startDate);
  const endValidation = validateTimestamp(endDate);

  if (!startValidation.valid) {
    return { valid: false, error: startValidation.error };
  }

  if (!endValidation.valid) {
    return { valid: false, error: endValidation.error };
  }

  const start = startValidation.value as Date;
  const end = endValidation.value as Date;

  if (start >= end) {
    return { valid: false, error: 'Start date must be before end date' };
  }

  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > maxDays) {
    return { valid: false, error: `Date range cannot exceed ${maxDays} days` };
  }

  return { valid: true, value: { start, end } };
}

/**
 * Validates relative time range string.
 * @param range - Relative range like '24h', '7d', '30d'
 * @returns { valid: boolean, error?: string, value?: { unit: string; value: number } }
 */
export function validateRelativeRange(range: string): {
  valid: boolean;
  error?: string;
  value?: { unit: string; value: number };
} {
  if (!range || typeof range !== 'string') {
    return { valid: false, error: 'Range must be a string' };
  }

  const regex = /^(\d+)([hdwm])$/;
  const match = range.trim().toLowerCase().match(regex);

  if (!match) {
    return {
      valid: false,
      error: 'Invalid range format. Use format like: 24h, 7d, 30d, 12w, 6m',
    };
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (value <= 0) {
    return { valid: false, error: 'Range value must be positive' };
  }

  return { valid: true, value: { unit, value } };
}

/**
 * Validates time window parameters.
 * @param params - Object with startDate, endDate, or range
 * @returns { valid: boolean, error?: string, value?: { start: Date; end: Date } }
 */
export function validateTimeWindow(params: {
  startDate?: string | Date;
  endDate?: string | Date;
  range?: string;
}): {
  valid: boolean;
  error?: string;
  value?: { start: Date; end: Date };
} {
  const { startDate, endDate, range } = params;

  if (range) {
    const rangeValidation = validateRelativeRange(range);

    if (!rangeValidation.valid) {
      return { valid: false, error: rangeValidation.error };
    }

    const { value: rangeVal } = rangeValidation;
    const now = new Date();
    let start: Date;

    switch (rangeVal.unit) {
      case 'h':
        start = new Date(now.getTime() - rangeVal.value * 60 * 60 * 1000);
        break;
      case 'd':
        start = new Date(now.getTime() - rangeVal.value * 24 * 60 * 60 * 1000);
        break;
      case 'w':
        start = new Date(now.getTime() - rangeVal.value * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'm':
        start = new Date(now.getTime() - rangeVal.value * 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return { valid: false, error: 'Invalid range unit' };
    }

    return { valid: true, value: { start, end: now } };
  }

  if (startDate && endDate) {
    return validateDateRange(startDate, endDate);
  }

  return { valid: false, error: 'Either range or startDate/endDate must be provided' };
}

/**
 * Validates timezone string.
 * @param timezone - The timezone to validate
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateTimezone(timezone: string): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  if (!timezone || typeof timezone !== 'string') {
    return { valid: false, error: 'Timezone is required' };
  }

  const validTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Australia/Sydney',
  ];

  const normalized = timezone.trim();

  if (!validTimezones.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid timezone. Valid options: ${validTimezones.join(', ')}`,
    };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates date format with pattern.
 * @param dateStr - The date string
 * @param format - Expected format pattern
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateDateFormat(
  dateStr: string,
  format: string
): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  if (!dateStr || typeof dateStr !== 'string') {
    return { valid: false, error: 'Date string is required' };
  }

  let regex: RegExp;

  switch (format) {
    case 'YYYY-MM-DD':
      regex = /^\d{4}-\d{2}-\d{2}$/;
      break;
    case 'YYYY-MM-DD HH:mm:ss':
      regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      break;
    case 'YYYY-MM-DDTHH:mm:ss':
      regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
      break;
    case 'MM/DD/YYYY':
      regex = /^\d{2}\/\d{2}\/\d{4}$/;
      break;
    default:
      return { valid: false, error: 'Unsupported date format' };
  }

  if (!regex.test(dateStr)) {
    return { valid: false, error: `Date must match format: ${format}` };
  }

  return { valid: true, value: dateStr };
}
