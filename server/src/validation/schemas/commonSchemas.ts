/**
 * Common Validation Schemas
 * Generic validators used across the application
 */

/**
 * Validates a string is not empty.
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateString(
  value: unknown,
  fieldName = 'Value'
): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validates a string has a minimum length.
 * @param value - The value to validate
 * @param minLength - Minimum length required
 * @param fieldName - Name of the field for error messages
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateMinLength(
  value: unknown,
  minLength: number,
  fieldName = 'Value'
): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const stringValidation = validateString(value, fieldName);

  if (!stringValidation.valid) {
    return { valid: false, error: stringValidation.error };
  }

  if (stringValidation.value!.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`,
    };
  }

  return { valid: true, value: stringValidation.value };
}

/**
 * Validates a string has a maximum length.
 * @param value - The value to validate
 * @param maxLength - Maximum length allowed
 * @param fieldName - Name of the field for error messages
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateMaxLength(
  value: unknown,
  maxLength: number,
  fieldName = 'Value'
): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const stringValidation = validateString(value, fieldName);

  if (!stringValidation.valid) {
    return { valid: false, error: stringValidation.error };
  }

  if (stringValidation.value!.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} cannot exceed ${maxLength} characters`,
    };
  }

  return { valid: true, value: stringValidation.value };
}

/**
 * Validates a string matches a regex pattern.
 * @param value - The value to validate
 * @param pattern - Regex pattern to match
 * @param errorMsg - Custom error message
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validatePattern(
  value: unknown,
  pattern: RegExp,
  errorMsg = 'Invalid format'
): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const stringValidation = validateString(value);

  if (!stringValidation.valid) {
    return { valid: false, error: stringValidation.error };
  }

  if (!pattern.test(stringValidation.value!)) {
    return { valid: false, error: errorMsg };
  }

  return { valid: true, value: stringValidation.value };
}

/**
 * Validates a value is a valid integer.
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns { valid: boolean, error?: string, value?: number }
 */
export function validateInteger(
  value: unknown,
  fieldName = 'Value'
): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const num = parseInt(String(value), 10);

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be an integer` };
  }

  return { valid: true, value: num };
}

/**
 * Validates a value is a valid number.
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns { valid: boolean, error?: string, value?: number }
 */
export function validateNumber(
  value: unknown,
  fieldName = 'Value'
): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const num = parseFloat(String(value));

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  return { valid: true, value: num };
}

/**
 * Validates integer within an inclusive range.
 * @param value - The value to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param fieldName - Name of the field for error messages
 * @returns { valid: boolean, error?: string, value?: number }
 */
export function validateIntegerRange(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  fieldName = 'Value'
): {
  valid: boolean;
  error?: string;
  value?: number;
} {
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
 * Validates a value is a valid boolean.
 * @param value - The value to validate
 * @returns { valid: boolean, error?: string, value?: boolean }
 */
export function validateBoolean(value: unknown): {
  valid: boolean;
  error?: string;
  value?: boolean;
} {
  if (value === null || value === undefined) {
    return { valid: false, error: 'Boolean value is required' };
  }

  if (typeof value === 'boolean') {
    return { valid: true, value };
  }

  if (value === 'true' || value === '1' || value === 1) {
    return { valid: true, value: true };
  }

  if (value === 'false' || value === '0' || value === 0) {
    return { valid: true, value: false };
  }

  return { valid: false, error: 'Invalid boolean value' };
}

/**
 * Validates a value is in a list of allowed values.
 * @param value - The value to validate
 * @param allowedValues - List of allowed values
 * @param fieldName - Name of the field for error messages
 * @returns { valid: boolean, error?: string, value?: T }
 */
export function validateEnum<T extends string | number>(
  value: unknown,
  allowedValues: T[],
  fieldName = 'Value'
): {
  valid: boolean;
  error?: string;
  value?: T;
} {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (!allowedValues.includes(value as T)) {
    return {
      valid: false,
      error: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
    };
  }

  return { valid: true, value: value as T };
}

/**
 * Validates a value is an array with allowed item types.
 * @param value - The value to validate
 * @param itemValidator - Function to validate each item
 * @param maxLength - Maximum array length
 * @returns { valid: boolean, error?: string, value?: T[] }
 */
export function validateArray<T>(
  value: unknown,
  itemValidator: (item: unknown) => { valid: boolean; error?: string },
  maxLength = 1000
): {
  valid: boolean;
  error?: string;
  value?: T[];
} {
  if (!Array.isArray(value)) {
    return { valid: false, error: 'Value must be an array' };
  }

  if (value.length === 0) {
    return { valid: false, error: 'Array cannot be empty' };
  }

  if (value.length > maxLength) {
    return { valid: false, error: `Array cannot exceed ${maxLength} items` };
  }

  const errors: string[] = [];
  const validItems: T[] = [];

  for (let i = 0; i < value.length; i++) {
    const itemValidation = itemValidator(value[i]);

    if (!itemValidation.valid) {
      errors.push(`Item ${i}: ${itemValidation.error}`);
    } else {
      validItems.push(value[i] as T);
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return { valid: true, value: validItems };
}

/**
 * Validates an object has required properties.
 * @param obj - The object to validate
 * @param requiredProps - List of required property names
 * @returns { valid: boolean, error?: string, value?: object }
 */
export function validateRequiredProps(
  obj: unknown,
  requiredProps: string[]
): {
  valid: boolean;
  error?: string;
  value?: Record<string, unknown>;
} {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return { valid: false, error: 'Value must be an object' };
  }

  const objValue = obj as Record<string, unknown>;
  const missing: string[] = [];

  for (const prop of requiredProps) {
    if (objValue[prop] === undefined) {
      missing.push(prop);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required properties: ${missing.join(', ')}`,
    };
  }

  return { valid: true, value: objValue };
}

/**
 * Validates an email address.
 * @param email - The email to validate
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateEmail(email: unknown): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const stringValidation = validateString(email, 'Email');

  if (!stringValidation.valid) {
    return { valid: false, error: stringValidation.error };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(stringValidation.value!)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, value: stringValidation.value };
}

/**
 * Validates a URL.
 * @param url - The URL to validate
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateURL(url: unknown): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const stringValidation = validateString(url, 'URL');

  if (!stringValidation.valid) {
    return { valid: false, error: stringValidation.error };
  }

  try {
    new URL(stringValidation.value!);
    return { valid: true, value: stringValidation.value };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validates UUID format.
 * @param uuid - The UUID to validate
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateUUID(uuid: unknown): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const stringValidation = validateString(uuid, 'UUID');

  if (!stringValidation.valid) {
    return { valid: false, error: stringValidation.error };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(stringValidation.value!)) {
    return { valid: false, error: 'Invalid UUID format' };
  }

  return { valid: true, value: stringValidation.value };
}

/**
 * Validates that a string contains only alphanumeric characters.
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns { valid: boolean, error?: string, value?: string }
 */
export function validateAlphanumeric(
  value: unknown,
  fieldName = 'Value'
): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const stringValidation = validateString(value, fieldName);

  if (!stringValidation.valid) {
    return { valid: false, error: stringValidation.error };
  }

  if (!/^[a-zA-Z0-9]+$/.test(stringValidation.value!)) {
    return { valid: false, error: `${fieldName} must contain only alphanumeric characters` };
  }

  return { valid: true, value: stringValidation.value };
}
