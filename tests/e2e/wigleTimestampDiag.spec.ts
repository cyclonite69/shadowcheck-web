/**
 * Diagnostic: WiGLE popup timestamp pipeline
 *
 * Captures console logs at every instrumentation boundary to identify
 * exactly where wigle_v3_last_seen stops propagating to the SEEN cell.
 *
 * Run with:
 *   E2E_ADMIN_PASSWORD=<pw> npx playwright test tests/e2e/wigleTimestampDiag.spec.ts --reporter=list
 */

import { test, expect } from '@playwright/test';

// Known dates matching the wigleTooltipTemporal mock — deterministic
const FIRST_SEEN = '2023-02-17T08:00:00.000Z';
const LAST_SEEN = '2026-02-17T08:00:00.000Z';
const MOCK_BSSID = 'A4:43:8C:64:2A:43';
const MOCK_LNG = -83.696;
const MOCK_LAT = 43.023;

const MOCK_NETWORK_RESPONSE = {
  wigle: {
    bssid: MOCK_BSSID,
    ssid: 'DIAG-V3',
    name: 'DIAG-V3',
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
    wigle_v3_observation_count: 42,
    wigle_v3_centroid_lat: MOCK_LAT,
    wigle_v3_centroid_lon: MOCK_LNG,
    wigle_v3_spread_m: 50,
    has_wigle_v3_observations: true,
    display_lat: MOCK_LAT,
    display_lon: MOCK_LNG,
    display_coordinate_source: 'wigle-v3-centroid',
    manufacturer: 'Cisco',
    public_nonstationary_flag: false,
    public_ssid_variant_flag: false,
    wigle_precision_warning: false,
    recent_ssid: 'DIAG-V3',
    recent_channel: 6,
    recent_frequency: 2437,
    recent_accuracy: 8,
    geocoded_address: '1 Diag St, Test, MI',
  },
  localLinkage: {
    has_local_match: false,
    local_observation_count: 0,
    local_first_seen: null,
    local_last_seen: null,
  },
};

test('capture popup pipeline boundary logs for a v3 network', async ({ page }) => {
  // Collect every [popup:*] console message in order
  const logs: { tag: string; traceId: string; data: any }[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (!text.includes('[popup:')) {
      return;
    }
    // Playwright serialises structured console.log args — grab them
    const args = msg.args();
    // tag is first arg, traceId is second, data object is third
    Promise.all(args.map((a) => a.jsonValue().catch(() => String(a)))).then((vals) => {
      logs.push({
        tag: String(vals[0] ?? ''),
        traceId: String(vals[1] ?? ''),
        data: vals[2] ?? {},
      });
    });
  });

  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  // Intercept enrichment so we get deterministic timestamps regardless of DB state
  await page.route('**/api/wigle/page/network/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_NETWORK_RESPONSE),
    });
  });

  await page.goto('/wigle');

  await page.waitForFunction(() => Boolean((window as any).__wigleMapInstance), { timeout: 15000 });
  await page.waitForFunction(() => (window as any).__wigleMapInstance?.isStyleLoaded?.(), {
    timeout: 15000,
  });
  await page.waitForFunction(() => typeof (window as any).__wigleHandleUnclustered === 'function', {
    timeout: 10000,
  });

  // Fire the handler with a synthetic v3 feature — no canvas click, no zoom/cluster dependency
  await page.evaluate(
    ({ lng, lat, bssid }) => {
      (window as any).__wigleHandleUnclustered({
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
              bssid,
              netid: bssid,
              ssid: 'DIAG-V3',
              trilat: lat,
              trilong: lng,
              wigle_source: 'wigle-v3',
              // No lasttime / observed_at on the feature — simulates the real v3 case
            },
          },
        ],
        lngLat: { lng, lat },
      });
    },
    { lng: MOCK_LNG, lat: MOCK_LAT, bssid: MOCK_BSSID }
  );

  // Wait for popup to appear
  await expect(page.locator('.sc-popup')).toBeVisible({ timeout: 8000 });

  // Wait for enrichment: 42 obs count only appears after mock resolves
  await expect(page.locator('.sc-popup')).toContainText('42', { timeout: 8000 });

  // Let async console.log promises resolve
  await page.waitForTimeout(600);

  // Expand the Timestamps <details> section if present
  const details = page.locator('.sc-popup details');
  if (await details.isVisible({ timeout: 2000 }).catch(() => false)) {
    await details.click();
    await page.waitForTimeout(200);
  }

  // Read the rendered SEEN cell text from the DOM
  const seenDomText = await page.evaluate(() => {
    const popup = document.querySelector('.sc-popup');
    if (!popup) {
      return null;
    }
    for (const div of Array.from(popup.querySelectorAll('div'))) {
      if (div.textContent?.trim() === 'Seen') {
        const sibling = div.parentElement?.querySelector('div:last-child');
        return sibling?.textContent?.trim() ?? null;
      }
    }
    return null;
  });

  console.log('\n=== DOM RESULT ===');
  console.log('SEEN cell text in rendered popup:', JSON.stringify(seenDomText));

  const enrichmentFailed = logs.find(
    (l) =>
      l.tag === '[popup:enrichment-failed]' ||
      (typeof l.tag === 'string' && l.tag.includes('enrichment'))
  );

  if (enrichmentFailed) {
    console.log('ENRICHMENT FAILED:', enrichmentFailed);
  }

  // The SEEN cell must contain a real timestamp (not "—") — enrichment reached the server
  // and returned valid wigle_v3_last_seen data.
  expect(seenDomText, 'SEEN cell should contain a timestamp, not "—"').not.toBe('—');
  expect(seenDomText, 'SEEN cell should not be null').not.toBeNull();
  expect(enrichmentFailed, 'Enrichment must not fail').toBeUndefined();
});
