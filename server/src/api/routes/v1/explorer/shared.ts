/**
 * Explorer Shared Utilities
 * Common functions used across explorer routes
 */

export {};

const { explorerService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');
const { validateIntegerRange } = require('../../../../validation/schemas');

const parseJsonParam = (value: string | undefined, fallback: unknown, name: string): unknown => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON for ${name}`);
  }
};

const assertHomeExistsIfNeeded = async (enabled: boolean, res: any): Promise<boolean> => {
  try {
    const exists = await explorerService.checkHomeLocationForFilters(enabled);
    if (!exists) {
      res.status(400).json({
        ok: false,
        error: 'Home location is required for distance filters.',
      });
      return false;
    }
    return true;
  } catch (err: any) {
    res.status(400).json({
      ok: false,
      error: err.message || 'Home location check failed.',
    });
    return false;
  }
};

function inferSecurity(
  capabilities: string | null | undefined,
  encryption: string | null | undefined
): string {
  const cap = String(capabilities || encryption || '').toUpperCase();
  if (!cap) {
    return 'OPEN';
  }
  const hasEap = cap.includes('EAP') || cap.includes('MGT');
  if (cap.includes('WPA3') || cap.includes('SAE')) {
    return hasEap ? 'WPA3-E' : 'WPA3-P';
  }
  if (cap.includes('WPA2') || cap.includes('RSN')) {
    return hasEap ? 'WPA2-E' : 'WPA2-P';
  }
  if (cap.includes('WPA')) {
    return 'WPA';
  }
  if (cap.includes('WEP')) {
    return 'WEP';
  }
  if (cap.includes('WPS') && !cap.includes('WPA')) {
    return 'WPS';
  }
  return 'Unknown';
}

function inferRadioType(
  radioType: string | null | undefined,
  ssid: string | null | undefined,
  frequency: number | string | null | undefined,
  capabilities: string | null | undefined
): string {
  if (radioType && radioType !== '' && radioType !== null) {
    return radioType;
  }

  const ssidUpper = String(ssid || '').toUpperCase();
  const capUpper = String(capabilities || '').toUpperCase();

  if (ssidUpper.includes('5G') || capUpper.includes('NR') || capUpper.includes('5G NR')) {
    return 'N';
  }

  if (
    ssidUpper.includes('LTE') ||
    ssidUpper.includes('4G') ||
    capUpper.includes('LTE') ||
    capUpper.includes('EARFCN')
  ) {
    return 'L';
  }

  if (
    ssidUpper.includes('WCDMA') ||
    ssidUpper.includes('3G') ||
    ssidUpper.includes('UMTS') ||
    capUpper.includes('WCDMA') ||
    capUpper.includes('UMTS') ||
    capUpper.includes('UARFCN')
  ) {
    return 'D';
  }

  if (
    ssidUpper.includes('GSM') ||
    ssidUpper.includes('2G') ||
    capUpper.includes('GSM') ||
    capUpper.includes('ARFCN')
  ) {
    return 'G';
  }

  if (ssidUpper.includes('CDMA') || capUpper.includes('CDMA')) {
    return 'C';
  }

  const cellularKeywords = ['T-MOBILE', 'VERIZON', 'AT&T', 'ATT', 'SPRINT', 'CARRIER', '3GPP'];
  if (cellularKeywords.some((keyword) => ssidUpper.includes(keyword))) {
    return 'L';
  }

  if (
    ssidUpper.includes('[UNKNOWN / SPOOFED RADIO]') ||
    ssidUpper.includes('BLE') ||
    ssidUpper.includes('BTLE') ||
    capUpper.includes('BLE') ||
    capUpper.includes('BTLE') ||
    capUpper.includes('BLUETOOTH LOW ENERGY')
  ) {
    return 'E';
  }

  if (ssidUpper.includes('BLUETOOTH') || capUpper.includes('BLUETOOTH')) {
    if (!capUpper.includes('LOW ENERGY') && !capUpper.includes('BLE')) {
      return 'B';
    }
    return 'E';
  }

  if (frequency) {
    const freq = parseInt(String(frequency), 10);
    if (freq >= 2412 && freq <= 2484) {
      return 'W';
    }
    if (freq >= 5000 && freq <= 5900) {
      return 'W';
    }
    if (freq >= 5925 && freq <= 7125) {
      return 'W';
    }
  }

  if (
    capUpper.includes('WPA') ||
    capUpper.includes('WEP') ||
    capUpper.includes('WPS') ||
    capUpper.includes('RSN') ||
    capUpper.includes('ESS') ||
    capUpper.includes('CCMP') ||
    capUpper.includes('TKIP')
  ) {
    return 'W';
  }

  return '?';
}

function parseOptionalString(
  value: unknown,
  maxLength: number,
  fieldName: string
): { ok: boolean; value: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: '' };
  }

  const normalized = String(value).trim();
  if (normalized.length > maxLength) {
    logger.warn(`Trimming ${fieldName} to ${maxLength} characters`);
    return { ok: true, value: normalized.slice(0, maxLength) };
  }

  return { ok: true, value: normalized };
}

function parseLimit(
  value: unknown,
  defaultValue: number | null,
  maxValue: number
): { ok: boolean; value: number | null } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: defaultValue };
  }

  if (typeof value === 'string' && value.toLowerCase() === 'all') {
    return { ok: true, value: null };
  }

  const validation = validateIntegerRange(value, 1, maxValue, 'limit');
  if (!validation.valid) {
    return { ok: true, value: defaultValue };
  }

  return { ok: true, value: validation.value };
}

function parsePage(
  value: unknown,
  defaultValue: number,
  maxValue: number
): { ok: boolean; value: number } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: defaultValue };
  }

  const validation = validateIntegerRange(value, 1, maxValue, 'page');
  if (!validation.valid) {
    return { ok: true, value: defaultValue };
  }

  return { ok: true, value: validation.value };
}

function parseOffset(
  value: unknown,
  defaultValue: number,
  maxValue: number
): { ok: boolean; value: number } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: defaultValue };
  }

  const validation = validateIntegerRange(value, 0, maxValue, 'offset');
  if (!validation.valid) {
    return { ok: true, value: defaultValue };
  }

  return { ok: true, value: validation.value };
}

function normalizeQualityFilter(value: unknown): string {
  const normalized = String(value || 'none')
    .trim()
    .toLowerCase();
  const allowed = ['none', 'temporal', 'extreme', 'duplicate', 'all'];
  return allowed.includes(normalized) ? normalized : 'none';
}

module.exports = {
  parseJsonParam,
  assertHomeExistsIfNeeded,
  inferSecurity,
  inferRadioType,
  parseOptionalString,
  parseLimit,
  parsePage,
  parseOffset,
  normalizeQualityFilter,
};
