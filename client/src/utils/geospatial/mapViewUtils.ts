import type { FitBoundsOptions, LngLatBoundsLike, Map } from 'mapbox-gl';

const DEFAULT_ZOOM_INSET = 0.35;
const MAX_AUTO_ZOOM = 22;

/**
 * Fit bounds, then nudge zoom in slightly so the viewport doesn't sit right on
 * style transition thresholds (e.g. terrain/building visibility edges).
 */
export const fitBoundsWithZoomInset = (
  map: Map,
  bounds: LngLatBoundsLike,
  options?: FitBoundsOptions,
  zoomInset: number = DEFAULT_ZOOM_INSET
) => {
  map.fitBounds(bounds, options);

  if (zoomInset <= 0) return;

  map.once('moveend', () => {
    const zoom = map.getZoom();
    map.easeTo({
      zoom: Math.min(MAX_AUTO_ZOOM, zoom + zoomInset),
      duration: 300,
      essential: true,
    });
  });
};
