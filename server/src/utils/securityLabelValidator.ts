/**
 * Security Label Validator
 *
 * Canonical security label list and normalization helpers for backend use.
 * Mirrors the taxonomy in client/src/utils/wigle/security.ts so the server
 * side has a single authoritative reference without importing client code.
 *
 * Used by:
 *  - filterQueryBuilder (validation / normalization of incoming filter values)
 *  - Unit tests (regression guard against label drift)
 */

/** Ordered canonical security labels (most-secure first). */
export const CANONICAL_SECURITY_LABELS = [
  'WPA3-E',
  'WPA3-P',
  'WPA3',
  'WPA2-E',
  'WPA2-P',
  'WPA2',
  'WPA',
  'OWE',
  'WPS',
  'WEP',
  'OPEN',
  'UNKNOWN',
] as const;

export type CanonicalSecurityLabel = (typeof CANONICAL_SECURITY_LABELS)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_SECURITY_LABELS);

/** Returns the full ordered list of canonical security label strings. */
export function getAllCanonicalLabels(): readonly string[] {
  return CANONICAL_SECURITY_LABELS;
}

/** Returns true if the given string is a canonical security label. */
export function isValidLabel(label: string): boolean {
  return CANONICAL_SET.has(label);
}

/**
 * Normalize a raw or legacy security label to its canonical form.
 *
 * Known aliases handled:
 *   - `'WPA3-SAE'`  → `'WPA3-P'`  (SAE is WPA3-Personal)
 *   - `'Unknown'`   → `'UNKNOWN'`
 *   - `'unknown'`   → `'UNKNOWN'`
 *
 * @throws {Error} if the label is not recognized (not canonical and no known alias).
 */
export function normalizeLabel(label: string): CanonicalSecurityLabel {
  if (CANONICAL_SET.has(label)) {
    return label as CanonicalSecurityLabel;
  }

  switch (label.toUpperCase()) {
    case 'WPA3-SAE':
      return 'WPA3-P';
    case 'UNKNOWN':
      return 'UNKNOWN';
    default:
      throw new Error(`Unrecognized security label: '${label}'`);
  }
}

module.exports = { CANONICAL_SECURITY_LABELS, getAllCanonicalLabels, isValidLabel, normalizeLabel };
