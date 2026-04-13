/**
 * Filter Normalizers
 * Input normalization and coercion utilities for filter values.
 */

import { FILTER_KEYS, DEFAULT_ENABLED, type FilterKey } from './constants';
import type { Filters, EnabledFlags } from './types';

const normalizeEnabled = (enabled: unknown): EnabledFlags => {
  if (!enabled || typeof enabled !== 'object') {
    return { ...DEFAULT_ENABLED };
  }
  const normalized = { ...DEFAULT_ENABLED };
  const toBool = (value: unknown): boolean => {
    if (value === true || value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (
      value === false ||
      value === 'false' ||
      value === 0 ||
      value === '0' ||
      value === null ||
      value === undefined
    ) {
      return false;
    }
    return Boolean(value);
  };
  FILTER_KEYS.forEach((key: FilterKey) => {
    normalized[key] = toBool((enabled as Record<string, unknown>)[key]);
  });
  return normalized;
};

const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const toBooleanOrUndefined = (value: unknown): boolean | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  return undefined;
};

const toStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => String(item || '').trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }
  if (typeof value === 'string') {
    const normalized = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }
  return undefined;
};

const splitTextFilterTokens = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
};

const normalizeWildcards = (value: string): string => {
  return value.replace(/\*/g, '%').replace(/\?/g, '_');
};

const normalizeRadioType = (value: string): string | null => {
  const upper = value.trim().toUpperCase();
  const map: Record<string, string> = {
    W: 'W',
    WIFI: 'W',
    'WI-FI': 'W',
    E: 'E',
    BLE: 'E',
    B: 'B',
    BLUETOOTH: 'B',
    BT: 'B',
    L: 'L',
    LTE: 'L',
    G: 'G',
    GSM: 'G',
    N: 'N',
    NR: 'N',
    '5G': 'N',
    C: 'C',
    CDMA: 'C',
    D: 'D',
    DECT: 'D',
    F: 'F',
    FM: 'F',
    '?': '?',
    UNKNOWN: '?',
  };
  return map[upper] || null;
};

const normalizeFrequencyBand = (value: string): string | null => {
  const compact = value.trim().toLowerCase();
  if (compact === '2.4ghz' || compact === '2.4') {
    return '2.4GHz';
  }
  if (compact === '5ghz' || compact === '5') {
    return '5GHz';
  }
  if (compact === '6ghz' || compact === '6') {
    return '6GHz';
  }
  if (compact === 'ble') {
    return 'BLE';
  }
  if (compact === 'cellular') {
    return 'Cellular';
  }
  return null;
};

const normalizeEncryptionType = (value: string): string | null => {
  const upper = value.trim().toUpperCase();
  if (upper.includes('WEP')) {
    return 'WEP';
  }
  if (upper === 'MIXED' || upper === 'WPA/WPA2' || upper === 'WPA2/WPA3') {
    return 'Mixed';
  }
  if (upper === 'RSN') {
    return 'WPA2';
  }
  if (upper === 'WPA3-OWE') {
    return 'OWE';
  }
  const map: Record<string, string> = {
    OPEN: 'OPEN',
    WEP: 'WEP',
    WPA: 'WPA',
    'WPA2-P': 'WPA2-P',
    'WPA2-E': 'WPA2-E',
    WPA2: 'WPA2',
    'WPA3-P': 'WPA3-P',
    'WPA3-E': 'WPA3-E',
    WPA3: 'WPA3',
    OWE: 'OWE',
    WPS: 'WPS',
    UNKNOWN: 'UNKNOWN',
    MIXED: 'Mixed',
  };
  return map[upper] || null;
};

const normalizeTagType = (value: string): string | null => {
  const lower = value.trim().toLowerCase();
  const map: Record<string, string> = {
    threat: 'threat',
    suspect: 'suspect',
    investigate: 'investigate',
    false_positive: 'false_positive',
    ignore: 'ignore',
  };
  return map[lower] || null;
};

