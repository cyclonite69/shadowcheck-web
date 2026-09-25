/**
 * WiGLE map tooltip — temporal field verification
 *
 * Verifies that first_seen, last_seen, and the highlighted "Seen" (time) cell
 * are populated in the WiGLE map tooltip for v3-only records (no v2 linkage),
 * and that timespan_days and the Data Quality stat cell render correctly.
 *
 * Strategy:
 * - Intercept /api/wigle/page/network/* → return deterministic mock with known
 *   dates, qos, and observation count regardless of which point is clicked.
 * - Wait for the map to initialise and for __wigleHandleUnclustered to be
 *   exposed on window (requires the e2e build: `npm run build:e2e` / the
 *   `frontend-e2e` Docker target which sets VITE_E2E=true).
 * - Call __wigleHandleUnclustered directly with a synthetic feature/lngLat
 *   object, bypassing Mapbox viewport state, cluster/zoom races, and
 *   fitBounds overrides entirely.
 *
 * WHY THIS APPROACH:
 * Previous iterations used flyTo/jumpTo + canvas clicks. Both fail reliably:
 *   - fitBounds(maxZoom:12) in useWigleDataSync fires on data load and
 *     overrides any programmatic zoom before the canvas click lands.
 *   - queryRenderedFeatures at computed coordinates hits cluster bubbles,
 *     not unclustered points, at the zoom levels the map settles at.
 * Exposing the handler as a window seam and invoking it directly is the
 * canonical solution. See docs/e2e/README.md § Mapbox test seam pattern.
 */

import { test, expect } from '@playwright/test';

// Known dates for the mock — v3-only record, no v2 fields
const FIRST_SEEN = '2023-02-17T08:00:00.000Z';
const LAST_SEEN = '2026-02-17T08:00:00.000Z';
const EXPECTED_TIMESPAN_DAYS = 1096; // Math.round((last - first) / 86_400_000)

// Coordinates used in the synthetic event — realistic but arbitrary
const MOCK_LNG = -83.696;
const MOCK_LAT = 43.023;

const MOCK_NETWORK_RESPONSE = {
  wigle: {
    bssid: 'A4:43:8C:64:2A:43',
    ssid: 'TEST-WIGLE-V3',
    name: 'TEST-WIGLE-V3',
    type: 'W',
    encryption: '[WPA2-PSK-CCMP][ESS]',
    channel: 6,
    frequency: 2437,
    qos: 5,
    comment: null,
    wigle_source: 'wigle-v3',
    wigle_v2_firsttime: null,
    wigle_v2_lasttime: null,
    wigle_v2_lastupdt: null,
    wigle_v2_trilat: null,
    wigle_v2_trilong: null,
    wigle_v2_city: null,
    wigle_v2_region: null,
    wigle_v2_road: null,
    wigle_v2_housenumber: null,
    has_wigle_v2_record: false,
    wigle_v3_first_seen: FIRST_SEEN,
    wigle_v3_last_seen: LAST_SEEN,
    wigle_v3_observation_count: 999,
    wigle_v3_centroid_lat: MOCK_LAT,
    wigle_v3_centroid_lon: MOCK_LNG,
    wigle_v3_spread_m: 120,
    has_wigle_v3_observations: true,
    display_lat: MOCK_LAT,
    display_lon: MOCK_LNG,
    display_coordinate_source: 'wigle-v3-centroid',
    manufacturer: 'Cisco Systems',
    public_nonstationary_flag: false,
    public_ssid_variant_flag: false,
    wigle_precision_warning: false,
    recent_ssid: 'TEST-WIGLE-V3',
    recent_channel: 6,
    recent_frequency: 2437,
    recent_accuracy: 8,
    geocoded_address: '123 Test St, Flint, MI',
  },
  localLinkage: {
    has_local_match: false,
    local_observation_count: 0,
    local_first_seen: null,
    local_last_seen: null,
  },
};

/**
 * Navigate to /wigle, intercept the enrichment API, wait for the map and
 * handler seam to be ready, then fire the handler with a synthetic feature.
 *
 * Returns after the handler has been invoked — callers still need to wait for
 * the enriched popup via waitForPopup().
 */
