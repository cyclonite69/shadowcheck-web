/**
 * Network Validation Schemas
 * Network-specific validators: BSSID, SSID, signal strength, observation count, channel
 */

/**
 * Validates a strict MAC address (AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF).
 * @param bssid - The MAC address to validate
 * @returns { valid: boolean, error?: string, cleaned?: string }
 */
export function validateMACAddress(bssid: string): {
  valid: boolean;
  error?: string;
  cleaned?: string;
} {
  if (!bssid || typeof bssid !== 'string') {
    return { valid: false, error: 'BSSID must be a non-empty string' };
  }

  const cleaned = bssid.trim().toUpperCase();

  if (!/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/.test(cleaned)) {
    return { valid: false, error: 'BSSID must be a valid MAC address (AA:BB:CC:DD:EE:FF)' };
  }

  return { valid: true, cleaned: cleaned.replace(/-/g, ':') };
}

/**
 * Validates a network identifier (MAC address or cellular/tower identifier).
 * @param value - The identifier to validate
 * @returns { valid: boolean, error?: string, cleaned?: string }
 */
export function validateNetworkIdentifier(value: string): {
  valid: boolean;
  error?: string;
  cleaned?: string;
} {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: 'BSSID must be a non-empty string' };
  }

  const cleaned = value.trim().toUpperCase();

  if (cleaned.length > 64) {
    return { valid: false, error: 'BSSID exceeds maximum length (64 chars)' };
  }

  const macValidation = validateMACAddress(cleaned);
  if (macValidation.valid) {
    return macValidation;
  }

  if (/^[A-Z0-9:_-]+$/.test(cleaned)) {
    return { valid: true, cleaned };
  }

  return {
    valid: false,
    error: 'BSSID must be a valid MAC address or alphanumeric identifier',
  };
}

/**
 * Validates SSID (network name).
 * @param ssid - The SSID to validate
 * @returns { valid: boolean, error?: string, cleaned?: string }
 */
export function validateSSID(ssid: string): {
  valid: boolean;
  error?: string;
  cleaned?: string;
} {
  if (!ssid || typeof ssid !== 'string') {
    return { valid: false, error: 'SSID must be a non-empty string' };
  }

  const cleaned = ssid.trim();

  if (cleaned.length > 32) {
    return { valid: false, error: 'SSID cannot exceed 32 characters' };
  }

  if (/^[\x00-\x1f\x7f]/.test(cleaned)) {
    return { valid: false, error: 'SSID cannot contain control characters' };
  }

  return { valid: true, cleaned };
}

/**
 * Validates BSSID format specifically.
 * @param bssid - The BSSID to validate
 * @returns { valid: boolean, error?: string, cleaned?: string }
 */
export function validateBSSID(bssid: string): {
  valid: boolean;
  error?: string;
  cleaned?: string;
} {
  if (!bssid || typeof bssid !== 'string') {
    return { valid: false, error: 'BSSID must be a non-empty string' };
  }

  const cleaned = bssid.trim().toUpperCase();

  const macValidation = validateMACAddress(cleaned);
  if (macValidation.valid) {
    return macValidation;
  }

  const identifierValidation = validateNetworkIdentifier(cleaned);
  if (identifierValidation.valid) {
    return identifierValidation;
  }

  return { valid: false, error: 'Invalid BSSID format' };
}

/**
 * Validates signal strength in dBm.
 * @param signal - The signal strength in dBm
 * @returns { valid: boolean, error?: string, cleaned?: number }
 */
export function validateSignalStrength(signal: number | string): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  const value = parseInt(String(signal), 10);

  if (isNaN(value)) {
    return { valid: false, error: 'Signal strength must be a number' };
  }

  if (value > 0) {
    return { valid: false, error: 'Signal strength must be negative (dBm)' };
  }

  if (value < -100 || value > 0) {
    return { valid: false, error: 'Signal strength must be between -100 and 0 dBm' };
  }

  return { valid: true, value };
}

/**
 * Validates a list of BSSIDs.
 * @param bssids - Comma-separated BSSIDs
 * @returns { valid: boolean, error?: string, cleaned?: string[] }
 */
