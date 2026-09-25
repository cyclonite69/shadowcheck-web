import {
  getAllCanonicalLabels,
  isValidLabel,
  normalizeLabel,
} from '../../../server/src/utils/securityLabelValidator';

describe('securityLabelValidator', () => {
  it('returns all canonical security labels in order', () => {
    const labels = getAllCanonicalLabels();
    expect(labels).toContain('WPA3-E');
    expect(labels).toContain('WPA2');
    expect(labels).toContain('OPEN');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toBe('WPA3-E'); // Most secure first
  });

  it('validates canonical labels as valid', () => {
    expect(isValidLabel('WPA3-E')).toBe(true);
    expect(isValidLabel('WPA2')).toBe(true);
    expect(isValidLabel('OPEN')).toBe(true);
  });

  it('rejects unknown labels', () => {
    expect(isValidLabel('UNKNOWN_ENCRYPTION')).toBe(false);
    expect(isValidLabel('WPA4')).toBe(false);
  });

  it('normalizes WPA3-SAE to WPA3-P', () => {
    expect(normalizeLabel('WPA3-SAE')).toBe('WPA3-P');
  });

  it('normalizes case-insensitive "unknown" to "UNKNOWN"', () => {
    expect(normalizeLabel('unknown')).toBe('UNKNOWN');
    expect(normalizeLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('throws for unrecognized labels', () => {
    expect(() => normalizeLabel('INVALID')).toThrow('Unrecognized security label');
  });
});
