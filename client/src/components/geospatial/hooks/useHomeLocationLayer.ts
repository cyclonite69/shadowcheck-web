import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import { ensureHomeLocationLayers } from '../../../utils/mapHelpers';

type HomeLocation = {
  center: [number, number];
  radius: number;
};

type HomeLocationLayerProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<Map | null>;
  homeLocation?: HomeLocation | null;
  visible?: boolean;
};

export const useHomeLocationLayer = ({
  mapReady,
  mapRef,
  homeLocation,
  visible = true,
}: HomeLocationLayerProps) => {
  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }
    const map = mapRef.current;

    if (
      !homeLocation ||
      !Array.isArray(homeLocation.center) ||
      homeLocation.center.length < 2 ||
      !Number.isFinite(homeLocation.center[0]) ||
      !Number.isFinite(homeLocation.center[1])
    ) {
      return;
    }

    const syncHomeLayers = () => {
      if (!map.getStyle?.()) {
        return;
      }
      ensureHomeLocationLayers(map, homeLocation, visible);
    };

    syncHomeLayers();
    map.on('style.load', syncHomeLayers);

    return () => {
      if (mapRef.current !== map) {
        return;
      }
      map.off('style.load', syncHomeLayers);
    };
  }, [mapReady, mapRef, homeLocation, visible]);
};