export function validateBSSIDList(bssids: string): {
  valid: boolean;
  error?: string;
  value?: string[];
} {
  if (!bssids || typeof bssids !== 'string') {
    return { valid: false, error: 'BSSID list must be a non-empty string' };
  }

  const cleaned = bssids
    .split(',')
    .map((bssid) => bssid.trim().toUpperCase())
    .filter((bssid) => bssid.length > 0);

  if (cleaned.length === 0) {
    return { valid: false, error: 'At least one BSSID is required' };
  }

  if (cleaned.length > 100) {
    return { valid: false, error: 'Maximum 100 BSSIDs allowed' };
  }

  const errors: string[] = [];
  for (const bssid of cleaned) {
    const validation = validateBSSID(bssid);
    if (!validation.valid) {
      errors.push(`Invalid BSSID: ${bssid}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return { valid: true, value: cleaned };
}

/**
 * Validates WiFi channel number.
 * @param channel - The channel number
 * @returns { valid: boolean, error?: string, cleaned?: number }
 */
export function validateChannel(channel: number | string): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  const value = parseInt(String(channel), 10);

  if (isNaN(value)) {
    return { valid: false, error: 'Channel must be a number' };
  }

  const validChannels = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 36, 38, 40, 42, 44, 46, 48, 52, 54, 56, 58, 60,
    62, 64, 100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128, 132, 134,
    136, 138, 140, 142, 144, 146, 148, 149, 151, 153, 155, 157, 159, 161, 163, 165, 169, 171, 173,
    175, 177, 180, 182, 184, 186,
  ];

  if (!validChannels.includes(value)) {
    return {
      valid: false,
      error: `Invalid channel. Valid channels: ${validChannels.slice(0, 14).join(', ')}, etc.`,
    };
  }

  return { valid: true, value };
}

/**
 * Validates frequency in MHz.
 * @param frequency - The frequency in MHz
 * @returns { valid: boolean, error?: string, cleaned?: number }
 */
export function validateFrequency(frequency: number | string): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  const value = parseFloat(String(frequency));

  if (isNaN(value)) {
    return { valid: false, error: 'Frequency must be a number' };
  }

  if (value < 2412 || value > 5925) {
    return { valid: false, error: 'Frequency must be between 2412 MHz and 5925 MHz' };
  }

  return { valid: true, value };
}

/**
 * Validates observation count.
 * @param count - The observation count
 * @returns { valid: boolean, error?: string, cleaned?: number }
 */
export function validateObservationCount(count: number | string): {
  valid: boolean;
  error?: string;
  value?: number;
} {
  const value = parseInt(String(count), 10);

  if (isNaN(value) || value < 0) {
    return { valid: false, error: 'Observation count must be a non-negative integer' };
  }

  return { valid: true, value };
}

/**
 * Validates authentication type.
 * @param auth - The authentication type
 * @returns { valid: boolean, error?: string, cleaned?: string }
 */
export function validateAuthenticationType(auth: string): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const validTypes = [
    'OPEN',
    'WEP',
    'WPA',
    'WPA2',
    'WPA3',
    'WPA2PSK',
    'WPA3SAE',
    '8021X',
    'OWE',
    'SAE',
    'FT',
    'FILS',
    'OWE_TRANSITION',
  ];

  if (!auth || typeof auth !== 'string') {
    return { valid: false, error: 'Authentication type must be a string' };
  }

  const normalized = auth.toUpperCase().trim();

  if (!validTypes.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid authentication type. Must be one of: ${validTypes.join(', ')}`,
    };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates encryption type.
 * @param encryption - The encryption type
 * @returns { valid: boolean, error?: string, cleaned?: string }
 */
export function validateEncryptionType(encryption: string): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const validTypes = [
    'NONE',
    'WEP',
    'TKIP',
    'CCMP',
    'CCMP128',
    'CCMP256',
    'GCMP128',
    'GCMP256',
    'GCMP',
    'SMS4',
    'KIP',
  ];

  if (!encryption || typeof encryption !== 'string') {
    return { valid: false, error: 'Encryption type must be a string' };
  }

  const normalized = encryption.toUpperCase().trim();

  if (!validTypes.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid encryption type. Must be one of: ${validTypes.join(', ')}`,
    };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates network type.
 * @param type - The network type
 * @returns { valid: boolean, error?: string, cleaned?: string }
 */
export function validateNetworkType(type: string): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const validTypes = ['AP', 'ADHOC', 'WIFI', 'BLE', 'UNKNOWN'];

  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'Network type must be a string' };
  }

  const normalized = type.toUpperCase().trim();

  if (!validTypes.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid network type. Must be one of: ${validTypes.join(', ')}`,
    };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates band type.
 * @param band - The band type
 * @returns { valid: boolean, error?: string, cleaned?: string }
 */
export function validateBand(band: string): {
  valid: boolean;
  error?: string;
  value?: string;
} {
  const validBands = ['2.4', '5', '6', 'UNKNOWN'];

  if (!band || typeof band !== 'string') {
    return { valid: false, error: 'Band must be a string' };
  }

  const normalized = band.toUpperCase().trim();

  if (!validBands.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid band. Must be one of: ${validBands.join(', ')}`,
    };
  }

  return { valid: true, value: normalized };
}
