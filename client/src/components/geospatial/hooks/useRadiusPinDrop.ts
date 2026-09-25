/**
 * useRadiusPinDrop
 *
 * Handles two map interactions that populate radiusFilter:
 *  1. Pin-drop mode: one-shot left-click on the map sets the center.
 *  2. Empty-space right-click: shows a small context menu at the cursor.
 *
 * Both interactions are registered on the Mapbox map instance and cleaned
 * up when the component unmounts or mapReady changes.
 */
import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { usePinDropStore } from '../../../stores/pinDropStore';
import { useFilterStore } from '../../../stores/filterStore';

const DEFAULT_RADIUS_METERS = 500;

export interface RadiusContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export function useRadiusPinDrop(
  mapReady: boolean,
  mapRef: React.MutableRefObject<MapboxMap | null>
) {
  const pinDropActive = usePinDropStore((s) => s.active);
  const cancelPinDrop = usePinDropStore((s) => s.cancel);
  const setFilter = useFilterStore((s) => s.setFilter);
  const enableFilter = useFilterStore((s) => s.enableFilter);
  const getCurrentFilters = useFilterStore((s) => s.getCurrentFilters);

  const [contextMenu, setContextMenu] = useState<RadiusContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    lat: 0,
    lng: 0,
  });

  const pinDropActiveRef = useRef(pinDropActive);
  useEffect(() => {
    pinDropActiveRef.current = pinDropActive;
  }, [pinDropActive]);

  // Cursor management for pin-drop mode
  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }
    const map = mapRef.current;
    map.getCanvas().style.cursor = pinDropActive ? 'crosshair' : '';
    return () => {
      if (mapRef.current) {
        mapRef.current.getCanvas().style.cursor = '';
      }
    };
  }, [pinDropActive, mapReady, mapRef]);

  // Escape key cancels pin-drop mode
  useEffect(() => {
    if (!pinDropActive) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelPinDrop();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pinDropActive, cancelPinDrop]);

  // Map event handlers
  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }
    const map = mapRef.current;

    const handleClick = (e: any) => {
      if (!pinDropActiveRef.current) {
        return;
      }
      // Don't fire if a feature was clicked (let layer handlers take it)
      if (e.features && e.features.length > 0) {
        return;
      }

      const { lat, lng } = e.lngLat;
      const current = getCurrentFilters().radiusFilter;
      const radiusMeters = current?.radiusMeters || DEFAULT_RADIUS_METERS;

      setFilter('radiusFilter', { latitude: lat, longitude: lng, radiusMeters });
      enableFilter('radiusFilter', true);
      cancelPinDrop();
    };

    const handleContextMenu = (e: any) => {
      // Only fire on empty space — if a layer feature is under the cursor,
      // the layer-level contextmenu handler fires first and stops propagation.
      if (e.features && e.features.length > 0) {
        return;
      }

      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      });
    };

    map.on('click', handleClick);
    map.on('contextmenu', handleContextMenu);

    return () => {
      map.off('click', handleClick);
      map.off('contextmenu', handleContextMenu);
    };
  }, [mapReady, mapRef, cancelPinDrop, setFilter, enableFilter, getCurrentFilters]);

  const closeContextMenu = () => setContextMenu((prev) => ({ ...prev, visible: false }));

  const setRadiusFromContextMenu = () => {
    const current = getCurrentFilters().radiusFilter;
    const radiusMeters = current?.radiusMeters || DEFAULT_RADIUS_METERS;
    setFilter('radiusFilter', {
      latitude: contextMenu.lat,
      longitude: contextMenu.lng,
      radiusMeters,
    });
    enableFilter('radiusFilter', true);
    closeContextMenu();
  };

  const clearRadiusFilter = () => {
    enableFilter('radiusFilter', false);
    closeContextMenu();
  };

  return { contextMenu, closeContextMenu, setRadiusFromContextMenu, clearRadiusFilter };
}
