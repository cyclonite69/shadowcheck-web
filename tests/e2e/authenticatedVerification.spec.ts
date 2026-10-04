// Note: Tests 2 and 6 rely on direct PostgreSQL access via local docker exec (shadowcheck_postgres_local).

import { test, expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, execSync } from 'child_process';
import { openFilterPanel, clearAllFilters, setSSIDFilter } from './helpers/filters';

interface RequestFailure {
  url: string;
  path: string;
  errorText: string;
  time: number;
}

interface SuccessResponse {
  path: string;
  status: number;
  time: number;
}

interface Diagnostics {
  consoleErrors: string[];
  pageErrors: Error[];
  requestFailures: RequestFailure[];
  successResponses: SuccessResponse[];
}

function attachDiagnostics(page: Page): Diagnostics {
  const d: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    successResponses: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      d.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    d.pageErrors.push(err);
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure();
    let pathname = 'unknown';
    try {
      pathname = new URL(req.url()).pathname;
    } catch {
      // ignore
    }
    d.requestFailures.push({
      url: req.url(),
      path: pathname,
      errorText: failure ? failure.errorText : 'unknown',
      time: Date.now(),
    });
  });

  page.on('response', (res) => {
    let pathname = 'unknown';
    try {
      pathname = new URL(res.url()).pathname;
    } catch {
      // ignore
    }
    if (pathname.includes('/api/')) {
      d.successResponses.push({
        path: pathname,
        status: res.status(),
        time: Date.now(),
      });
    }
  });

  return d;
}

function assertDiagnostics(d: Diagnostics): void {
  expect(d.pageErrors).toHaveLength(0);
  expect(d.consoleErrors).toHaveLength(0);

  const tolerated: { path: string; error: string; reason: string }[] = [];
  const failed: { path: string; error: string }[] = [];

  for (const failure of d.requestFailures) {
    // Only tolerate net::ERR_ABORTED for /api/v2/networks/filtered if a later 200 response exists
    if (failure.errorText === 'net::ERR_ABORTED' && failure.path === '/api/v2/networks/filtered') {
      const hasLater200 = d.successResponses.some(
        (r) => r.path === '/api/v2/networks/filtered' && r.status === 200 && r.time >= failure.time
      );
      if (hasLater200) {
        tolerated.push({
          path: failure.path,
          error: failure.errorText,
          reason: 'Expected React/debounce abort superseded by subsequent HTTP 200',
        });
        continue;
      }
    }

    // Tolerate net::ERR_ABORTED for in-flight Mapbox vector tile requests cancelled on rapid viewport pan/zoom
    if (
      failure.errorText === 'net::ERR_ABORTED' &&
      (failure.path.includes('.vector.pbf') || failure.path.includes('/v4/mapbox.'))
    ) {
      tolerated.push({
        path: failure.path,
        error: failure.errorText,
        reason: 'Mapbox in-flight vector tile abort due to viewport pan/zoom change',
      });
      continue;
    }

    failed.push({ path: failure.path, error: failure.errorText });
  }

  console.log('[DIAGNOSTICS_TABLE] Tolerated vs Failed Requests:');
  console.log('| Status | Path | Error | Reason |');
  console.log('| :--- | :--- | :--- | :--- |');
  for (const t of tolerated) {
    console.log(`| TOLERATED | ${t.path} | ${t.error} | ${t.reason} |`);
  }
  for (const f of failed) {
    console.log(`| FAILED | ${f.path} | ${f.error} | Unexpected request failure |`);
  }

  expect(failed).toHaveLength(0);
}

let dockerPostgresAvailable: boolean | null = null;
function checkDockerPostgresAvailable(): boolean {
  if (dockerPostgresAvailable !== null) {
    return dockerPostgresAvailable;
  }
  try {
    execFileSync(
      'docker',
      [
        'exec',
        '-e',
        'PGOPTIONS=-c statement_timeout=5000',
        'shadowcheck_postgres_local',
        'psql',
        '-U',
        'shadowcheck_admin',
        '-d',
        'shadowcheck_db',
        '-t',
        '-A',
        '-c',
        'SELECT 1;',
      ],
      { stdio: 'pipe', timeout: 10000 }
    );
    dockerPostgresAvailable = true;
  } catch {
    dockerPostgresAvailable = false;
  }
  return dockerPostgresAvailable;
}

