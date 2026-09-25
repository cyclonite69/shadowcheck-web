/**
 * Filter E2E tests — Dashboard / Networks Explorer page
 *
 * Covers the universal filter panel on the primary networks list view.
 * Each test asserts that the UI interaction produces the correct JSON payload
 * in the outgoing /v2/networks/filtered request — proving the full
 * UI → Zustand store → buildFilteredRequestParams → API chain.
 *
 * Prerequisites:
 *   - Stack started via `sclocal` (real Mapbox token + DB seeded with data)
 *   - Admin user seeded (credentials: admin / password123 or E2E_ADMIN_PASSWORD env var)
 */

import { test, expect } from '@playwright/test';
import {
  openFilterPanel,
  closeFilterPanel,
  clearAllFilters,
  ensureSectionOpen,
  enableFilter,
  setSSIDFilter,
  setBSSIDFilter,
  setManufacturerFilter,
  setThreatScoreRange,
  setThreatLevelFilter,
  setRadioTypeFilter,
  enableEncryptionTypesSection,
  clickEncryptionTypeItem,
  setTimeframeFilter,
  setObservationCountMin,
  setCityFilter,
  setStateFilter,
  captureFilterRequest,
  captureFilterRequestAndResponse,
  assertFilterEnabled,
  assertFilterDisabled,
} from './helpers/filters';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await page.goto('/geospatial-explorer');
  await expect(page).toHaveTitle(/ShadowCheck/i);
  // Wait for the initial networks fetch to complete and at least one row to render.
  // This ensures captureFilterRequest only intercepts filter-triggered requests.
  await page.waitForResponse(
    (r) =>
      r.url().includes('/v2/networks/filtered') &&
      !r.url().includes('/matched-media') &&
      !r.url().includes('/unmatched-media') &&
      r.status() === 200,
    { timeout: 15000 }
  );
  await expect(page.locator('[role="row"]').first()).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Filter panel open/close
// ---------------------------------------------------------------------------

test.describe('Filter panel — open and close', () => {
  test('filter panel opens and closes via the toggle button', async ({ page }) => {
    await expect(page.locator('.filter-panel')).not.toBeVisible();
    await openFilterPanel(page);
    await expect(page.locator('.filter-panel')).toBeVisible();
    await closeFilterPanel(page);
    await expect(page.locator('.filter-panel')).not.toBeVisible({ timeout: 3000 });
  });

  test('filter panel contains all major section headings', async ({ page }) => {
    await openFilterPanel(page);
    const panel = page.locator('.filter-panel');
    await expect(panel.getByText('Identity')).toBeVisible();
    await expect(panel.getByText('Threat Intelligence')).toBeVisible();
    await expect(panel.getByText('Radio & Physical')).toBeVisible();
    await expect(panel.getByText('Security')).toBeVisible();
    await expect(panel.getByText('Time Range')).toBeVisible();
    await expect(panel.getByText('Forensic Activity')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// A. Identity filters
// ---------------------------------------------------------------------------

test.describe('Filter group A — Identity', () => {
  test('SSID filter: enabling sends ssid key in request', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setSSIDFilter(page, 'xfinity');
    });
    assertFilterEnabled(captured, 'ssid', 'xfinity');
  });

  test('SSID filter: exclusion syntax (-term) reaches API unchanged', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setSSIDFilter(page, '-xfinity');
    });
    assertFilterEnabled(captured, 'ssid', '-xfinity');
  });

  test('SSID filter: OR syntax (a|b) reaches API unchanged', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setSSIDFilter(page, 'xfinity|comcast');
    });
    assertFilterEnabled(captured, 'ssid', 'xfinity|comcast');
  });

  test('BSSID filter: enabling sends bssid key in request', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setBSSIDFilter(page, '00:11:22:*');
    });
    assertFilterEnabled(captured, 'bssid', '00:11:22:*');
  });

  test('Manufacturer filter: enabling sends manufacturer key in request', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setManufacturerFilter(page, 'Apple');
    });
    assertFilterEnabled(captured, 'manufacturer', 'Apple');
  });

  test('SSID filter: results all match the filtered SSID value', async ({ page }) => {
    await openFilterPanel(page);
    // xfinitywifi has 1,554 rows in the DB — guaranteed non-empty
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setSSIDFilter(page, 'xfinitywifi');
    });
    assertFilterEnabled(captured, 'ssid', 'xfinitywifi');
    // Exclude sibling-supplemented rows — they satisfy the sibling graph, not the SSID filter
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      expect(String(network['ssid'] ?? '').toLowerCase()).toContain('xfinity');
    }
  });

  test('Manufacturer filter: results all match the filtered manufacturer', async ({ page }) => {
    await openFilterPanel(page);
    // Hewlett Packard Enterprise has 3,981 rows — guaranteed non-empty
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setManufacturerFilter(page, 'Hewlett Packard Enterprise');
    });
    assertFilterEnabled(captured, 'manufacturer');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      expect(String(network['manufacturer'] ?? '').toLowerCase()).toContain('hewlett');
    }
  });
});

