export {};

/**
 * Device Intel Library — unit tests.
 * Validates manifest integrity, lookup helpers, and schema compat.
 */

import {
  normalizeDeviceClass,
  formatDeviceType,
  getDeviceIntelEntry,
  hasDeviceIntel,
  getDeviceIntelCategory,
  hasVendorIntelForDeviceClass,
} from '../../client/src/utils/deviceClassUtils';

const manifest = require('../../client/src/components/vendor-intel/vendor_intel_manifest.json');

// ─── Manifest integrity ───────────────────────────────────────────────────────

describe('vendor_intel_manifest integrity', () => {
  test('loads and has vendors array', () => {
    expect(Array.isArray(manifest.vendors)).toBe(true);
    expect(manifest.vendors.length).toBeGreaterThanOrEqual(30);
  });

  test('all vendor_key values are unique', () => {
    const keys = manifest.vendors.map((v: any) => v.vendor_key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  test('all entries have required fields', () => {
    for (const v of manifest.vendors) {
      expect(typeof v.vendor_key).toBe('string');
      expect(typeof v.display_name).toBe('string');
      expect(typeof v.surveillance_type).toBe('string');
      expect(Array.isArray(v.oui_prefixes)).toBe(true);
      expect(Array.isArray(v.docs)).toBe(true);
    }
  });

  test('threat_tier is 1|2|3 or null — never undefined', () => {
    for (const v of manifest.vendors) {
      expect([1, 2, 3, null]).toContain(v.threat_tier);
    }
  });

  test('all entries with docs have required doc fields', () => {
    for (const v of manifest.vendors) {
      for (const doc of v.docs) {
        expect(typeof doc.title).toBe('string');
        expect(typeof doc.file).toBe('string');
        expect(typeof doc.source_type).toBe('string');
      }
    }
  });

  test('new entries carry a category field', () => {
    const newEntries = manifest.vendors.filter((v: any) => v.threat_tier === null);
    expect(newEntries.length).toBeGreaterThan(0);
    for (const v of newEntries) {
      expect(typeof v.category).toBe('string');
    }
  });

  test('docs_status is needs_collection, not_applicable, partial, or absent', () => {
    const allowed = new Set(['needs_collection', 'not_applicable', 'partial', undefined]);
    for (const v of manifest.vendors) {
      expect(allowed.has(v.docs_status)).toBe(true);
    }
  });

  test('no entry claims "33 confirmed" or uses "IANA" in confidence notes', () => {
    for (const v of manifest.vendors) {
      if (v.confidence_notes) {
        expect(v.confidence_notes).not.toMatch(/33 confirmed/);
        expect(v.confidence_notes).not.toMatch(/IANA\//);
      }
      if (v.description) {
        expect(v.description).not.toMatch(/FCC ID: /); // must say "reported as", not bare assertion
      }
    }
  });
});

// ─── Existing SIGINT entries still resolve ────────────────────────────────────

describe('existing SIGINT entries resolve', () => {
  test('L3HARRIS_STINGRAY resolves by surveillance_type', () => {
    const entry = getDeviceIntelEntry('L3HARRIS_STINGRAY');
    expect(entry).not.toBeNull();
    expect(entry!.display_name).toBe('L3Harris Technologies (Harris Corp)');
    expect(entry!.category).toBe('SIGINT_INTERCEPT');
    expect(entry!.threat_tier).toBe(1);
  });

  test('SEPTIER_IMSI resolves (surveillance_type key)', () => {
    const entry = getDeviceIntelEntry('SEPTIER_IMSI');
    expect(entry).not.toBeNull();
    expect(entry!.display_name).toBe('Septier Communication');
  });

  test('SEPTIER_WIFICATCHER resolves (device_class key)', () => {
    const entry = getDeviceIntelEntry('SEPTIER_WIFICATCHER');
    expect(entry).not.toBeNull();
    expect(entry!.surveillance_type).toBe('SEPTIER_IMSI');
  });

  test('hasVendorIntelForDeviceClass backward-compat still works', () => {
    expect(hasVendorIntelForDeviceClass('L3HARRIS_STINGRAY')).toBe(true);
    expect(hasVendorIntelForDeviceClass('PEPLINK')).toBe(true);
    expect(hasVendorIntelForDeviceClass(null)).toBe(false);
    expect(hasVendorIntelForDeviceClass('NOT_A_REAL_CLASS')).toBe(false);
  });
});

// ─── New operational entries resolve ─────────────────────────────────────────

describe('new operational entries resolve', () => {
  test('AXON_BODY_CAMERA resolves with category BODY_CAMERA', () => {
    const entry = getDeviceIntelEntry('AXON_BODY_CAMERA');
    expect(entry).not.toBeNull();
    expect(entry!.category).toBe('BODY_CAMERA');
    expect(entry!.threat_tier).toBeNull();
    // docs_status is 'partial' once at least one doc is archived
    expect(['needs_collection', 'partial']).toContain(entry!.docs_status);
  });

  test('FLOCK_SAFETY_CAMERA resolves with category ALPR_CAMERA', () => {
    const entry = getDeviceIntelEntry('FLOCK_SAFETY_CAMERA');
    expect(entry).not.toBeNull();
    expect(entry!.category).toBe('ALPR_CAMERA');
    expect(entry!.oui_prefixes.length).toBeGreaterThan(0);
  });

  test('SHOTSPOTTER_SENSOR resolves with category ACOUSTIC_SENSOR', () => {
    const entry = getDeviceIntelEntry('SHOTSPOTTER_SENSOR');
    expect(entry).not.toBeNull();
    expect(entry!.category).toBe('ACOUSTIC_SENSOR');
  });

  test('MOTOROLA_BWC resolves with category BODY_CAMERA', () => {
    const entry = getDeviceIntelEntry('MOTOROLA_BWC');
    expect(entry).not.toBeNull();
    expect(entry!.category).toBe('BODY_CAMERA');
  });
});

// ─── Dual-use pentest gear ────────────────────────────────────────────────────

describe('dual-use pentest gear entries', () => {
  test('FLIPPER_ZERO resolves as DUAL_USE_PENTEST_GEAR', () => {
    const entry = getDeviceIntelEntry('FLIPPER_ZERO');
    expect(entry).not.toBeNull();
    expect(entry!.category).toBe('DUAL_USE_PENTEST_GEAR');
    // docs populated in pass 2 — docs_status is now 'partial'
    expect(['needs_collection', 'partial']).toContain(entry!.docs_status);
    expect(entry!.threat_tier).toBeNull();
  });

  test('FLIPPER_ZERO description does not imply maliciousness', () => {
    const entry = getDeviceIntelEntry('FLIPPER_ZERO');
    expect(entry!.description).not.toMatch(/malicious|attacker|threat actor/i);
  });

  test('HAK5_WIFI_PINEAPPLE is library-only (no active OUI)', () => {
    const entry = getDeviceIntelEntry('HAK5_WIFI_PINEAPPLE');
    expect(entry).not.toBeNull();
    expect(entry!.oui_prefixes).toHaveLength(0);
    expect(entry!.confidence_notes).toMatch(/library-only/);
  });

  test('UBERTOOTH_ONE and PROXMARK3 are library-only', () => {
    for (const key of ['UBERTOOTH_ONE', 'PROXMARK3']) {
      const entry = getDeviceIntelEntry(key);
      expect(entry).not.toBeNull();
      expect(entry!.confidence_notes).toMatch(/[Ll]ibrary-only/);
    }
  });
});

// ─── deviceClassUtils helpers ─────────────────────────────────────────────────

describe('deviceClassUtils helpers', () => {
  test('getDeviceIntelCategory returns correct category', () => {
    expect(getDeviceIntelCategory('AXON_BODY_CAMERA')).toBe('BODY_CAMERA');
    expect(getDeviceIntelCategory('FLOCK_SAFETY_CAMERA')).toBe('ALPR_CAMERA');
    expect(getDeviceIntelCategory('FLIPPER_ZERO')).toBe('DUAL_USE_PENTEST_GEAR');
    expect(getDeviceIntelCategory('L3HARRIS_STINGRAY')).toBe('SIGINT_INTERCEPT');
    expect(getDeviceIntelCategory('NOT_REAL')).toBeNull();
    expect(getDeviceIntelCategory(null)).toBeNull();
  });

  test('hasDeviceIntel returns true for all 32 manifest entries via both keys', () => {
    const manifest = require('../../client/src/components/vendor-intel/vendor_intel_manifest.json');
    for (const v of manifest.vendors) {
      expect(hasDeviceIntel(v.surveillance_type)).toBe(true);
      if (v.device_class) {
        expect(hasDeviceIntel(v.device_class)).toBe(true);
      }
    }
  });

  test('normalizeDeviceClass handles edge cases', () => {
    expect(normalizeDeviceClass(null)).toBeNull();
    expect(normalizeDeviceClass(undefined)).toBeNull();
    expect(normalizeDeviceClass('')).toBeNull();
    expect(normalizeDeviceClass('  flock_safety_camera  ')).toBe('FLOCK_SAFETY_CAMERA');
  });

  test('formatDeviceType returns label for known classes', () => {
    expect(formatDeviceType('AXON_BODY_CAMERA')).toBe('Axon Body Camera');
    expect(formatDeviceType('FLOCK_SAFETY_CAMERA')).toBe('Flock Safety Camera');
    expect(formatDeviceType('FLIPPER_ZERO')).toBe('Flipper Zero');
    expect(formatDeviceType(null)).toBe('');
  });

  test('formatDeviceType prettifies unknown classes', () => {
    expect(formatDeviceType('SOME_NEW_DEVICE')).toBe('Some New Device');
  });

  test('getDeviceIntelEntry returns null for unknown class', () => {
    expect(getDeviceIntelEntry('TOTALLY_UNKNOWN_DEVICE_CLASS')).toBeNull();
    expect(getDeviceIntelEntry(null)).toBeNull();
    expect(getDeviceIntelEntry(undefined)).toBeNull();
  });

  test('entry with docs does not crash getDeviceIntelEntry', () => {
    const entry = getDeviceIntelEntry('FLIPPER_ZERO');
    expect(entry).not.toBeNull();
    // docs populated in pass 2 — docs_status is now 'partial'
    expect(['needs_collection', 'partial']).toContain(entry!.docs_status);
  });
});
