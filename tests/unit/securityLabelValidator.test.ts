export {};

const {
  CANONICAL_SECURITY_LABELS,
  getAllCanonicalLabels,
  isValidLabel,
  normalizeLabel,
} = require('../../server/src/utils/securityLabelValidator');

describe('securityLabelValidator', () => {
  describe('CANONICAL_SECURITY_LABELS', () => {
    test('contains expected labels', () => {
      expect(CANONICAL_SECURITY_LABELS).toContain('WPA3');
      expect(CANONICAL_SECURITY_LABELS).toContain('WPA2');
      expect(CANONICAL_SECURITY_LABELS).toContain('WEP');
      expect(CANONICAL_SECURITY_LABELS).toContain('OPEN');
      expect(CANONICAL_SECURITY_LABELS).toContain('UNKNOWN');
    });
  });

  describe('getAllCanonicalLabels', () => {
    test('returns all canonical labels', () => {
      const labels = getAllCanonicalLabels();
      expect(labels).toEqual(CANONICAL_SECURITY_LABELS);
    });
  });

  describe('isValidLabel', () => {
    test('returns true for canonical labels', () => {
      expect(isValidLabel('WPA3')).toBe(true);
      expect(isValidLabel('WPA2')).toBe(true);
      expect(isValidLabel('OPEN')).toBe(true);
      expect(isValidLabel('UNKNOWN')).toBe(true);
    });

    test('returns false for non-canonical labels', () => {
      expect(isValidLabel('wpa3')).toBe(false);
      expect(isValidLabel('WPA3-SAE')).toBe(false);
      expect(isValidLabel('INVALID')).toBe(false);
      expect(isValidLabel('')).toBe(false);
    });
  });

  describe('normalizeLabel', () => {
    test('returns canonical label unchanged', () => {
      expect(normalizeLabel('WPA3')).toBe('WPA3');
      expect(normalizeLabel('WPA2-E')).toBe('WPA2-E');
      expect(normalizeLabel('OPEN')).toBe('OPEN');
    });

    test('normalizes WPA3-SAE to WPA3-P', () => {
      expect(normalizeLabel('WPA3-SAE')).toBe('WPA3-P');
    });

    test('normalizes lowercase unknown to UNKNOWN', () => {
      expect(normalizeLabel('unknown')).toBe('UNKNOWN');
      expect(normalizeLabel('Unknown')).toBe('UNKNOWN');
    });

    test('throws for unrecognized labels', () => {
      expect(() => normalizeLabel('BOGUS')).toThrow("Unrecognized security label: 'BOGUS'");
      expect(() => normalizeLabel('')).toThrow();
    });
  });
});
