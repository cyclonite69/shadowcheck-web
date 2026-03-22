export {};
/**
 * Security filter alignment regression tests
 *
 * Covers acceptance criteria from the security/threat filter consistency task:
 *  A. Canonical security taxonomy — normalizeSecurityLabel returns ONLY canonical labels
 *  B. OPEN filter semantics — null/empty/ESS-only rows match OPEN; WPA rows do not
 *  C. Threat category filter consistency — verified by threatCategoryFilter.test.ts
 *  D. Taxonomy consistency — analytics palette covers every canonical label
 */

// ── Import the canonical helpers ─────────────────────────────────────────────

import {
  normalizeSecurityLabel,
  formatSecurity,
  CANONICAL_SECURITY_LABELS,
} from '../../client/src/utils/wigle/security';

import { SECURITY_TYPE_COLORS } from '../../client/src/components/analytics/utils/chartColors';

// ── A. Canonical output labels ────────────────────────────────────────────────

describe('normalizeSecurityLabel – canonical taxonomy output', () => {
  it('empty string → OPEN', () => {
    expect(normalizeSecurityLabel('')).toBe('OPEN');
  });

  it('null → OPEN', () => {
    expect(normalizeSecurityLabel(null)).toBe('OPEN');
  });

  it('undefined → OPEN', () => {
    expect(normalizeSecurityLabel(undefined)).toBe('OPEN');
  });

  it('"NONE" → OPEN', () => {
    expect(normalizeSecurityLabel('NONE')).toBe('OPEN');
  });

  it('"OPEN" literal → OPEN', () => {
    expect(normalizeSecurityLabel('OPEN')).toBe('OPEN');
  });

  it('"OPEN/UNKNOWN" → OPEN', () => {
    expect(normalizeSecurityLabel('OPEN/UNKNOWN')).toBe('OPEN');
  });

  it('"UNKNOWN" → UNKNOWN', () => {
    expect(normalizeSecurityLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('[ESS] only (open network infrastructure flag) → OPEN', () => {
    expect(normalizeSecurityLabel('[ESS]')).toBe('OPEN');
  });

  it('WEP → WEP', () => {
    expect(normalizeSecurityLabel('[WEP][ESS]')).toBe('WEP');
  });

  it('[WPA-PSK-TKIP][ESS] → WPA (not WPA-PSK)', () => {
    expect(normalizeSecurityLabel('[WPA-PSK-TKIP][ESS]')).toBe('WPA');
  });

  it('[WPA-EAP-TKIP][ESS] → WPA (not WPA-EAP)', () => {
    expect(normalizeSecurityLabel('[WPA-EAP-TKIP][ESS]')).toBe('WPA');
  });

  it('[WPA2-PSK-CCMP][ESS] → WPA2-P (not WPA2-PSK)', () => {
    expect(normalizeSecurityLabel('[WPA2-PSK-CCMP][ESS]')).toBe('WPA2-P');
  });

  it('[WPA2-EAP-CCMP][ESS] → WPA2-E (not WPA2-EAP)', () => {
    expect(normalizeSecurityLabel('[WPA2-EAP-CCMP][ESS]')).toBe('WPA2-E');
  });

  it('[WPA2-PSK-CCMP][WPA2-PSK-TKIP][ESS] → WPA2-P', () => {
    expect(normalizeSecurityLabel('[WPA2-PSK-CCMP][WPA2-PSK-TKIP][ESS]')).toBe('WPA2-P');
  });

  it('[WPA2][ESS] (no PSK/EAP marker) → WPA2-P', () => {
    expect(normalizeSecurityLabel('[WPA2][ESS]')).toBe('WPA2-P');
  });

  it('[WPA3-SAE][ESS] → WPA3-P (not WPA3-SAE)', () => {
    expect(normalizeSecurityLabel('[WPA3-SAE][ESS]')).toBe('WPA3-P');
  });

  it('[WPA3-EAP][ESS] → WPA3-E (not WPA3-EAP)', () => {
    expect(normalizeSecurityLabel('[WPA3-EAP][ESS]')).toBe('WPA3-E');
  });

  it('[WPA3][ESS] → WPA3-P', () => {
    expect(normalizeSecurityLabel('[WPA3][ESS]')).toBe('WPA3-P');
  });

  it('OWE → OWE', () => {
    expect(normalizeSecurityLabel('[OWE][ESS]')).toBe('OWE');
  });

  it('WPS only → WPS', () => {
    expect(normalizeSecurityLabel('[WPS][ESS]')).toBe('WPS');
  });

  it('[RSN-PSK-CCMP][ESS] → WPA2-P (RSN+PSK inferred as WPA2-Personal)', () => {
    expect(normalizeSecurityLabel('[RSN-PSK-CCMP][ESS]')).toBe('WPA2-P');
  });

  it('every output is a canonical label', () => {
    const inputs = [
      '',
      null,
      undefined,
      'NONE',
      'OPEN',
      'UNKNOWN',
      '[ESS]',
      '[WEP]',
      '[WPA-PSK]',
      '[WPA2-PSK-CCMP]',
      '[WPA2-EAP-CCMP]',
      '[WPA3-SAE]',
      '[WPA3-EAP]',
      '[WPA3]',
      '[OWE]',
      '[WPS]',
      '[RSN][ESS]',
      'GIBBERISH',
    ];
    for (const input of inputs) {
      const result = normalizeSecurityLabel(input);
      expect(CANONICAL_SECURITY_LABELS).toContain(result);
    }
  });
});

// ── formatSecurity backward-compat wrapper ────────────────────────────────────

describe('formatSecurity – backward compatibility', () => {
  it('returns canonical label by default', () => {
    expect(formatSecurity('[WPA2-PSK-CCMP][ESS]')).toBe('WPA2-P');
  });

  it('fallback is used only when result would be UNKNOWN', () => {
    expect(formatSecurity('UNKNOWN', 'Legacy')).toBe('Legacy');
    expect(formatSecurity('GIBBERISH_XYZ', 'Fallback')).toBe('Fallback');
  });

  it('fallback is NOT used when label is successfully resolved', () => {
    // Even though a fallback is supplied, a known label takes precedence
    expect(formatSecurity('[WPA2-PSK-CCMP]', 'Override')).toBe('WPA2-P');
    expect(formatSecurity('', 'Override')).toBe('OPEN');
  });
});

// ── B. OPEN filter semantics (mirrors backend SQL logic in JS) ─────────────

/**
 * Replicate the backend OPEN_PREDICATE logic from list.ts in JavaScript so
 * we can unit-test it without a database.
 *
 * OPEN_PREDICATE:
 *   ne.security IS NULL OR ne.security = ''
 *   OR ne.security !~* '(WPA|WEP|RSN|CCMP|TKIP|OWE|SAE)'
 *
 * The regex uses case-insensitive matching (hence .toLowerCase() here).
 */
const OPEN_EXCLUSION_REGEX = /(WPA|WEP|RSN|CCMP|TKIP|OWE|SAE)/i;

function matchesOpenPredicate(security: string | null | undefined): boolean {
  if (security == null || security === '') return true;
  return !OPEN_EXCLUSION_REGEX.test(security);
}

describe('OPEN filter semantics – backend predicate', () => {
  it('null security → matches OPEN', () => {
    expect(matchesOpenPredicate(null)).toBe(true);
  });

  it('empty string → matches OPEN', () => {
    expect(matchesOpenPredicate('')).toBe(true);
  });

  it('[ESS] only → matches OPEN (ESS is NOT in exclusion list)', () => {
    expect(matchesOpenPredicate('[ESS]')).toBe(true);
  });

  it('[IBSS] only → matches OPEN', () => {
    expect(matchesOpenPredicate('[IBSS]')).toBe(true);
  });

  it('[WPA2-PSK-CCMP][ESS] → does NOT match OPEN', () => {
    expect(matchesOpenPredicate('[WPA2-PSK-CCMP][ESS]')).toBe(false);
  });

  it('[WPA-PSK][ESS] → does NOT match OPEN', () => {
    expect(matchesOpenPredicate('[WPA-PSK][ESS]')).toBe(false);
  });

  it('[WEP][ESS] → does NOT match OPEN', () => {
    expect(matchesOpenPredicate('[WEP][ESS]')).toBe(false);
  });

  it('[WPA3-SAE][ESS] → does NOT match OPEN', () => {
    expect(matchesOpenPredicate('[WPA3-SAE][ESS]')).toBe(false);
  });

  it('[OWE][ESS] → does NOT match OPEN', () => {
    expect(matchesOpenPredicate('[OWE][ESS]')).toBe(false);
  });
});

// ── D. Analytics palette covers every canonical label ─────────────────────────

describe('SECURITY_TYPE_COLORS – palette completeness', () => {
  it('every canonical label has a color entry', () => {
    const missing = CANONICAL_SECURITY_LABELS.filter((label) => !(label in SECURITY_TYPE_COLORS));
    expect(missing).toEqual([]);
  });

  it('color values are valid hex strings', () => {
    const entries = Object.entries(SECURITY_TYPE_COLORS) as [string, string][];
    for (const [label, color] of entries) {
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        console.error(`Invalid color for ${label}: ${color}`);
      }
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
