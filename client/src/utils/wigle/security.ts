/**
 * Canonical security taxonomy for ShadowCheck.
 *
 * Single source of truth used by:
 *  - frontend display (NetworkTableRow, analytics charts)
 *  - security normalization (formatSecurity / normalizeSecurityLabel)
 *  - backend filter interpretation (list.ts encryptionTypes)
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

export type CanonicalSecurity = (typeof CANONICAL_SECURITY_LABELS)[number];

/**
 * Normalize a raw Wi-Fi capabilities string to a canonical security label.
 *
 * Input is the raw `capabilities` / `security` field as received from WiGLE,
 * Kismet, or the database (e.g. `[WPA2-PSK-CCMP][ESS]`).
 *
 * Returns one of the CANONICAL_SECURITY_LABELS values.
 */
export const normalizeSecurityLabel = (raw: string | null | undefined): CanonicalSecurity => {
  const value = String(raw || '')
    .toUpperCase()
    .trim();

  // Explicit empty / none-equivalent → OPEN
  if (!value || value === 'NONE' || value === 'OPEN') return 'OPEN';

  // Explicit UNKNOWN passthrough
  if (value === 'UNKNOWN') return 'UNKNOWN';

  // Mixed/ambiguous "open or unknown" → OPEN
  if (value === 'OPEN/UNKNOWN') return 'OPEN';

  const hasWpa3 = value.includes('WPA3');
  const hasWpa2 = value.includes('WPA2');
  const hasWpa = value.includes('WPA');
  const hasWep = value.includes('WEP');
  const hasPsk = value.includes('PSK');
  const hasEap = value.includes('EAP') || value.includes('MGT') || value.includes('ENT');
  const hasSae = value.includes('SAE');
  const hasOwe = value.includes('OWE');
  const hasWps = value.includes('WPS');

  // OWE (Opportunistic Wireless Encryption) — independent protocol
  if (hasOwe && !hasWpa3 && !hasWpa2) return 'OWE';

  // WPA3 variants (most-specific first)
  if (hasWpa3 && (hasEap || value.includes('802.1X'))) return 'WPA3-E';
  if (hasWpa3 && (hasSae || hasPsk)) return 'WPA3-P';
  if (hasWpa3) return 'WPA3';

  // WPA2 variants
  if (hasWpa2 && hasEap) return 'WPA2-E';
  if (hasWpa2 && hasPsk) return 'WPA2-P';
  if (hasWpa2) return 'WPA2';

  // WPA (original / v1)
  if (hasWpa) return 'WPA';

  // WEP
  if (hasWep) return 'WEP';

  // WPS without any WPA/WEP marker
  if (hasWps) return 'WPS';

  // RSN without explicit WPA2/WPA3 version tag — infer variant from PSK/EAP
  if (value.includes('RSN')) {
    if (hasEap) return 'WPA2-E';
    if (hasPsk) return 'WPA2-P';
    return 'WPA2';
  }

  // CCMP/TKIP without version tag — infer variant from PSK/EAP
  if (value.includes('CCMP') || value.includes('TKIP')) {
    if (hasEap) return 'WPA2-E';
    if (hasPsk) return 'WPA2-P';
    return 'WPA2';
  }

  // Only infrastructure flags remain ([ESS], [IBSS]) → OPEN
  if (/^\[?(ESS|IBSS|DS|AD-HOC)\]?(\s*\[?(ESS|IBSS|DS|AD-HOC)\]?)*$/.test(value)) return 'OPEN';

  // Cannot categorize
  return 'UNKNOWN';
};

/**
 * Format a security capabilities string into a human-readable canonical label.
 *
 * Drop-in replacement for the old `formatSecurity`.  The `fallback` parameter
 * is preserved for backwards compatibility: when provided it overrides the
 * `UNKNOWN` return value so callers that supplied their own fallback keep
 * the same behaviour.
 *
 * @param capabilities - Raw security/capabilities string from WiGLE or DB
 * @param fallback     - Optional override when the result would be UNKNOWN
 */
export const formatSecurity = (
  capabilities: string | null | undefined,
  fallback?: string | null
): string => {
  const capabilityText = String(capabilities || '').trim();
  const hasCapabilityText = capabilityText.length > 0;

  // Prefer capability-derived label when capability text is present, because it
  // can preserve more specific variants (WPA2-E/WPA2-P, WPA3-E/WPA3-P).
  if (hasCapabilityText) {
    const capabilityLabel = normalizeSecurityLabel(capabilities);
    if (capabilityLabel !== 'UNKNOWN') {
      return capabilityLabel;
    }
  }

  // Fall back to backend-computed security label when capability text is
  // missing or not classifiable.
  const fallbackLabel = normalizeSecurityLabel(fallback);
  if (fallback && fallbackLabel !== 'UNKNOWN') return fallbackLabel;

  const label = normalizeSecurityLabel(capabilities);
  if (label === 'UNKNOWN' && fallback) return fallback;
  return label;
};