async function setupAndFireHandler(page: import('@playwright/test').Page) {
  // Intercept enrichment call for any bssid — return deterministic mock
  await page.route('**/api/wigle/page/network/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_NETWORK_RESPONSE),
    });
  });

  await page.goto('/wigle');

  // Wait for Mapbox map instance
  await page.waitForFunction(() => Boolean((window as any).__wigleMapInstance), { timeout: 15000 });

  // Wait for map style to finish loading (needed for the map to be interactive,
  // not needed for handler invocation but avoids noise in other map events)
  await page.waitForFunction(() => (window as any).__wigleMapInstance?.isStyleLoaded?.(), {
    timeout: 15000,
  });

  // Wait for the handler seam to be present.
  // Requires the e2e build (VITE_E2E=true). If this times out, the running
  // container is the production build — rebuild with:
  //   docker compose -f docker-compose.yml -f docker-compose.e2e.yml build frontend
  await page.waitForFunction(() => typeof (window as any).__wigleHandleUnclustered === 'function', {
    timeout: 10000,
  });

  // Invoke the handler directly with a synthetic Mapbox-style event object.
  // This is structurally identical to what Mapbox passes on a real click:
  //   e.features[0].properties  — the GeoJSON feature properties
  //   e.lngLat                  — the click coordinate
  // No canvas click, no viewport state, no cluster/zoom dependency.
  await page.evaluate(
    ({ lng, lat, bssid }) => {
      const syntheticEvent = {
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
              bssid,
              netid: bssid,
              ssid: 'TEST-WIGLE-V3',
              trilat: lat,
              trilong: lng,
              wigle_source: 'wigle-v3',
            },
          },
        ],
        lngLat: { lng, lat },
      };
      (window as any).__wigleHandleUnclustered(syntheticEvent);
    },
    { lng: MOCK_LNG, lat: MOCK_LAT, bssid: MOCK_NETWORK_RESPONSE.wigle.bssid }
  );
}

/**
 * Wait for the enriched popup to appear after the handler was fired.
 * Polls for the WiGLE observation count from the mock (999) which is only
 * present after getWiglePageNetwork resolves and popup.setHTML fires —
 * no fixed sleep needed.
 */
async function waitForPopup(page: import('@playwright/test').Page) {
  const popup = page.locator('.sc-popup');
  await expect(popup).toBeVisible({ timeout: 10000 });
  // Wait for enrichment: 999 obs count only appears after the intercepted
  // /api/wigle/page/network/* route resolves and setHTML fires.
  await expect(popup).toContainText('999', { timeout: 8000 });
  return popup;
}

test.describe('WiGLE tooltip — temporal fields (v3-only record)', () => {
  test('Timestamps section shows First (2023), Last (2026), and Seen (2026) cells', async ({
    page,
  }) => {
    await setupAndFireHandler(page);
    const popup = await waitForPopup(page);

    // Open the Timestamps <details> section
    const details = popup.locator('details');
    await expect(details).toBeVisible({ timeout: 3000 });
    await details.click();
    // Wait for the expanded content to be visible rather than a fixed sleep
    await expect(details.locator('summary ~ div')).toBeVisible({ timeout: 3000 });

    const html = await popup.innerHTML();

    // Section headers
    expect(html).toContain('First');
    expect(html).toContain('Last');
    expect(html).toContain('Seen');

    // Year values from known dates — these prove the fields resolved
    expect(html).toContain('2023'); // first_seen year
    expect(html).toContain('2026'); // last_seen and time (Seen cell)

    // Seen cell is highlighted gold when present — presence of the color marker
    // confirms time resolved (not an em-dash)
    expect(html).toContain('#eab308');
  });

  test('Observations row shows 999 obs and 1096 days timespan', async ({ page }) => {
    await setupAndFireHandler(page);
    const popup = await waitForPopup(page);

    const html = await popup.innerHTML();

    // WiGLE observation count from mock
    expect(html).toContain('999');

    // Derived timespan_days: Math.round((last - first) / 86_400_000)
    expect(html).toContain(String(EXPECTED_TIMESPAN_DAYS));
  });

  test('Data Quality stat cell renders from qos=5', async ({ page }) => {
    await setupAndFireHandler(page);
    const popup = await waitForPopup(page);

    const html = await popup.innerHTML();

    // qos=5/7 ≈ 71% → the Data Quality stat bar label and percentage should be present
    expect(html).toContain('Data Quality');
    expect(html).toContain('71%');
  });
});
