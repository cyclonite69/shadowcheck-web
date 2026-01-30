/**
 * Filter Normalizers
 * Input normalization and coercion utilities for filter values.
 */

const { FILTER_KEYS, DEFAULT_ENABLED } = require('./constants.ts');

const normalizeEnabled = (enabled) => {
  if (!enabled || typeof enabled !== 'object') {
    return { ...DEFAULT_ENABLED };
  }
  const normalized = { ...DEFAULT_ENABLED };
  const toBool = (value) => {
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
  FILTER_KEYS.forEach((key) => {
    normalized[key] = toBool(enabled[key]);
  });
  return normalized;
};

const normalizeFilters = (filters) => (filters && typeof filters === 'object' ? filters : {});

const isOui = (value) => /^[0-9A-F]{6}$/.test(value || '');

const coerceOui = (value) =>
  String(value || '')
    .replace(/[^0-9A-Fa-f]/g, '')
    .toUpperCase();

module.exports = {
  normalizeEnabled,
  normalizeFilters,
  isOui,
  coerceOui,
};
