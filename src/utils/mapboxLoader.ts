/**
 * Mapbox GL JS loader utility
 *
 * Safely waits for window.mapboxgl to be available after the deferred
 * script loads. Provides a consistent way for map components to initialize
 * without race conditions.
 */

declare global {
  interface Window {
    mapboxgl?: typeof import('mapbox-gl');
  }
}

const MAPBOX_LOAD_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 50;

export type MapboxLoadResult =
  | { ready: true; mapboxgl: typeof import('mapbox-gl') }
  | { ready: false; error: string };

/**
 * Wait for Mapbox GL JS to be loaded and available on window.mapboxgl.
 * Returns a promise that resolves with the mapboxgl object or rejects with an error.
 *
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 * @returns Promise resolving to MapboxLoadResult
 */
export function waitForMapbox(timeoutMs = MAPBOX_LOAD_TIMEOUT_MS): Promise<MapboxLoadResult> {
  return new Promise((resolve) => {
    // Already loaded
    if (window.mapboxgl) {
      resolve({ ready: true, mapboxgl: window.mapboxgl });
      return;
    }

    const startTime = Date.now();

    function poll() {
      if (window.mapboxgl) {
        resolve({ ready: true, mapboxgl: window.mapboxgl });
        return;
      }

      if (Date.now() - startTime >= timeoutMs) {
        resolve({
          ready: false,
          error: `Mapbox GL JS failed to load within ${timeoutMs}ms. Check network connection.`,
        });
        return;
      }

      // Use requestAnimationFrame for smoother polling
      requestAnimationFrame(poll);
    }

    // Start polling on next frame
    requestAnimationFrame(poll);
  });
}

/**
 * React hook-friendly version that returns status for UI rendering.
 * Components should call this once on mount and handle the result.
 */
export async function loadMapbox(): Promise<MapboxLoadResult> {
  return waitForMapbox();
}

/**
 * Synchronous check if Mapbox is currently available.
 */
export function isMapboxReady(): boolean {
  return typeof window !== 'undefined' && !!window.mapboxgl;
}

export default { waitForMapbox, loadMapbox, isMapboxReady };
