export {};

/**
 * Tests for the BLE/BT security classification logic added in
 * 20260507_fix_mv_ble_exclusion.sql and explorerService.ts fallback query.
 *
 * The CASE expression classifies network capabilities into security labels.
 * BLE/BT checks must come BEFORE WiFi checks to avoid misclassification.
 *
 * This tests the classification logic as a pure function mirroring the SQL CASE.
 */

type NetworkType = 'W' | 'E' | 'B' | 'L' | 'N' | 'G';

/**
 * Mirrors the CASE expression in the MV and explorerService fallback query.
 * Keep in sync with:
 *   - sql/migrations/20260507_fix_mv_ble_exclusion.sql (security CASE)
 *   - server/src/services/explorerService.ts (fallback query security CASE)
 */
function classifySecurity(type: NetworkType, capabilities: string | null): string {
  const caps = capabilities ?? '';
  const upper = caps.toUpperCase();

  // BLE/BT checks first (before WiFi checks)
  if (type === 'E') {
    return 'BLE';
  }
  if (type === 'B') {
    return 'BT';
  }
  if (/;10$/.test(caps)) {
    return 'BLE';
  }
  if (upper === 'MISC' || upper === 'UNCATEGORIZED') {
    return 'BT';
  }

  // WiFi capability strings
  if (caps === '') {
    return 'OPEN';
  }
  if (upper.includes('WEP')) {
    return 'WEP';
  }
  if (/^\s*\[ESS\]\s*$/.test(upper)) {
    return 'OPEN';
  }
  if (/^\s*\[IBSS\]\s*$/.test(upper)) {
    return 'OPEN';
  }
  if (/RSN-OWE/.test(upper)) {
    return 'WPA3-OWE';
  }
  if (/RSN-SAE/.test(upper)) {
    return 'WPA3-P';
  }
  if (/(WPA3|SAE)/.test(upper) && /(EAP|MGT)/.test(upper)) {
    return 'WPA3-E';
  }
  if (/(WPA3|SAE)/.test(upper)) {
    return 'WPA3';
  }
  if (/(WPA2|RSN)/.test(upper) && /(EAP|MGT)/.test(upper)) {
    return 'WPA2-E';
  }
  if (/(WPA2|RSN)/.test(upper)) {
    return 'WPA2';
  }
  if (/WPA-/.test(upper) && !upper.includes('WPA2')) {
    return 'WPA';
  }
  if (
    upper.includes('WPA') &&
    !upper.includes('WPA2') &&
    !upper.includes('WPA3') &&
    !upper.includes('RSN')
  ) {
    return 'WPA';
  }
  if (upper.includes('WPS') && !upper.includes('WPA') && !upper.includes('RSN')) {
    return 'WPS';
  }
  if (/(CCMP|TKIP|AES)/.test(upper)) {
    return 'WPA2';
  }
  return 'UNKNOWN';
}

describe('BLE/BT security classification', () => {
  // --- Type-based classification (highest priority) ---

  test('type E → BLE regardless of capabilities', () => {
    expect(classifySecurity('E', null)).toBe('BLE');
    expect(classifySecurity('E', 'Uncategorized;10')).toBe('BLE');
    expect(classifySecurity('E', '[WPA2-PSK-CCMP]')).toBe('BLE'); // type wins
  });

  test('type B → BT regardless of capabilities', () => {
    expect(classifySecurity('B', null)).toBe('BT');
    expect(classifySecurity('B', 'Misc')).toBe('BT');
    expect(classifySecurity('B', '[WPA2-PSK-CCMP]')).toBe('BT'); // type wins
  });

  // --- WiGLE BLE capability encoding (;10 suffix = class code 0x000A = BLE) ---

  test('capabilities ending in ;10 → BLE (WiGLE BLE class code)', () => {
    expect(classifySecurity('W', 'Uncategorized;10')).toBe('BLE');
    expect(classifySecurity('W', 'Display/Speaker;10')).toBe('BLE');
    expect(classifySecurity('W', 'Misc;10')).toBe('BLE');
    expect(classifySecurity('W', ';10')).toBe('BLE');
  });

  test(';10 must be at end of string (not mid-string)', () => {
    // ";10" in the middle should NOT match the BLE pattern
    expect(classifySecurity('W', 'Uncategorized;10;20')).not.toBe('BLE');
  });

  // --- WiGLE BT capability strings ---

  test('capabilities "Misc" (case-insensitive) → BT', () => {
    expect(classifySecurity('W', 'Misc')).toBe('BT');
    expect(classifySecurity('W', 'MISC')).toBe('BT');
    expect(classifySecurity('W', 'misc')).toBe('BT');
  });

  test('capabilities "Uncategorized" (case-insensitive) → BT', () => {
    expect(classifySecurity('W', 'Uncategorized')).toBe('BT');
    expect(classifySecurity('W', 'UNCATEGORIZED')).toBe('BT');
  });

  // --- BLE/BT checks come BEFORE WiFi checks ---

  test('BLE type check fires before empty-string OPEN check', () => {
    // type E with null caps would be OPEN if WiFi logic ran first
    expect(classifySecurity('E', null)).toBe('BLE');
    expect(classifySecurity('B', null)).toBe('BT');
  });

  // --- WiFi classification still works correctly ---

  test('null/empty capabilities → OPEN for WiFi', () => {
    expect(classifySecurity('W', null)).toBe('OPEN');
    expect(classifySecurity('W', '')).toBe('OPEN');
  });

  test('[ESS] → OPEN', () => {
    expect(classifySecurity('W', '[ESS]')).toBe('OPEN');
  });

  test('WPA2 capabilities → WPA2', () => {
    expect(classifySecurity('W', '[WPA2-PSK-CCMP][ESS]')).toBe('WPA2');
    expect(classifySecurity('W', '[RSN-PSK-CCMP][ESS]')).toBe('WPA2');
  });

  test('WPA2 enterprise → WPA2-E', () => {
    expect(classifySecurity('W', '[WPA2-EAP-CCMP][ESS]')).toBe('WPA2-E');
    expect(classifySecurity('W', '[RSN-MGT-CCMP][ESS]')).toBe('WPA2-E');
  });

  test('WEP → WEP', () => {
    expect(classifySecurity('W', '[WEP][ESS]')).toBe('WEP');
  });

  test('WPA3-SAE → WPA3-P', () => {
    expect(classifySecurity('W', '[RSN-SAE-CCMP][ESS]')).toBe('WPA3-P');
  });

  test('OWE → WPA3-OWE', () => {
    expect(classifySecurity('W', '[RSN-OWE-CCMP][ESS]')).toBe('WPA3-OWE');
  });

  test('unknown WiFi capabilities → UNKNOWN', () => {
    expect(classifySecurity('W', '[SOME-UNKNOWN-PROTO]')).toBe('UNKNOWN');
  });

  // --- Regression: Axon body cam capabilities should not be misclassified ---

  test('Axon body cam (type E, Uncategorized;10) → BLE not UNKNOWN', () => {
    // Before the fix these would fall through to UNKNOWN
    expect(classifySecurity('E', 'Uncategorized;10')).toBe('BLE');
    expect(classifySecurity('E', 'Misc')).toBe('BLE'); // type E wins
  });

  test('DEI body cam (type E, null caps) → BLE not OPEN', () => {
    expect(classifySecurity('E', null)).toBe('BLE');
  });
});
