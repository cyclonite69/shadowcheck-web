/**
 * React hook orchestrating Address vs Directions mode.
 * Owns state; delegates to directionsClient (fetch) and directionsLayer (map rendering).
 */

import { useState, useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import { fetchDirections, type DirectionsData, type DirectionsMode } from './directionsClient';
import { applyDirectionsRoute, clearDirectionsRoute } from './directionsLayer';

export type SearchMode = 'address' | 'directions';

const STORAGE_KEY = 'shadowcheck_directions_mode';

function readPersistedMode(): SearchMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'address' || stored === 'directions') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'address';
}

export interface UseDirectionsModeReturn {
  mode: SearchMode;
  setMode: (m: SearchMode) => void;
  routeData: DirectionsData | null;
  loading: boolean;
  error: string | null;
  /** Fetch & render a route from origin to destination. */
  fetchRoute: (
    origin: [number, number],
    destination: [number, number],
    profile?: DirectionsMode
  ) => Promise<DirectionsData | null>;
  /** Clear the route from the map. */
  clearRoute: () => void;
}

export function useDirectionsMode(
  mapRef: MutableRefObject<Map | null>,
  initialMode?: SearchMode
): UseDirectionsModeReturn {
  const [mode, setModeState] = useState<SearchMode>(initialMode ?? readPersistedMode());
  const [routeData, setRouteData] = useState<DirectionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avoid stale closure over mapRef
  const mapRefStable = useRef(mapRef);
  mapRefStable.current = mapRef;

  const setMode = useCallback((m: SearchMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
    // When switching back to address mode, clear any existing route
    if (m === 'address') {
      const map = mapRefStable.current.current;
      if (map) clearDirectionsRoute(map);
      setRouteData(null);
      setError(null);
    }
  }, []);

  const clearRoute = useCallback(() => {
    const map = mapRefStable.current.current;
    if (map) clearDirectionsRoute(map);
    setRouteData(null);
    setError(null);
  }, []);

  const fetchRoute = useCallback(
    async (
      origin: [number, number],
      destination: [number, number],
      profile: DirectionsMode = 'driving'
    ): Promise<DirectionsData | null> => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchDirections(origin, destination, profile);
        if (!data) {
          setError('Could not fetch directions. Try again shortly.');
          const map = mapRefStable.current.current;
          if (map) clearDirectionsRoute(map);
          setRouteData(null);
          return null;
        }

        setRouteData(data);

        const map = mapRefStable.current.current;
        if (map) {
          applyDirectionsRoute(map, data);
        }

        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Directions request failed';
        setError(msg);
        setRouteData(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { mode, setMode, routeData, loading, error, fetchRoute, clearRoute };
}