// ---------------------------------------------------------------------------
// G. Threat filters
// ---------------------------------------------------------------------------

test.describe('Filter group G — Threat', () => {
  test('Threat score min filter: sends mlThreatScoreMin in request', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setThreatScoreRange(page, 50, undefined);
    });
    assertFilterEnabled(captured, 'mlThreatScoreMin');
    expect(Number(captured.filters['mlThreatScoreMin'])).toBe(50);
  });

  test('Threat score range filter: sends both min and max', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setThreatScoreRange(page, 40, 80);
    });
    assertFilterEnabled(captured, 'mlThreatScoreMin');
    assertFilterEnabled(captured, 'mlThreatScoreMax');
    expect(Number(captured.filters['mlThreatScoreMin'])).toBe(40);
    expect(Number(captured.filters['mlThreatScoreMax'])).toBe(80);
  });

  test('Threat level filter: single category (high) reaches API', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setThreatLevelFilter(page, 'high');
    });
    assertFilterEnabled(captured, 'threatCategories');
    expect(captured.filters['threatCategories']).toContain('high');
  });

  test('Threat level filter: multiple categories reach API as array', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setThreatLevelFilter(page, 'critical', 'high');
    });
    assertFilterEnabled(captured, 'threatCategories');
    const cats = captured.filters['threatCategories'] as string[];
    expect(cats).toContain('critical');
    expect(cats).toContain('high');
  });

  test('Threat level CRITICAL: results all have CRITICAL threat level', async ({ page }) => {
    await openFilterPanel(page);
    // 124 CRITICAL networks in DB — guaranteed non-empty
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setThreatLevelFilter(page, 'critical');
    });
    assertFilterEnabled(captured, 'threatCategories');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      const level = (network['threat'] as Record<string, unknown>)?.['level'];
      expect(String(level ?? '')).toBe('CRITICAL');
    }
  });

  test('Threat level NONE: results all have NONE threat level', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setThreatLevelFilter(page, 'none');
    });
    assertFilterEnabled(captured, 'threatCategories');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      const level = (network['threat'] as Record<string, unknown>)?.['level'];
      expect(String(level ?? '')).toBe('NONE');
    }
  });
});

// ---------------------------------------------------------------------------
// B. Radio & Physical filters
// ---------------------------------------------------------------------------

test.describe('Filter group B — Radio & Physical', () => {
  test('Radio type WiFi: sends radioTypes with W in request', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setRadioTypeFilter(page, 'WiFi');
    });
    assertFilterEnabled(captured, 'radioTypes');
    expect(captured.filters['radioTypes']).toContain('W');
  });

  test('Radio type multiple: WiFi + BLE sends both type codes', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setRadioTypeFilter(page, 'WiFi', 'BLE');
    });
    assertFilterEnabled(captured, 'radioTypes');
    const types = captured.filters['radioTypes'] as string[];
    expect(types).toContain('W');
    expect(types).toContain('E');
  });

  test('Radio type WiFi: results all have type W', async ({ page }) => {
    await openFilterPanel(page);
    // 54,746 WiFi networks in DB
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setRadioTypeFilter(page, 'WiFi');
    });
    assertFilterEnabled(captured, 'radioTypes');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      expect(network['type']).toBe('W');
    }
  });

  test('Radio type BLE: results all have type E', async ({ page }) => {
    await openFilterPanel(page);
    // 122,737 BLE networks in DB
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setRadioTypeFilter(page, 'BLE');
    });
    assertFilterEnabled(captured, 'radioTypes');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      expect(network['type']).toBe('E');
    }
  });
});

// ---------------------------------------------------------------------------
// C. Security filters
// ---------------------------------------------------------------------------

