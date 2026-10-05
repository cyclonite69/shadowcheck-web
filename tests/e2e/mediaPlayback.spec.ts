import { test, expect } from '@playwright/test';

interface CapturedMediaRequest {
  url: string;
  method: string;
  rangeHeader?: string;
  status: number;
  contentType?: string;
  contentRange?: string;
  contentLength?: string;
  acceptRanges?: string;
}

test.describe('End-to-End MP4 Playback & Range Streaming Verification via Production UI', () => {
  test('navigates Geospatial Explorer, opens context menu & NetworkMediaPanel, plays and seeks MP4 in NetworkMediaViewer with 206 streaming', async ({
    page,
  }) => {
    const capturedRequests: CapturedMediaRequest[] = [];

    // Intercept and record all network traffic to network media endpoints
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/v2/networks/media/')) {
        const req = response.request();
        const headers = response.headers();
        capturedRequests.push({
          url,
          method: req.method(),
          rangeHeader: req.headers()['range'],
          status: response.status(),
          contentType: headers['content-type'],
          contentRange: headers['content-range'],
          contentLength: headers['content-length'],
          acceptRanges: headers['accept-ranges'],
        });
      }
    });

    // 1. Navigate to Geospatial Explorer
    await page.goto('/geospatial-explorer');
    await expect(page).toHaveTitle(/ShadowCheck/i);

    // Wait for the initial network data fetch
    await page.waitForResponse(
      (r) =>
        r.url().includes('/v2/networks/filtered') &&
        !r.url().includes('/matched-media') &&
        !r.url().includes('/unmatched-media') &&
        r.status() === 200,
      { timeout: 20000 }
    );

    // Wait for at least one row in the table
    await expect(page.locator('[role="row"]').first()).toBeVisible({ timeout: 15000 });

    // 2. Filter to the known video evidence network (BSSID C0:94:35:40:15:4E, SSID 'FBI Watching')
    const targetBssid = 'C0:94:35:40:15:4E';
    const quickSearchInput = page.getByPlaceholder(
      'SSID+Manufacturer by default. Prefix: b:, s:, m:'
    );
    await expect(quickSearchInput).toBeVisible({ timeout: 10000 });
    await quickSearchInput.fill(targetBssid);

    // Wait for filtered fetch response
    await page.waitForResponse(
      (r) => r.url().includes('/v2/networks/filtered') && r.status() === 200,
      { timeout: 15000 }
    );

    // 3. Locate the target network row in the table
    const rowLocator = page.locator(`[role="row"]:has-text("${targetBssid}")`).first();
    await expect(rowLocator).toBeVisible({ timeout: 10000 });

    // 4. Right-click the network row to open the production NetworkTagMenu context menu
    await rowLocator.click({ button: 'right' });

    // 5. Verify NetworkMediaPanel mounts inside NetworkTagMenu and loads the related media
    const mediaHeading = page.locator('text=Related Media');
    await expect(mediaHeading).toBeVisible({ timeout: 10000 });

    // Locate the video attachment tile (filename 20251012_010318.mp4 or MP4 badge)
    const videoItemTile = page.locator('text=20251012_010318.mp4').first();
    await expect(videoItemTile).toBeVisible({ timeout: 10000 });

    // 6. Click the media item to open the production modal with NetworkMediaViewer
    await videoItemTile.click();

    // 7. Verify the modal dialog and production <video> element rendered by NetworkMediaViewer
    const modalHeader = page.locator('span:has-text("20251012_010318.mp4")').first();
    await expect(modalHeader).toBeVisible({ timeout: 10000 });

    const openInNewTabLink = page.locator('a:has-text("Open in New Tab")').first();
    await expect(openInNewTabLink).toBeVisible();
    await expect(openInNewTabLink).toHaveAttribute('href', '/api/v2/networks/media/20/inline');

    const videoLocator = page.locator('video').first();
    await expect(videoLocator).toBeVisible({ timeout: 10000 });

    const sourceLocator = page.locator('video > source').first();
    await expect(sourceLocator).toHaveAttribute('src', '/api/v2/networks/media/20/inline');
    await expect(sourceLocator).toHaveAttribute('type', 'video/mp4');

    // 8. Verify video metadata loads via the browser engine
    interface VideoMetadata {
      duration: number;
      videoWidth: number;
      videoHeight: number;
      readyState: number;
    }

    const metadata = await page.evaluate<VideoMetadata>(async () => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (!video) {
        throw new Error('Video element not found in DOM');
      }

      if (video.readyState >= 1) {
        return {
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
        };
      }

      return new Promise<VideoMetadata>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timeout waiting for video metadata. readyState=${video.readyState}, error=${video.error?.message}`
            )
          );
        }, 15000);

        video.addEventListener(
          'loadedmetadata',
          () => {
            clearTimeout(timeout);
            resolve({
              duration: video.duration,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
            });
          },
          { once: true }
        );

        video.addEventListener(
          'error',
          () => {
            clearTimeout(timeout);
            reject(new Error(`Video load error: ${video.error?.code} ${video.error?.message}`));
          },
          { once: true }
        );

        video.load();
      });
    });

    console.log('[E2E REAL-UI VIDEO METADATA]', metadata);
    expect(metadata.duration).toBeGreaterThan(0);
    expect(metadata.readyState).toBeGreaterThanOrEqual(1);

    // 9. Start playback and verify playback progress advances
    await page.evaluate(async () => {
      const video = document.querySelector('video') as HTMLVideoElement;
      await video.play();
    });

    await page.waitForTimeout(1500);

    const currentTimeAfterPlay = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video.currentTime;
    });
    console.log('[E2E REAL-UI PLAY PROGRESS]', currentTimeAfterPlay);
    expect(currentTimeAfterPlay).toBeGreaterThan(0.5);

    // 10. Pause playback
    await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      video.pause();
    });

    // 11. Seek forward to 7.0 seconds and verify seeked event
    const seekTarget = 7.0;
    const seekResult = await page.evaluate((targetTime) => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return new Promise<{ seeked: boolean; newTime: number }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for video seeked event'));
        }, 10000);

        video.addEventListener(
          'seeked',
          () => {
            clearTimeout(timeout);
            resolve({ seeked: true, newTime: video.currentTime });
          },
          { once: true }
        );

        video.currentTime = targetTime;
      });
    }, seekTarget);

    console.log('[E2E REAL-UI SEEK RESULT]', seekResult);
    expect(seekResult.seeked).toBe(true);
    expect(seekResult.newTime).toBeCloseTo(seekTarget, 0.5);

    // 12. Confirm no video playback error occurred
    const videoError = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video.error ? { code: video.error.code, message: video.error.message } : null;
    });
    expect(videoError).toBeNull();

    // 13. Inspect captured HTTP requests and verify Range 206 responses
    const mediaInlineResponses = capturedRequests.filter((r) =>
      r.url.includes('/api/v2/networks/media/20/inline')
    );
    console.log(
      '[E2E REAL-UI MEDIA RESPONSES COUNT]',
      mediaInlineResponses.length,
      mediaInlineResponses.map((r) => ({
        status: r.status,
        range: r.rangeHeader,
        contentRange: r.contentRange,
        contentLength: r.contentLength,
        contentType: r.contentType,
        acceptRanges: r.acceptRanges,
      }))
    );

    expect(mediaInlineResponses.length).toBeGreaterThan(0);

    const rangeResponses = mediaInlineResponses.filter((r) => r.rangeHeader);
    expect(rangeResponses.length).toBeGreaterThan(0);

    for (const res of rangeResponses) {
      expect(res.status).toBe(206);
      expect(res.acceptRanges).toBe('bytes');
      expect(res.contentType).toContain('video/mp4');
      expect(res.contentRange).toMatch(/^bytes \d+-\d+\/63420062$/);
      expect(Number(res.contentLength)).toBeGreaterThan(0);
    }

    // 14. Close the video modal via the modal's close button
    const modalCloseBtn = page.locator('a:has-text("Open in New Tab") + button');
    await expect(modalCloseBtn).toBeVisible({ timeout: 5000 });
    await modalCloseBtn.click();
    await expect(videoLocator).not.toBeVisible();

    // Close the context menu if still present
    await page.keyboard.press('Escape');

    // 15. Verify image media retrieval via the real UI for BSSID 5C:B0:66:16:3A:BF (ID 14, 20260516_195018.jpg)
    const imageBssid = '5C:B0:66:16:3A:BF';
    await quickSearchInput.fill('');
    await quickSearchInput.fill(imageBssid);

    await page.waitForResponse(
      (r) => r.url().includes('/v2/networks/filtered') && r.status() === 200,
      { timeout: 15000 }
    );

    const imageRowLocator = page.locator(`[role="row"]:has-text("${imageBssid}")`).first();
    await expect(imageRowLocator).toBeVisible({ timeout: 10000 });

    await imageRowLocator.click({ button: 'right' });
    await expect(mediaHeading).toBeVisible({ timeout: 10000 });

    // Verify thumbnail is rendered in the panel list
    const thumbnailElement = page.locator('img[src="/api/v2/networks/media/14/thumbnail"]').first();
    await expect(thumbnailElement).toBeVisible({ timeout: 5000 });

    const imageItemTile = page.locator('text=20260516_195018.jpg').first();
    await expect(imageItemTile).toBeVisible({ timeout: 10000 });
    await imageItemTile.click();

    // Verify modal displays <img> rendered by NetworkMediaViewer with inline src
    const imageModalHeader = page.locator('span:has-text("20260516_195018.jpg")').first();
    await expect(imageModalHeader).toBeVisible({ timeout: 10000 });

    const modalImageElement = page.locator('img[src="/api/v2/networks/media/14/inline"]').first();
    await expect(modalImageElement).toBeVisible({ timeout: 10000 });

    // Confirm image loaded successfully in the browser
    const imageNaturalWidth = await modalImageElement.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth
    );
    expect(imageNaturalWidth).toBeGreaterThan(0);

    const imageInlineResponses = capturedRequests.filter((r) =>
      r.url.includes('/api/v2/networks/media/14/inline')
    );
    const lastImageResponse = imageInlineResponses[imageInlineResponses.length - 1];
    expect(lastImageResponse).toBeDefined();
    expect(lastImageResponse.status).toBe(200);
    expect(lastImageResponse.contentType).toContain('image/jpeg');

    // Close the image modal
    await modalCloseBtn.click();
    await expect(modalImageElement).not.toBeVisible();
  });
});