test.describe('Authenticated E2E Verification Suite', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    test.skip(
      !checkDockerPostgresAvailable(),
      'Local docker container shadowcheck_postgres_local is unavailable — skipping local-only authenticated verification suite'
    );
  });

  test('1. Admin authentication & identity verification', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/admin');
    await expect(page).toHaveTitle(/ShadowCheck/i);

    // 1. Verify login form is NOT shown
    const loginForm = page.locator('input[type="password"]');
    await expect(loginForm).toHaveCount(0);

    // 2. Query /api/auth/me directly from the authenticated browser context to prove admin identity
    const authData = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return {
        status: res.status,
        body: await res.json(),
      };
    });

    console.log('[AUTH_VERIFICATION_STATUS]', authData.status);
    console.log('[AUTH_VERIFICATION_ROLE]', authData.body?.user?.role);
    console.log('[AUTH_VERIFICATION_USER]', authData.body?.user?.username);

    expect(authData.status).toBe(200);
    expect(authData.body.authenticated).toBe(true);
    expect(authData.body.user?.role).toBe('admin');
    expect(authData.body.user?.username).toBe('admin');

    // 3. Verify Admin UI navigation tabs are mounted and visible
    const configTab = page.getByRole('button', { name: /configuration/i });
    const exportTab = page.getByRole('button', { name: /data export/i });
    const apiTab = page.getByRole('button', { name: /api testing/i });

    await expect(configTab).toBeVisible({ timeout: 10000 });
    await expect(exportTab).toBeVisible();
    await expect(apiTab).toBeVisible();

    assertDiagnostics(diag);
    console.log('[AUTH_VERIFICATION] Admin authentication & role verified successfully on /admin');
  });

  test('2. Admin GeoJSON full streaming export & per-feature parsed proof', async ({
    page,
  }, testInfo: TestInfo) => {
    test.setTimeout(180000); // 3 minutes timeout for 270+ MB streaming
    const diag = attachDiagnostics(page);

    // 1. Set up CDP Fetch domain to intercept the real download response headers without buffering body
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: '*geojson/full*', requestStage: 'Response' }],
    });

    let realResponseStatus: number | null = null;
    let realResponseHeaders: { name: string; value: string }[] = [];
    let realRequestCount = 0;

    cdp.on('Fetch.requestPaused', async (params) => {
      if (params.request.url.includes('/api/geojson/full')) {
        realRequestCount++;
        realResponseStatus = params.responseStatusCode || null;
        realResponseHeaders = params.responseHeaders || [];
      }
      await cdp.send('Fetch.continueRequest', { requestId: params.requestId });
    });

    await page.goto('/admin');
    await expect(page).toHaveTitle(/ShadowCheck/i);

    // Switch to Data Export tab
    const exportTabBtn = page.getByRole('button', { name: /data export/i });
    await expect(exportTabBtn).toBeVisible({ timeout: 10000 });
    await exportTabBtn.click();

    // Locate full GeoJSON export control
    const exportGeoJsonBtn = page.getByRole('button', {
      name: /export all observations \(geojson\)/i,
    });
    await expect(exportGeoJsonBtn).toBeVisible({ timeout: 10000 });

    const startTime = Date.now();
    const downloadPromise = page.waitForEvent('download', { timeout: 180000 });

    // Trigger export in UI
    await exportGeoJsonBtn.click();

    const download = await downloadPromise;
    const downloadDurationMs = Date.now() - startTime;
    const suggestedFilename = download.suggestedFilename();
    const downloadUrl = download.url();

    console.log('[EXPORT_SUGGESTED_FILENAME]', suggestedFilename);
    console.log('[EXPORT_DOWNLOAD_URL]', downloadUrl);
    console.log(`[EXPORT_DOWNLOAD_INITIATED] in ${downloadDurationMs}ms`);

    // Verify filename pattern
    expect(suggestedFilename).toMatch(/^shadowcheck_observations_all_\d+\.geojson$/);
    expect(downloadUrl).toContain('/api/geojson/full');

    // Assert exactly one /api/geojson/full request was made
    expect(realRequestCount).toBe(1);
    expect(realResponseStatus).toBe(200);

    const getHeader = (name: string) =>
      realResponseHeaders.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const contentType = getHeader('content-type');
    const contentDisposition = getHeader('content-disposition');

    console.log('[EXPORT_HTTP_STATUS]', realResponseStatus);
    console.log('[EXPORT_CONTENT_TYPE]', contentType);
    console.log('[EXPORT_CONTENT_DISPOSITION]', contentDisposition);

    expect(contentType).toMatch(/application\/geo\+json/);
    expect(contentDisposition).toMatch(
      /attachment;\s*filename="shadowcheck_observations_all_\d+\.geojson"/
    );

    // Content-Disposition filename must match download.suggestedFilename()
    const cdMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    expect(cdMatch).not.toBeNull();
    expect(cdMatch?.[1]).toBe(suggestedFilename);

    // Save download to testInfo.outputPath, chmod 600, delete in finally
    const exportPath = testInfo.outputPath('shadowcheck_observations_all_test.geojson');
    try {
      await download.saveAs(exportPath);
      fs.chmodSync(exportPath, 0o600);
      const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[EXPORT_DOWNLOAD_SAVED] Saved to ${exportPath} in ${totalDurationSec}s`);

      const fileStat = fs.statSync(exportPath);
      const fileSizeMB = (fileStat.size / (1024 * 1024)).toFixed(2);
      console.log(`[EXPORT_FILE_SIZE] ${fileStat.size} bytes (${fileSizeMB} MB)`);
      expect(fileStat.size).toBeGreaterThan(200 * 1024 * 1024);

      // Root structure constant-memory validation using fs.openSync + fs.readSync
      const fd = fs.openSync(exportPath, 'r');
      try {
        const expectedPrefix = '{"type":"FeatureCollection","features":[';
        const prefixBuf = Buffer.alloc(expectedPrefix.length);
        fs.readSync(fd, prefixBuf, 0, expectedPrefix.length, 0);
        const prefixStr = prefixBuf.toString('utf8');
        expect(prefixStr).toBe(expectedPrefix);
        console.log('[ROOT_STRUCTURE_PREFIX_BYTES]', prefixStr);

        const tailReadSize = Math.min(256, fileStat.size);
        const tailBuf = Buffer.alloc(tailReadSize);
        fs.readSync(fd, tailBuf, 0, tailReadSize, fileStat.size - tailReadSize);
        const tailStr = tailBuf.toString('utf8');
        const trimmedTail = tailStr.trimEnd();
        expect(trimmedTail.endsWith(']}')).toBe(true);

        const suffixAfterClose = tailStr.slice(tailStr.lastIndexOf(']}') + 2);
        expect(/^\s*$/.test(suffixAfterClose)).toBe(true);
        console.log('[ROOT_STRUCTURE_SUFFIX_BYTES]', JSON.stringify(tailStr.slice(-10)));
      } finally {
        fs.closeSync(fd);
      }

      // Query database for authoritative expected totals and bounding box (read-only query)
      const sqlOut = execSync(
        'docker exec -e PGOPTIONS="-c statement_timeout=10000" shadowcheck_postgres_local psql -U shadowcheck_admin -d shadowcheck_db -t -A -F"," -c "SELECT count(*), min(lon), max(lon), min(lat), max(lat) FROM app.observations;"',
        { encoding: 'utf8' }
      ).trim();
      const [sqlTotalStr, sqlMinLonStr, sqlMaxLonStr, sqlMinLatStr, sqlMaxLatStr] =
        sqlOut.split(',');
      const expectedTotal = Number(sqlTotalStr);
      const expectedMinLon = Number(sqlMinLonStr);
      const expectedMaxLon = Number(sqlMaxLonStr);
      const expectedMinLat = Number(sqlMinLatStr);
      const expectedMaxLat = Number(sqlMaxLatStr);

      console.log('[SQL_AUTHORITATIVE_AGGREGATE]', {
        expectedTotal,
        expectedMinLon,
        expectedMaxLon,
        expectedMinLat,
        expectedMaxLat,
      });

      // Constant-memory streaming tokenizer: parses every single feature with JSON.parse
      const parseStartTime = Date.now();
      let totalParsed = 0;
      let nullGeomCount = 0;
      let nonPointCount = 0;
      let coordRangeViolations = 0;
      let minLon = Infinity;
      let maxLon = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;

      let inString = false;
      let escape = false;
      let depth = 0;
      let inFeaturesArray = false;
      let featureChunks: string[] = [];

      // Sample stride to collect >= 20 features for database coordinate verification
      const sampleStride = Math.floor(expectedTotal / 30);
      const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
      const ISO_TIME_REGEX =
        /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/;
      const sampledFeatures: {
        bssid: string;
        observed_at: string;
        lon: number;
        lat: number;
      }[] = [];

      const stream = fs.createReadStream(exportPath, {
        highWaterMark: 1024 * 1024,
        encoding: 'utf8',
      });

      for await (const chunk of stream) {
        let segStart = 0;
        for (let i = 0; i < chunk.length; i++) {
          const c = chunk[i];
          if (inString) {
            if (escape) {
              escape = false;
            } else if (c === '\\') {
              escape = true;
            } else if (c === '"') {
              inString = false;
            }
          } else {
            if (c === '"') {
              inString = true;
            } else if (c === '[') {
              if (!inFeaturesArray && depth === 1) {
                inFeaturesArray = true;
              }
            } else if (c === '{') {
              depth++;
              if (depth === 2 && inFeaturesArray) {
                segStart = i;
              }
            } else if (c === '}') {
              depth--;
              if (depth === 1 && inFeaturesArray) {
                featureChunks.push(chunk.slice(segStart, i + 1));
                const featureStr = featureChunks.join('');
                featureChunks = [];
                segStart = i + 1;

                totalParsed++;
                // Per-feature JSON.parse validation
                const f = JSON.parse(featureStr);
                if (!f.geometry) {
                  nullGeomCount++;
                } else {
                  if (f.geometry.type !== 'Point') {
                    nonPointCount++;
                  }
                  const [lon, lat] = f.geometry.coordinates;
                  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
                    coordRangeViolations++;
                  }
                  if (lon < minLon) {
                    minLon = lon;
                  }
                  if (lon > maxLon) {
                    maxLon = lon;
                  }
                  if (lat < minLat) {
                    minLat = lat;
                  }
                  if (lat > maxLat) {
                    maxLat = lat;
                  }

                  if (
                    totalParsed % sampleStride === 0 &&
                    sampledFeatures.length < 25 &&
                    f.properties?.bssid &&
                    MAC_REGEX.test(f.properties.bssid) &&
                    f.properties?.observed_at
                  ) {
                    sampledFeatures.push({
                      bssid: f.properties.bssid,
                      observed_at: f.properties.observed_at,
                      lon,
                      lat,
                    });
                  }
                }
              }
            }
          }
        }
        if (depth >= 2 && inFeaturesArray) {
          featureChunks.push(chunk.slice(segStart));
        }
      }

      const parseDurationMs = Date.now() - parseStartTime;
      console.log(`[GEOJSON_PARSE_CPU_TIME] ${parseDurationMs}ms for ${totalParsed} features`);
      console.log('[PARSED_TOTAL_FEATURES]', totalParsed);
      console.log('[PARSED_NULL_GEOMETRIES]', nullGeomCount);
      console.log('[PARSED_NON_POINT]', nonPointCount);
      console.log('[PARSED_COORD_VIOLATIONS]', coordRangeViolations);
      console.log('[PARSED_BOUNDS_LON]', minLon, maxLon);
      console.log('[PARSED_BOUNDS_LAT]', minLat, maxLat);

      // Assert structural and bounding box matches against the database
      expect(totalParsed).toBe(expectedTotal);
      expect(nullGeomCount).toBe(0);
      expect(nonPointCount).toBe(0);
      expect(coordRangeViolations).toBe(0);
      expect(depth).toBe(0); // Root object closed

      expect(minLon).toBe(expectedMinLon);
      expect(maxLon).toBe(expectedMaxLon);
      expect(minLat).toBe(expectedMinLat);
      expect(maxLat).toBe(expectedMaxLat);

      // Coordinate ordering verification across >=20 sampled records against app.observations
      expect(sampledFeatures.length).toBeGreaterThanOrEqual(20);
      console.log(`[SAMPLED_RECORDS_COUNT] Verifying ${sampledFeatures.length} stride samples...`);

      for (const sample of sampledFeatures) {
        expect(sample.bssid).toMatch(MAC_REGEX);
        expect(sample.observed_at).toMatch(ISO_TIME_REGEX);

        const rowOut = execFileSync(
          'docker',
          [
            'exec',
            '-i',
            '-e',
            'PGOPTIONS=-c statement_timeout=10000',
            'shadowcheck_postgres_local',
            'psql',
            '-U',
            'shadowcheck_admin',
            '-d',
            'shadowcheck_db',
            '-v',
            `target_bssid=${sample.bssid}`,
            '-v',
            `target_time=${sample.observed_at}`,
            '-t',
            '-A',
            '-F,',
            '-v',
            'ON_ERROR_STOP=1',
          ],
          {
            input:
              "SELECT bssid, time, lon, lat FROM app.observations WHERE bssid = :'target_bssid' AND time = :'target_time'::timestamptz LIMIT 1;",
            encoding: 'utf8',
          }
        ).trim();

        expect(rowOut).not.toBe('');
        const [, , dbLonStr, dbLatStr] = rowOut.split(',');
        const dbLon = Number(dbLonStr);
        const dbLat = Number(dbLatStr);

        // Verify coords[0] matches longitude and coords[1] matches latitude
        expect(Math.abs(sample.lon - dbLon)).toBeLessThan(0.0001);
        expect(Math.abs(sample.lat - dbLat)).toBeLessThan(0.0001);

        // Verify swapped interpretation is rejected
        expect(Math.abs(sample.lon - dbLat)).toBeGreaterThan(1.0);
        expect(Math.abs(sample.lat - dbLon)).toBeGreaterThan(1.0);
      }

      console.log(
        `[COORDINATE_ORDERING_VERIFIED] Confirmed for ${sampledFeatures.length} sampled observation records against app.observations.`
      );
    } finally {
      if (fs.existsSync(exportPath)) {
        fs.unlinkSync(exportPath);
      }
    }

    assertDiagnostics(diag);
  });

  test('3. Geospatial Explorer initial load', async ({ page }) => {
    const diag = attachDiagnostics(page);
    const startTime = Date.now();
    const observedEndpoints: { url: string; status: number }[] = [];
    const mapboxTileResponses: { url: string; status: number }[] = [];

    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('/api/') || u.includes('/v2/')) {
        observedEndpoints.push({ url: u, status: res.status() });
      }
      if (u.includes('mapbox.com')) {
        mapboxTileResponses.push({ url: u, status: res.status() });
      }
    });

    const networkDataPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/networks/filtered') &&
        !res.url().includes('/matched-media') &&
        !res.url().includes('/unmatched-media') &&
        res.status() === 200,
      { timeout: 30000 }
    );

    await page.goto('/geospatial-explorer');
    await expect(page).toHaveTitle(/ShadowCheck/i);

    // Wait for Mapbox canvas
    const canvas = page.locator('.mapboxgl-canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });

    // Wait for networks data response
    const networkRes = await networkDataPromise;
    expect(networkRes.status()).toBe(200);

    // Wait for at least one rendered row in the table view
    const row = page.locator('[role="row"]').first();
    await expect(row).toBeVisible({ timeout: 15000 });

    const durationMs = Date.now() - startTime;
    console.log(`[GEOSPATIAL_INITIAL_LOAD] Completed in ${durationMs}ms`);

    // Log mapbox-token status and tile/style load evidence
    const mapboxTokenStatus =
      observedEndpoints.find((e) => e.url.includes('/api/mapbox-token'))?.status || 'NOT_CALLED';
    console.log('[MAPBOX_TOKEN_STATUS]', mapboxTokenStatus);
    console.log(`[MAPBOX_INITIAL_RESPONSES_COUNT] ${mapboxTileResponses.length} requests observed`);
    if (mapboxTileResponses.length > 0) {
      console.log(
        '[MAPBOX_FIRST_RESPONSE_STATUS]',
        mapboxTileResponses[0].status,
        mapboxTileResponses[0].url.split('?')[0]
      );
    }

    const canvasBox = await canvas.boundingBox();
    console.log('[MAPBOX_CANVAS_DIMENSIONS]', canvasBox?.width, 'x', canvasBox?.height);
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(0);
    expect(canvasBox!.height).toBeGreaterThan(0);

    expect(durationMs).toBeLessThan(30000);
    assertDiagnostics(diag);
  });

  test('4. Geospatial Explorer map interaction responsiveness', async ({
    page,
  }, testInfo: TestInfo) => {
    const diag = attachDiagnostics(page);

    const networkDataPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/networks/filtered') &&
        !res.url().includes('/matched-media') &&
        !res.url().includes('/unmatched-media') &&
        res.status() === 200,
      { timeout: 30000 }
    );

    await page.goto('/geospatial-explorer');
    const canvas = page.locator('.mapboxgl-canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });
    await networkDataPromise;
    await expect(page.locator('[role="row"]').first()).toBeVisible({ timeout: 20000 });

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    const cx = canvasBox!.x + canvasBox!.width / 2;
    const cy = canvasBox!.y + canvasBox!.height / 2;

    // Helper to test gestures and record /api requests across 3 repetitions
    const filteredRequestsFired: string[] = [];
    const batchRequestsFired: string[] = [];
    const gestureApiRequestCounts: Record<string, Record<string, number>> = {};
    let totalAllGesturesApiRequests = 0;

    async function evaluateGesture(
      gestureName: string,
      action: () => Promise<void>
    ): Promise<void> {
      console.log(`[GESTURE_EVALUATION] Starting 3 repetitions for ${gestureName}`);
      let gestureTotalApiRequests = 0;
      const gesturePathCounts: Record<string, number> = {};

      for (let rep = 1; rep <= 3; rep++) {
        const repApiRequests: string[] = [];
        const listener = (req: any) => {
          const u = req.url();
          if (u.includes('/api/v2/networks/filtered')) {
            filteredRequestsFired.push(u);
            repApiRequests.push('/v2/networks/filtered');
          } else if (u.includes('/api/v2/networks/batch')) {
            batchRequestsFired.push(u);
            repApiRequests.push('/v2/networks/batch');
          } else if (u.includes('/api/')) {
            repApiRequests.push(new URL(u).pathname);
          }
          if (u.includes('/api/')) {
            const p = new URL(u).pathname;
            gesturePathCounts[p] = (gesturePathCounts[p] || 0) + 1;
            gestureTotalApiRequests++;
            totalAllGesturesApiRequests++;
          }
        };
        page.on('request', listener);
        await action();
        // Quiescence window for a NEGATIVE assertion, not a success condition (>= 700ms debounce interval + 300ms margin)
        await page.waitForTimeout(1000);
        page.off('request', listener);
        console.log(
          `[GESTURE_REP] ${gestureName} rep ${rep}: apiRequests=[${repApiRequests.join(', ')}]`
        );
      }
      gestureApiRequestCounts[gestureName] = gesturePathCounts;
      console.log(
        `[GESTURE_TOTAL_API_REQUESTS] ${gestureName}: total /api requests = ${gestureTotalApiRequests}`
      );
    }

    // 1. Pan-only gesture (drag 150, 100)
    await evaluateGesture('Pan-only (drag 150, 100)', async () => {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 150, cy + 100, { steps: 5 });
      await page.mouse.up();
    });

    // 2. Zoom-only gesture (-1000 wheel)
    const scaleBefore = (await page.textContent('.mapboxgl-ctrl-scale')) || '';
    console.log('[MAP_VIEWPORT_SCALE_BEFORE_ZOOM]', scaleBefore);

    await evaluateGesture('Zoom-only (-1000 wheel)', async () => {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, -1000);
    });

    // Wait for zoom scale change observable
    await page.waitForFunction(
      (prev) => document.querySelector('.mapboxgl-ctrl-scale')?.textContent !== prev,
      scaleBefore,
      { timeout: 10000 }
    );
    const scaleAfter = (await page.textContent('.mapboxgl-ctrl-scale')) || '';
    console.log('[MAP_VIEWPORT_SCALE_AFTER_ZOOM]', scaleAfter);
    expect(scaleAfter).not.toBe(scaleBefore);

    // 3. Combined gesture (drag 150, 100 then -1000 wheel)
    await evaluateGesture('Combined (drag 150, 100 + wheel -1000)', async () => {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 150, cy + 100, { steps: 5 });
      await page.mouse.up();
      await page.mouse.wheel(0, -1000);
    });

    // 4. Large drag gesture (300, 200 then -1000 wheel)
    await evaluateGesture('Large drag (300, 200 + wheel -1000)', async () => {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 300, cy + 200, { steps: 10 });
      await page.mouse.up();
      await page.mouse.wheel(0, -1000);
    });

    // Regression Guard: NO /api/v2/networks/filtered requests must fire during any gesture
    expect(filteredRequestsFired).toHaveLength(0);

    // Informational logging for batch requests
    console.log(
      `[BATCH_REQUESTS_INFORMATIONAL] Fired ${batchRequestsFired.length} batch requests during all gestures`
    );
    console.log(`[ALL_GESTURES_TOTAL_API_REQUESTS] ${totalAllGesturesApiRequests}`);

    if (totalAllGesturesApiRequests === 0) {
      testInfo.annotations.push({
        type: 'gesture-data-refresh',
        description: 'no API traffic observed on gestures; pan/zoom data refresh NOT PROVEN',
      });
      console.log(
        '[GESTURE_DATA_REFRESH] no API traffic observed on gestures; pan/zoom data refresh NOT PROVEN'
      );
    } else {
      console.log(
        '[GESTURE_DATA_REFRESH] API traffic observed during gestures:',
        JSON.stringify(gestureApiRequestCounts)
      );
    }

    // Verify row count remains populated
    const rowCount = await page.locator('[role="row"]').count();
    console.log('[GEOSPATIAL_ROW_COUNT_AFTER_GESTURES]', rowCount);
    expect(rowCount).toBeGreaterThan(0);

    // Observable status reporting
    console.log(
      '[MAP_OBSERVABLES_ASSESSMENT] Zoom responsiveness proven via .mapboxgl-ctrl-scale change. Pan observable (hash / marker shift): pan: NOT PROVEN. Mapbox tile z/x/y requests observed when uncached.'
    );

    assertDiagnostics(diag);
  });

  test('5. Geospatial Explorer filter & clear-filter workflow', async ({
    page,
  }, testInfo: TestInfo) => {
    const diag = attachDiagnostics(page);

    await page.goto('/geospatial-explorer');
    await expect(page).toHaveTitle(/ShadowCheck/i);

    // Capture initial baseline request and response
    const initialNetworkRes = await page.waitForResponse(
      (r) =>
        r.url().includes('/v2/networks/filtered') &&
        !r.url().includes('/matched-media') &&
        !r.url().includes('/unmatched-media') &&
        r.status() === 200,
      { timeout: 20000 }
    );
    await expect(page.locator('[role="row"]').first()).toBeVisible({ timeout: 15000 });

    const initialBody = await initialNetworkRes.json();
    const baselineTotal = initialBody.pagination?.total;
    expect(baselineTotal).toBeGreaterThan(0);

    // Natural candidate discovery:
    // 1. Inspect already-fetched baseline rows for an SSID with non-empty sibling_bssids.
    // 2. Probe candidates via a lightweight authenticated API call to discover one with supplemented siblings.
    // 3. Fall back to a bounded read-only DB query if baseline rows yield no supplemented siblings.
    // 4. Fall back to a generic baseline SSID (exercising the preserved zero-sibling branch).
    let targetSsid = '';
    let isSiblingBearingCandidate = false;

    const baselineRows = initialBody.data || [];
    const siblingBearingCandidates = baselineRows.filter(
      (d: any) =>
        d.ssid &&
        d.ssid.trim().length > 2 &&
        Array.isArray(d.sibling_bssids) &&
        d.sibling_bssids.length > 0
    );

    let backupCandidate: { ssid: string; total: number; sibCount: number } | null = null;
    for (const cand of siblingBearingCandidates.slice(0, 10)) {
      const probe = await page.evaluate(async (ssid) => {
        try {
          const res = await fetch(
            `/api/v2/networks/filtered?filters=${encodeURIComponent(
              JSON.stringify({ ssid })
            )}&enabled=${encodeURIComponent(JSON.stringify({ ssid: true }))}&limit=50&offset=0&includeTotal=true`,
            { credentials: 'include' }
          );
          if (!res.ok) {
            return null;
          }
          const json = await res.json();
          const sibCount = (json.data || []).filter((r: any) => r._siblingSupplemented).length;
          return { total: json.pagination?.total, sibCount };
        } catch {
          return null;
        }
      }, cand.ssid);

      if (probe && probe.sibCount > 0) {
        if (typeof probe.total === 'number' && probe.total <= 50) {
          targetSsid = cand.ssid;
          isSiblingBearingCandidate = true;
          console.log(
            `[SIBLING_DISCOVERY] Baseline candidate selected: "${targetSsid}" (probed total=${probe.total}, supplemented=${probe.sibCount})`
          );
          break;
        } else if (!backupCandidate) {
          backupCandidate = { ssid: cand.ssid, total: probe.total, sibCount: probe.sibCount };
        }
      }
    }

    if (!targetSsid && checkDockerPostgresAvailable()) {
      try {
        const sqlCandidate = execFileSync(
          'docker',
          [
            'exec',
            '-i',
            '-e',
            'PGOPTIONS=-c statement_timeout=5000',
            'shadowcheck_postgres_local',
            'psql',
            '-U',
            'shadowcheck_admin',
            '-d',
            'shadowcheck_db',
            '-t',
            '-A',
            '-v',
            'ON_ERROR_STOP=1',
          ],
          {
            input: `SELECT n1.ssid
                    FROM app.network_sibling_overrides o
                    JOIN app.networks n1 ON UPPER(n1.bssid) = UPPER(o.bssid1)
                    JOIN app.networks n2 ON UPPER(n2.bssid) = UPPER(o.bssid2)
                    WHERE o.is_active IS TRUE AND o.relation = 'sibling'
                      AND n1.ssid IS NOT NULL AND LENGTH(TRIM(n1.ssid)) > 2
                      AND (n2.ssid IS NULL OR n2.ssid NOT ILIKE '%' || n1.ssid || '%')
                    LIMIT 1;`,
            encoding: 'utf8',
          }
        ).trim();
        if (sqlCandidate) {
          targetSsid = sqlCandidate;
          isSiblingBearingCandidate = true;
          console.log(`[SIBLING_DISCOVERY] DB lookup candidate selected: "${targetSsid}"`);
        }
      } catch {
        // Fallback to generic candidate below
      }
    }

    if (!targetSsid && backupCandidate) {
      targetSsid = backupCandidate.ssid;
      isSiblingBearingCandidate = true;
      console.log(
        `[SIBLING_DISCOVERY] Backup candidate selected: "${targetSsid}" (total=${backupCandidate.total}, supplemented=${backupCandidate.sibCount})`
      );
    }

    if (!targetSsid) {
      const genericCandidate = baselineRows.find((d: any) => d.ssid && d.ssid.trim().length > 2);
      targetSsid = genericCandidate?.ssid ? String(genericCandidate.ssid) : 'xfinity';
      isSiblingBearingCandidate = false;
      console.log(`[SIBLING_DISCOVERY] Generic fallback candidate selected: "${targetSsid}"`);
    }

    // Report threatTransparencyError count AND total rows in baseline response (denominator)
    const baselineRowsCount = baselineRows.length;
    const threatTransparencyErrorCount = baselineRows.filter(
      (d: any) => d.threatTransparencyError === true
    ).length;
    console.log('[BASELINE_TOTAL_NETWORKS]', baselineTotal);
    console.log('[SELECTED_FILTER_SSID]', targetSsid);
    console.log(
      `[THREAT_TRANSPARENCY_ERRORS_IN_BASELINE] ${threatTransparencyErrorCount} / ${baselineRowsCount} rows`
    );

    // Open filter panel
    await openFilterPanel(page);

    // Apply SSID filter and capture both the request payload and filtered response
    const [filteredReq, filteredRes] = await Promise.all([
      page.waitForRequest(
        (r) => {
          if (!r.url().includes('/v2/networks/filtered')) {
            return false;
          }
          try {
            const url = new URL(r.url());
            const enabled = JSON.parse(url.searchParams.get('enabled') || '{}');
            return enabled.ssid === true;
          } catch {
            return false;
          }
        },
        { timeout: 15000 }
      ),
      page.waitForResponse(
        (res) =>
          res.url().includes('/v2/networks/filtered') &&
          !res.url().includes('/matched-media') &&
          !res.url().includes('/unmatched-media') &&
          res.status() === 200,
        { timeout: 15000 }
      ),
      setSSIDFilter(page, targetSsid),
    ]);

    const url = new URL(filteredReq.url());
    const filters = JSON.parse(url.searchParams.get('filters') || '{}');
    const enabled = JSON.parse(url.searchParams.get('enabled') || '{}');
    expect(enabled.ssid).toBe(true);
    expect(filters.ssid).toBe(targetSsid);

    const filteredBody = await filteredRes.json();
    const filteredTotal = filteredBody.pagination?.total;
    const responseDataLength = (filteredBody.data || []).length;
    console.log('[FILTERED_TOTAL_NETWORKS]', filteredTotal);
    console.log('[FILTERED_RESPONSE_DATA_LENGTH]', responseDataLength);
    expect(filteredTotal).toBeGreaterThan(0);
    expect(filteredTotal).toBeLessThanOrEqual(baselineTotal);

    // Direct matching rows without _siblingSupplemented
    const nonSiblingRows = (filteredBody.data || []).filter((r: any) => !r._siblingSupplemented);
    const siblingRows = (filteredBody.data || []).filter((r: any) => r._siblingSupplemented);

    console.log('[DIRECT_MATCHING_ROWS_COUNT]', nonSiblingRows.length);
    console.log('[FILTER_SIBLING_SUPPLEMENTED_COUNT]', siblingRows.length);
    console.log(
      `[SIBLING_ACCOUNTING] candidate="${targetSsid}" siblingRows=${siblingRows.length} directRows=${nonSiblingRows.length} total=${filteredTotal} dataLength=${responseDataLength}`
    );

    // Assert (a): rows without _siblingSupplemented count === filteredTotal when filteredTotal <= pageSize
    if (filteredTotal <= 50) {
      expect(nonSiblingRows.length).toBe(filteredTotal);
    }
    for (const row of nonSiblingRows) {
      expect(String(row.ssid || '').toLowerCase()).toContain(targetSsid.toLowerCase());
    }

    // Collect BSSID set of supplemented siblings
    const supplementedBssids = siblingRows.map((r: any) => String(r.bssid || '').toLowerCase());
    console.log('[SUPPLEMENTED_SIBLING_BSSIDS]', supplementedBssids);

    // Assert (b): Sibling accounting verification
    if (siblingRows.length === 0) {
      if (isSiblingBearingCandidate) {
        throw new Error(
          `Expected supplemented sibling rows for candidate "${targetSsid}", but received 0.`
        );
      }
      testInfo.annotations.push({
        type: 'sibling-accounting',
        description:
          'sibling accounting: NOT EXERCISED — no natural sibling-bearing candidate available',
      });
      console.log(
        '[SIBLING_ACCOUNTING] NOT EXERCISED — no natural sibling-bearing candidate available'
      );
    } else {
      expect(supplementedBssids.length).toBeGreaterThanOrEqual(1);

      const matchedSiblingBssids = new Set<string>();
      for (const row of nonSiblingRows) {
        if (Array.isArray(row.sibling_bssids)) {
          for (const b of row.sibling_bssids) {
            matchedSiblingBssids.add(b.toLowerCase());
          }
        }
      }
      for (const sib of siblingRows) {
        expect(sib._siblingSupplemented).toBe(true);
        expect(matchedSiblingBssids.has(sib.bssid.toLowerCase())).toBe(true);
      }
      testInfo.annotations.push({
        type: 'sibling-accounting',
        description: `sibling accounting: PASS (${siblingRows.length} supplemented rows verified)`,
      });
      console.log(
        `[SIBLING_ACCOUNTING] PASS — ${siblingRows.length} supplemented sibling rows verified against matched sibling_bssids`
      );
    }

    // Assert (c): assert rendered DOM rows show the SSID in the scoped SSID cell group
    const ssidGroupLocator = page.locator('[role="row"] .ssid-cell-group');
    const groupCount = await ssidGroupLocator.count();
    console.log('[DOM_SSID_GROUP_LOCATOR]', '[role="row"] .ssid-cell-group');
    console.log('[DOM_SSID_GROUP_COUNT]', groupCount);

    if (groupCount > 0) {
      const firstGroupStats = await ssidGroupLocator.first().evaluate((el) => ({
        tagName: el.tagName.toLowerCase(),
        styleCount: el.querySelectorAll('style').length,
        textContentLength: (el.textContent || '').length,
        innerTextLength: ((el as HTMLElement).innerText || '').length,
      }));
      console.log(
        `[DOM_FIRST_GROUP_STATS] tagName=${firstGroupStats.tagName} styleTags=${firstGroupStats.styleCount} textContentLen=${firstGroupStats.textContentLength} innerTextLen=${firstGroupStats.innerTextLength}`
      );
    }

    const texts = await ssidGroupLocator.allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    const anyMatches = texts.some((t) => t.toLowerCase().includes(targetSsid.toLowerCase()));
    expect(anyMatches).toBe(true);

    if (siblingRows.length === 0) {
      for (const t of texts) {
        expect(t.toLowerCase()).toContain(targetSsid.toLowerCase());
      }
    }
    console.log(`[FILTER_MATCH_VERIFIED] Filtered rows and rendered DOM match SSID ${targetSsid}`);

    // Clear filter and verify baseline restoration
    const [resetReq, resetRes] = await Promise.all([
      page.waitForRequest(
        (r) => {
          if (!r.url().includes('/v2/networks/filtered')) {
            return false;
          }
          try {
            const u = new URL(r.url());
            const en = JSON.parse(u.searchParams.get('enabled') || '{}');
            return !en.ssid;
          } catch {
            return false;
          }
        },
        { timeout: 15000 }
      ),
      page.waitForResponse(
        (res) =>
          res.url().includes('/v2/networks/filtered') &&
          !res.url().includes('/matched-media') &&
          !res.url().includes('/unmatched-media') &&
          res.status() === 200,
        { timeout: 15000 }
      ),
      clearAllFilters(page),
    ]);

    const resetUrl = new URL(resetReq.url());
    const resetEnabled = JSON.parse(resetUrl.searchParams.get('enabled') || '{}');
    expect(resetEnabled.ssid).toBeFalsy();
    const activeKeys = Object.entries(resetEnabled).filter(([, v]) => v === true);
    expect(activeKeys).toHaveLength(0);

    const resetBody = await resetRes.json();
    const restoredTotal = resetBody.pagination?.total;
    console.log('[RESTORED_TOTAL_NETWORKS]', restoredTotal);
    expect(restoredTotal).toBe(baselineTotal);

    assertDiagnostics(diag);
  });

  test('6. Surveillance dry-run API contract', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // Direct read-only write-audit snapshot before dry-run execution
    const getSurveillanceSnapshot = (): string => {
      return execFileSync(
        'docker',
        [
          'exec',
          '-i',
          '-e',
          'PGOPTIONS=-c statement_timeout=10000',
          'shadowcheck_postgres_local',
          'psql',
          '-U',
          'shadowcheck_admin',
          '-d',
          'shadowcheck_db',
          '-t',
          '-A',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        {
          input:
            "SELECT count(*)::text||','||coalesce(max(detected_at)::text,'null')||','||coalesce(max(updated_at)::text,'null')||','||md5(coalesce(string_agg(t::text,'|' ORDER BY t.id),'')) FROM app.surveillance_detections t;",
          encoding: 'utf8',
        }
      ).trim();
    };

    const getSurveillanceStats = (): string => {
      return execFileSync(
        'docker',
        [
          'exec',
          '-i',
          '-e',
          'PGOPTIONS=-c statement_timeout=10000',
          'shadowcheck_postgres_local',
          'psql',
          '-U',
          'shadowcheck_admin',
          '-d',
          'shadowcheck_db',
          '-t',
          '-A',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        {
          input:
            "SELECT 'ins='||n_tup_ins||' upd='||n_tup_upd||' del='||n_tup_del FROM pg_stat_user_tables WHERE schemaname='app' AND relname='surveillance_detections';",
          encoding: 'utf8',
        }
      ).trim();
    };

    const snapshotBefore = getSurveillanceSnapshot();
    const statsBefore = getSurveillanceStats();
    console.log('[SURVEILLANCE_WRITE_AUDIT_BEFORE]', snapshotBefore);
    console.log('[SURVEILLANCE_STAT_TUPLES_BEFORE]', statsBefore);

    await page.goto('/admin');
    await expect(page).toHaveTitle(/ShadowCheck/i);

    // Define sampleLimit once for both request and response assertions
    const sampleLimit = 100;

    // Record duration for 3 consecutive calls (min/median/max)
    const durations: number[] = [];
    let lastResult: any = null;

    for (let run = 1; run <= 3; run++) {
      const callStart = Date.now();
      const res = await page.evaluate(async (limit: number) => {
        const resp = await fetch('/api/admin/surveillance-detections/dry-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sampleLimit: limit }),
          credentials: 'include',
        });
        return {
          status: resp.status,
          body: await resp.json(),
        };
      }, sampleLimit);
      const callDuration = Date.now() - callStart;
      durations.push(callDuration);
      lastResult = res;
    }

    durations.sort((a, b) => a - b);
    const minDur = durations[0];
    const medDur = durations[1];
    const maxDur = durations[2];

    console.log(
      `[SURVEILLANCE_TIMING_3_RUNS] min=${minDur}ms median=${medDur}ms max=${maxDur}ms. Informational only.`
    );
    console.log('[SURVEILLANCE_STATUS]', lastResult.status);
    console.log('[SURVEILLANCE_CANDIDATE_COUNT]', lastResult.body?.candidateCount);
    console.log('[SURVEILLANCE_EXISTING_DETECTIONS]', lastResult.body?.existingDetectionCount);
    console.log('[SURVEILLANCE_SAMPLES_COUNT]', lastResult.body?.samples?.length);

    // Direct read-only write-audit snapshot after dry-run execution
    const snapshotAfter = getSurveillanceSnapshot();
    const statsAfter = getSurveillanceStats();
    console.log('[SURVEILLANCE_WRITE_AUDIT_AFTER]', snapshotAfter);
    console.log('[SURVEILLANCE_STAT_TUPLES_AFTER]', statsAfter);
    expect(snapshotAfter).toBe(snapshotBefore);

    expect(lastResult.status).toBe(200);
    expect(lastResult.body.dryRun).toBe(true);
    expect(Number.isInteger(lastResult.body.candidateCount)).toBe(true);
    expect(lastResult.body.candidateCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(lastResult.body.samples)).toBe(true);

    const expectedSampleCount = Math.min(sampleLimit, lastResult.body.candidateCount);
    expect(lastResult.body.samples.length).toBe(expectedSampleCount);

    const firstSample = lastResult.body.samples[0];
    expect(firstSample.bssid).toBeDefined();
    expect(firstSample.device_type).toBeDefined();
    expect(firstSample.threat_score).toBeDefined();
    expect(firstSample.detection_method).toBeDefined();

    console.log(
      "[SURVEILLANCE_UI_STATUS] Surveillance UI workflow: NOT PROVEN — the only UI path to getEnrichedCandidates is JobsTab 'Run Scan Now' (writes); ApiTestingTab needs a separate in-tab login."
    );

    assertDiagnostics(diag);
  });

  test('7. Authorization behavior verification (unauthenticated rejection)', async ({
    browser,
  }) => {
    // Create a new, isolated browser context with NO storageState / cookies
    const unauthContext = await browser.newContext({ storageState: undefined });
    const unauthPage = await unauthContext.newPage();

    // 1. Visiting /admin unauthenticated redirects to login
    await unauthPage.goto('/admin');
    await expect(unauthPage.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
    console.log('[UNAUTH_ADMIN_REDIRECT] Unauthenticated /admin correctly displays login form');

    // 2. Direct API call to /api/admin/surveillance-detections/dry-run returns 401
    const survRes = await unauthPage.request.post('/api/admin/surveillance-detections/dry-run', {
      headers: { 'Content-Type': 'application/json' },
      data: { sampleLimit: 10 },
    });
    console.log('[UNAUTH_SURVEILLANCE_STATUS]', survRes.status());
    expect(survRes.status()).toBe(401);

    // 3. Direct API call to /api/geojson/full returns 401
    const exportRes = await unauthPage.request.get('/api/geojson/full');
    console.log('[UNAUTH_EXPORT_STATUS]', exportRes.status());
    expect(exportRes.status()).toBe(401);

    await unauthContext.close();
    console.log(
      '[AUTHORIZATION_REGRESSION] Unauthenticated access properly rejected with 401/redirect'
    );
  });

  test('8. Non-admin authorization verification (forbidden access)', async ({ browser }) => {
    const userStatePath = path.join(__dirname, '.auth', 'user.json');
    if (
      !process.env.E2E_USER_USER ||
      !process.env.E2E_USER_PASSWORD ||
      !fs.existsSync(userStatePath)
    ) {
      test.skip(
        true,
        'Optional non-admin user credentials (E2E_USER_USER / E2E_USER_PASSWORD) or tests/e2e/.auth/user.json not present — skipping non-admin verification'
      );
      return;
    }

    const userContext = await browser.newContext({ storageState: userStatePath });
    const userPage = await userContext.newPage();

    await userPage.goto('/admin');
    const exportBtn = userPage.getByRole('button', {
      name: /export all observations \(geojson\)/i,
    });
    await expect(exportBtn).toHaveCount(0);

    const exportRes = await userPage.request.get('/api/geojson/full');
    expect(exportRes.status()).toBe(403);
    const exportBody = await exportRes.body();
    expect(exportBody.length).toBe(0);

    const survRes = await userPage.request.post('/api/admin/surveillance-detections/dry-run', {
      headers: { 'Content-Type': 'application/json' },
      data: { sampleLimit: 10 },
    });
    expect(survRes.status()).toBe(403);
    const survJson = await survRes.json();
    expect(survJson.code).toBe('INSUFFICIENT_PERMISSIONS');

    await userContext.close();
    console.log('[NON_ADMIN_AUTHORIZATION] Non-admin access properly rejected with 403');
  });
});