test.describe('Filter group C — Security', () => {
  test('Encryption type OPEN: sends encryptionTypes in request', async ({ page }) => {
    await openFilterPanel(page);
    // Enable the FilterInput first (drains the empty-array debounce),
    // then capture only the checkbox-click request
    const body = await enableEncryptionTypesSection(page);
    const captured = await captureFilterRequest(page, () => clickEncryptionTypeItem(body, 'OPEN'));
    assertFilterEnabled(captured, 'encryptionTypes');
    expect(captured.filters['encryptionTypes']).toContain('OPEN');
  });

  test('Encryption type WPA3: sends WPA3 in encryptionTypes', async ({ page }) => {
    await openFilterPanel(page);
    const body = await enableEncryptionTypesSection(page);
    const captured = await captureFilterRequest(page, () => clickEncryptionTypeItem(body, 'WPA3'));
    assertFilterEnabled(captured, 'encryptionTypes');
    expect(captured.filters['encryptionTypes']).toContain('WPA3');
  });

  test('Encryption type WPA2: results all classify as WPA2 family', async ({ page }) => {
    await openFilterPanel(page);
    // 48,688 WPA2 networks in DB
    const body = await enableEncryptionTypesSection(page);
    const captured = await captureFilterRequestAndResponse(page, () =>
      clickEncryptionTypeItem(body, 'WPA2')
    );
    assertFilterEnabled(captured, 'encryptionTypes');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      const sec = String(network['security'] ?? '').toUpperCase();
      // The WPA2 filter matches WPA2/WPA2-P/WPA2-E via capabilities field.
      // Transition APs (WPA2-PSK + SAE) may store 'WPA3' in the MV security column
      // because SECURITY_FROM_CAPS_EXPR picks WPA3 rules first — they are valid results.
      // Assert the result is in the WiFi security family (not BLE/BT/OPEN/unknown).
      expect(sec).toMatch(/WPA|RSN|OWE/);
    }
  });

  test('Encryption type OPEN: results all have no security (OPEN)', async ({ page }) => {
    await openFilterPanel(page);
    // 9,627 OPEN networks in DB
    // The OPEN filter matches networks with empty capabilities — this includes BLE/BT
    // devices that have no capabilities string (they store 'BLE'/'BT' in the MV security
    // column but classify as OPEN under the capabilities-based filter expression).
    const body = await enableEncryptionTypesSection(page);
    const captured = await captureFilterRequestAndResponse(page, () =>
      clickEncryptionTypeItem(body, 'OPEN')
    );
    assertFilterEnabled(captured, 'encryptionTypes');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      const sec = String(network['security'] ?? '').toUpperCase();
      // OPEN filter returns networks with empty capabilities — includes OPEN, BLE, BT
      expect(sec).toMatch(/^(OPEN|BLE|BT)$/);
    }
  });
});

// ---------------------------------------------------------------------------
// D. Time Range filters
// ---------------------------------------------------------------------------

test.describe('Filter group D — Time Range', () => {
  test('Timeframe 7d: sends timeframe + temporalScope both enabled', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setTimeframeFilter(page, '7d');
    });
    // Both keys must be enabled — backend ignores timeframe without temporalScope
    assertFilterEnabled(captured, 'timeframe');
    assertFilterEnabled(captured, 'temporalScope');
    const tf = captured.filters['timeframe'] as Record<string, unknown>;
    expect(tf?.relativeWindow).toBe('7d');
  });

  test('Timeframe 90d: relativeWindow reaches API as 90d', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setTimeframeFilter(page, '90d');
    });
    assertFilterEnabled(captured, 'timeframe');
    assertFilterEnabled(captured, 'temporalScope');
    const tf = captured.filters['timeframe'] as Record<string, unknown>;
    expect(tf?.relativeWindow).toBe('90d');
  });

  test('Timeframe with first_seen scope: temporalScope value reaches API', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setTimeframeFilter(page, '30d', 'first_seen');
    });
    assertFilterEnabled(captured, 'timeframe');
    assertFilterEnabled(captured, 'temporalScope');
    expect(captured.filters['temporalScope']).toBe('first_seen');
    const tf = captured.filters['timeframe'] as Record<string, unknown>;
    expect(tf?.relativeWindow).toBe('30d');
  });

  test('Timeframe with last_seen scope: temporalScope value reaches API', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setTimeframeFilter(page, '7d', 'last_seen');
    });
    assertFilterEnabled(captured, 'timeframe');
    assertFilterEnabled(captured, 'temporalScope');
    expect(captured.filters['temporalScope']).toBe('last_seen');
  });

  test('Timeframe 90d last_seen: results all have last_seen within 90 days', async ({ page }) => {
    await openFilterPanel(page);
    // Data goes up to 2026-06-05; 90d window returns 24,324 networks
    // 7d/30d windows return 0 — use 90d for a guaranteed non-empty result set
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setTimeframeFilter(page, '90d', 'last_seen');
    });
    assertFilterEnabled(captured, 'timeframe');
    assertFilterEnabled(captured, 'temporalScope');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    for (const network of filtered) {
      const lastSeen = new Date(network['last_seen'] as string).getTime();
      expect(lastSeen).toBeGreaterThanOrEqual(cutoff);
    }
  });
});

// ---------------------------------------------------------------------------
// F. Quality filters
// ---------------------------------------------------------------------------

