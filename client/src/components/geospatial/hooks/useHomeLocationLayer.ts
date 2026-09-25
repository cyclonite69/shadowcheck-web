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
  homeLocation: HomeLocation;
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

    ensureHomeLocationLayers(map, homeLocation, visible);
  }, [mapReady, mapRef, homeLocation, visible]);
};
