import type { FitBoundsOptions, LngLatBoundsLike, Map } from 'mapbox-gl';

const DEFAULT_ZOOM_INSET = 0.35;
const MAX_AUTO_ZOOM = 22;

/**
 * Fit bounds with a slight zoom-in inset in a single camera animation so we
 * avoid back-to-back zoom movements (which feel jittery in the UI).
 */
export const fitBoundsWithZoomInset = (
  map: Map,
  bounds: LngLatBoundsLike,
  options?: FitBoundsOptions,
  zoomInset: number = DEFAULT_ZOOM_INSET
) => {
  const duration =
    typeof options?.duration === 'number' && Number.isFinite(options.duration)
      ? options.duration
      : 1000;
  const essential = options?.essential ?? true;

  const camera = map.cameraForBounds(bounds, options);
  if (!camera) {
    map.fitBounds(bounds, options);
    return;
  }

  const targetZoom =
    zoomInset > 0
      ? Math.min(MAX_AUTO_ZOOM, (camera.zoom ?? map.getZoom()) + zoomInset)
      : camera.zoom;

  map.easeTo({
    ...camera,
    zoom: targetZoom,
    duration,
    essential,
  });
};
