/**
 * Pure fetch wrapper for Mapbox Directions API.
 * Zero imports from React or other app modules — leaf module.
 */

export type DirectionsMode = 'driving' | 'walking' | 'cycling';

export interface DirectionsData {
  coordinates: [number, number][];
  distance_meters: number;
  duration_seconds: number;
}

const cache = new Map<string, DirectionsData>();
let lastFetchMs = 0;
const CACHE_BUCKET_MS = 300_000; // 5 minutes
const RATE_LIMIT_MS = 2_000; // 2 seconds between unique route calls

function makeCacheKey(
  origin: [number, number],
  destination: [number, number],
  mode: DirectionsMode
): string {
  const oKey = `${origin[0].toFixed(5)},${origin[1].toFixed(5)}`;
  const dKey = `${destination[0].toFixed(5)},${destination[1].toFixed(5)}`;
  const bucket = Math.floor(Date.now() / CACHE_BUCKET_MS);
  return `${oKey}>${dKey}:${mode}:${bucket}`;
}

/**
 * Fetch driving/walking/cycling directions between two points.
 * Returns null on error, rate-limit hit, or missing token.
 */
export async function fetchDirections(
  origin: [number, number],
  destination: [number, number],
  mode: DirectionsMode = 'driving'
): Promise<DirectionsData | null> {
  const now = Date.now();
  const cacheKey = makeCacheKey(origin, destination, mode);

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  if (now - lastFetchMs < RATE_LIMIT_MS) {
    return null;
  }

  // Fetch Mapbox token from settings endpoint (same pattern as geocoding)
  let token: string;
  try {
    const tokenRes = await fetch('/api/mapbox-token');
    if (!tokenRes.ok) throw new Error(`Token HTTP ${tokenRes.status}`);
    const tokenBody = await tokenRes.json();
    token = String(tokenBody.token).trim();
    if (!token) throw new Error('Empty token');
  } catch {
    return null;
  }

  const profile = mode === 'driving' ? 'driving' : mode === 'walking' ? 'walking' : 'cycling';
  const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&access_token=${token}`;

  try {
    lastFetchMs = now;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    const result: DirectionsData = {
      coordinates: route.geometry.coordinates as [number, number][],
      distance_meters: route.distance,
      duration_seconds: route.duration,
    };

    cache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/** Exposed for testing — resets internal cache and rate limiter. */
export function _resetForTest(): void {
  cache.clear();
  lastFetchMs = 0;
}
