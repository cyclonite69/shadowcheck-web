import { test, expect } from '@playwright/test';

// E2E tests for Geospatial Explorer sorting behavior.
// Preconditions: tests/fixtures/seed_sorting_test_data_v2.sql has been applied and
// app.api_network_explorer_mv refreshed. These tests query the API directly.

const expectedByObservations = [
  '02:SC:SORT:TE:ST:01',
  '02:SC:SORT:TE:ST:02',
  '02:SC:SORT:TE:ST:03',
  '02:SC:SORT:TE:ST:09',
  '02:SC:SORT:TE:ST:04',
  '02:SC:SORT:TE:ST:05',
  '02:SC:SORT:TE:ST:06',
  '02:SC:SORT:TE:ST:0A',
  '02:SC:SORT:TE:ST:07',
  '02:SC:SORT:TE:ST:08',
];

test.describe('Geospatial Explorer sorting', () => {
  test('observations asc sorts numerically (not lexicographically)', async ({ request }) => {
    const res = await request.get('/api/v2/networks/filtered?sort=observations&order=asc&limit=20');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    // The API may return data in different wrappers. Try common shapes.
    const rows = body?.data ?? body?.rows ?? body;
    expect(Array.isArray(rows)).toBeTruthy();

    const bssids = rows.map((r: any) => r.bssid);
    // Ensure the first 10 rows match the seeded ascending numeric order
    expect(bssids.slice(0, expectedByObservations.length)).toEqual(expectedByObservations);
  });

  test('multi-column: threat_score desc, observations desc breaks ties by observations', async ({
    request,
  }) => {
    const res = await request.get(
      '/api/v2/networks/filtered?sort=threat_score,observations&order=desc,desc&limit=20'
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const rows = body?.data ?? body?.rows ?? body;
    expect(Array.isArray(rows)).toBeTruthy();

    const bssids = rows.map((r: any) => r.bssid);
    // Top two entries should be the tied threat_score networks, ordered by observations desc
    expect(bssids[0]).toBe('02:SC:SORT:TE:ST:0A'); // obs 15
    expect(bssids[1]).toBe('02:SC:SORT:TE:ST:09'); // obs 5
  });
});
