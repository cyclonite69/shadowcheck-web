import { useEffect } from 'react';
import type { Map } from 'mapbox-gl';

interface UseMapInteractionLockParams {
  mapReady: boolean;
  mapRef: React.MutableRefObject<Map | null>;
  isLocked: boolean;
}

/**
 * Hook to lock/unlock map interactions (pan, zoom, rotate) based on the isLocked state.
 * This provides the "Viewport Lock" behavior where the map stays fixed.
 */
export const useMapInteractionLock = ({
  mapReady,
  mapRef,
  isLocked,
}: UseMapInteractionLockParams) => {
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;

    if (isLocked) {
      // Disable interactions
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.dragPan.disable();
      map.dragRotate.disable();
      map.keyboard.disable();
      map.doubleClickZoom.disable();
      if (map.touchZoomRotate) {
        map.touchZoomRotate.disable();
      }
    } else {
      // Enable interactions
      map.scrollZoom.enable();
      map.boxZoom.enable();
      map.dragPan.enable();
      map.dragRotate.enable();
      map.keyboard.enable();
      map.doubleClickZoom.enable();
      if (map.touchZoomRotate) {
        map.touchZoomRotate.enable();
      }
    }
  }, [mapReady, mapRef, isLocked]);
};