const normalizeFilters = (filters: unknown): Filters => {
  if (!filters || typeof filters !== 'object') {
    return {};
  }

  const source = filters as Record<string, unknown>;
  const normalized: Filters = { ...source } as Filters;

  const radioTypesRaw = toStringArray(source.radioTypes);
  normalized.radioTypes = radioTypesRaw
    ?.map(normalizeRadioType)
    .filter((v): v is string => Boolean(v));

  const bandsRaw = toStringArray(source.frequencyBands);
  normalized.frequencyBands = bandsRaw
    ?.map(normalizeFrequencyBand)
    .filter((v): v is string => Boolean(v));

  const encryptionRaw = toStringArray(source.encryptionTypes);
  normalized.encryptionTypes = encryptionRaw
    ?.map(normalizeEncryptionType)
    .filter((v): v is string => Boolean(v));

  const tagTypeRaw = toStringArray(source.tag_type);
  normalized.tag_type = tagTypeRaw?.map(normalizeTagType).filter((v): v is string => Boolean(v));

  normalized.channelMin = toFiniteNumber(source.channelMin);
  normalized.channelMax = toFiniteNumber(source.channelMax);
  normalized.rssiMin = toFiniteNumber(source.rssiMin);
  normalized.rssiMax = toFiniteNumber(source.rssiMax);
  normalized.observationCountMin = toFiniteNumber(source.observationCountMin);
  normalized.observationCountMax = toFiniteNumber(source.observationCountMax);
  normalized.wigle_v3_observation_count_min = toFiniteNumber(source.wigle_v3_observation_count_min);
  normalized.wigle_v3_observation_count_max = toFiniteNumber(source.wigle_v3_observation_count_max);
  normalized.gpsAccuracyMax = toFiniteNumber(source.gpsAccuracyMax);
  normalized.distanceFromHomeMin = toFiniteNumber(source.distanceFromHomeMin);
  normalized.distanceFromHomeMax = toFiniteNumber(source.distanceFromHomeMax);
  normalized.threatScoreMin = toFiniteNumber(source.threatScoreMin);
  normalized.threatScoreMax = toFiniteNumber(source.threatScoreMax);
  normalized.stationaryConfidenceMin = toFiniteNumber(source.stationaryConfidenceMin);
  normalized.stationaryConfidenceMax = toFiniteNumber(source.stationaryConfidenceMax);

  normalized.geocodedConfidenceMin = toFiniteNumber(source.geocodedConfidenceMin);
  normalized.geocodedConfidenceMax = toFiniteNumber(source.geocodedConfidenceMax);
  normalized.uniqueDaysMin = toFiniteNumber(source.uniqueDaysMin);
  normalized.uniqueDaysMax = toFiniteNumber(source.uniqueDaysMax);
  normalized.uniqueLocationsMin = toFiniteNumber(source.uniqueLocationsMin);
  normalized.uniqueLocationsMax = toFiniteNumber(source.uniqueLocationsMax);
  normalized.ruleBasedScoreMin = toFiniteNumber(source.ruleBasedScoreMin);
  normalized.ruleBasedScoreMax = toFiniteNumber(source.ruleBasedScoreMax);
  normalized.mlThreatScoreMin = toFiniteNumber(source.mlThreatScoreMin);
  normalized.mlThreatScoreMax = toFiniteNumber(source.mlThreatScoreMax);
  normalized.mlWeightMin = toFiniteNumber(source.mlWeightMin);
  normalized.mlWeightMax = toFiniteNumber(source.mlWeightMax);
  normalized.mlBoostMin = toFiniteNumber(source.mlBoostMin);
  normalized.mlBoostMax = toFiniteNumber(source.mlBoostMax);
  normalized.maxDistanceMetersMin = toFiniteNumber(source.maxDistanceMetersMin);
  normalized.maxDistanceMetersMax = toFiniteNumber(source.maxDistanceMetersMax);

  normalized.has_notes = toBooleanOrUndefined(source.has_notes);
  normalized.excludeInvalidCoords = toBooleanOrUndefined(source.excludeInvalidCoords);

  return normalized;
};

const isOui = (value: string | null | undefined): boolean => /^[0-9A-F]{6}$/.test(value || '');

const coerceOui = (value: unknown): string =>
  String(value || '')
    .replace(/[^0-9A-Fa-f]/g, '')
    .toUpperCase();

export {
  normalizeEnabled,
  normalizeFilters,
  isOui,
  coerceOui,
  splitTextFilterTokens,
  normalizeWildcards,
};
