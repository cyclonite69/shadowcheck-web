import mapboxgl from 'mapbox-gl';
import { useEffect } from 'react';

/**
 * Map Orientation Controls Utility
 *
 * Adds compass (bearing reset) and distance scale to any Mapbox GL map instance.
 * Safe to call multiple times (idempotent) - won't duplicate controls.
 *
 * Features:
 * - Compass: Shows when map is rotated, click to reset bearing to 0°
 * - Scale: Dynamic distance legend (metric by default: km/m)
 *
 * Usage:
 * ```typescript
 * const map = new mapboxgl.Map({ ... });
 * const cleanup = attachMapOrientationControls(map, {
 *   scalePosition: 'bottom-right',
 *   scaleUnit: 'metric'
 * });
 * // Later: cleanup() to remove controls
 * ```
 *
 * Applied to:
 * - GeospatialExplorer (main map)
 * - WigleTestPage (WiGLE visualization)
 * - KeplerTestPage (DeckGL 3D map)
 *
 * @param map - Mapbox GL map instance
 * @param options - Configuration options
 * @returns Cleanup function to remove controls
 */
export interface MapOrientationOptions {
  /** Position for scale control (default: 'bottom-right') */
  scalePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Scale unit system (default: 'metric') */
  scaleUnit?: 'metric' | 'imperial' | 'nautical';
  /** Max width of scale bar in pixels (default: 160) */
  scaleMaxWidth?: number;
  /** Whether to add navigation control if missing (default: true) */
  ensureNavigation?: boolean;
  /** Position for navigation control if added (default: 'top-right') */
  navigationPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const CONTROL_MARKER = '__mapOrientationControlsAttached';

export function attachMapOrientationControls(
  map: mapboxgl.Map,
  options: MapOrientationOptions = {}
): () => void {
  const {
    scalePosition = 'bottom-right',
    scaleUnit = 'metric',
    scaleMaxWidth = 160,
    ensureNavigation = true,
    navigationPosition = 'top-right',
  } = options;

  // Prevent duplicate attachment
  if ((map as any)[CONTROL_MARKER]) {
    return () => {}; // Already attached, return no-op cleanup
  }

  const controls: mapboxgl.IControl[] = [];

  // Add NavigationControl if not already present (compass + zoom)
  if (ensureNavigation) {
    const hasNavControl = map._controls?.some((ctrl) => ctrl instanceof mapboxgl.NavigationControl);

    if (!hasNavControl) {
      const navControl = new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: false,
      });
      map.addControl(navControl, navigationPosition);
      controls.push(navControl);
    }
  }

  // Add ScaleControl (distance legend)
  const hasScaleControl = map._controls?.some((ctrl) => ctrl instanceof mapboxgl.ScaleControl);

  if (!hasScaleControl) {
    const scaleControl = new mapboxgl.ScaleControl({
      maxWidth: scaleMaxWidth,
      unit: scaleUnit,
    });
    map.addControl(scaleControl, scalePosition);
    controls.push(scaleControl);
  }

  // Mark as attached
  (map as any)[CONTROL_MARKER] = true;

  // Return cleanup function
  return () => {
    controls.forEach((ctrl) => {
      try {
        map.removeControl(ctrl);
      } catch (e) {
        // Control may already be removed
      }
    });
    delete (map as any)[CONTROL_MARKER];
  };
}

/**
 * React hook for attaching map orientation controls
 * Automatically cleans up on unmount
 *
 * @param mapRef - React ref containing Mapbox map instance
 * @param options - Configuration options
 */
export function useMapOrientationControls(
  mapRef: React.MutableRefObject<mapboxgl.Map | null>,
  options: MapOrientationOptions = {}
) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const cleanup = attachMapOrientationControls(map, options);
    return cleanup;
  }, [mapRef, options]);
}