test.describe('Filter group F — Data Quality', () => {
  test('Min observations: sends observationCountMin in request', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setObservationCountMin(page, 5);
    });
    assertFilterEnabled(captured, 'observationCountMin');
    expect(Number(captured.filters['observationCountMin'])).toBe(5);
  });

  test('Min observations 10: results all have at least 10 observations', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setObservationCountMin(page, 10);
    });
    assertFilterEnabled(captured, 'observationCountMin');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      expect(Number(network['observations'] ?? 0)).toBeGreaterThanOrEqual(10);
    }
  });
});

// ---------------------------------------------------------------------------
// H. Geocoding filters
// ---------------------------------------------------------------------------

test.describe('Filter group H — Geocoding', () => {
  test('City filter: sends geocodedCity in request', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setCityFilter(page, 'Detroit');
    });
    assertFilterEnabled(captured, 'geocodedCity');
    expect(captured.filters['geocodedCity']).toBe('Detroit');
  });

  test('State filter: sends geocodedState in request', async ({ page }) => {
    await openFilterPanel(page);
    const captured = await captureFilterRequest(page, async () => {
      await setStateFilter(page, 'MI');
    });
    assertFilterEnabled(captured, 'geocodedState');
    expect(captured.filters['geocodedState']).toBe('MI');
  });

  test('City Flint: results all have geocoded_city starting with Flint', async ({ page }) => {
    await openFilterPanel(page);
    // 174,011 networks geocoded to Flint in the DB
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setCityFilter(page, 'Flint');
    });
    assertFilterEnabled(captured, 'geocodedCity');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      expect(String(network['geocoded_city'] ?? '').toLowerCase()).toMatch(/^flint/);
    }
  });

  test('State MI: results all have geocoded_state of MI or Michigan', async ({ page }) => {
    await openFilterPanel(page);
    // Filter uses starts-with matching; DB stores both 'MI' and 'Michigan'
    const captured = await captureFilterRequestAndResponse(page, async () => {
      await setStateFilter(page, 'MI');
    });
    assertFilterEnabled(captured, 'geocodedState');
    const filtered = captured.data.filter((n) => !n['_siblingSupplemented']);
    expect(filtered.length).toBeGreaterThan(0);
    for (const network of filtered) {
      const state = String(network['geocoded_state'] ?? '');
      expect(state.toLowerCase()).toMatch(/^mi/);
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-filter: two filters active in one request
// ---------------------------------------------------------------------------

test.describe('Multi-filter interactions', () => {
  test('SSID + Manufacturer: both keys appear in a single request', async ({ page }) => {
    await openFilterPanel(page);
    // Enable both filters and fill them without intermediate debounce waits,
    // then let a single waitForTimeout flush the combined debounce.
    const captured = await captureFilterRequest(
      page,
      async () => {
        await ensureSectionOpen(page, 'Identity');
        await enableFilter(page, 'SSID');
        await page.getByPlaceholder('Network name or comma list...').fill('xfinity');
        await enableFilter(page, 'Manufacturer / OUI');
        await page.getByPlaceholder('Apple, Samsung, 001A2B...').fill('Apple');
        // Single debounce wait after both inputs are filled
        await page.waitForTimeout(600);
      },
      12000
    );
    assertFilterEnabled(captured, 'ssid');
    assertFilterEnabled(captured, 'manufacturer');
    expect(captured.filters['ssid']).toBe('xfinity');
    expect(captured.filters['manufacturer']).toBe('Apple');
  });

  test('Threat level + SSID: both keys appear in request', async ({ page }) => {
    await openFilterPanel(page);
    // Set threat level filter outside the capture window and wait for its full
    // debounce (300ms in setThreatLevelFilter + explicit extra margin) to settle
    await setThreatLevelFilter(page, 'high');
    await page.waitForTimeout(400); // extra drain on top of helper's 300ms
    // The SSID-triggered request will carry both enabled flags from the store
    const captured = await captureFilterRequest(page, async () => {
      await setSSIDFilter(page, 'test');
    });
    assertFilterEnabled(captured, 'threatCategories');
    assertFilterEnabled(captured, 'ssid');
  });
});

// ---------------------------------------------------------------------------
// Clear all filters
// ---------------------------------------------------------------------------

test.describe('Filter reset', () => {
  test('clear all: disables all enabled filters and triggers a clean request', async ({ page }) => {
    await openFilterPanel(page);
    // Enable a filter first
    await setSSIDFilter(page, 'test');

    // Now clear and assert the next request has no enabled filters
    const captured = await captureFilterRequest(page, async () => {
      await clearAllFilters(page);
    });

    // After clear, ssid must not be enabled
    assertFilterDisabled(captured, 'ssid');
    // No keys should be true in enabled map
    const activeKeys = Object.entries(captured.enabled).filter(([, v]) => v === true);
    expect(activeKeys).toHaveLength(0);
  });
});
