import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { useMapInitialization } from './useMapInitialization';
import { useMapPopups } from './useMapPopups';
import { useMapLayers } from './useMapLayers';

type HomeLocation = {
  center: [number, number];
  radius: number;
};

type GeospatialMapProps = {
  mapStyle: string;
  homeLocation: HomeLocation;
  mapRef: MutableRefObject<MapboxMap | null>;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  mapContainerRef: MutableRefObject<HTMLDivElement | null>;
  mapInitRef: MutableRefObject<boolean>;
  setMapReady: Dispatch<SetStateAction<boolean>>;
  setMapError: Dispatch<SetStateAction<string | null>>;
  logError: (message: string, error?: unknown) => void;
};

/**
 * Orchestrator hook for Mapbox initialization and lifecycle.
 * Delegates to specialized hooks for initialization, popups, and layers.
 */
export const useGeospatialMap = ({
  mapStyle,
  homeLocation,
  mapRef,
  mapboxRef,
  mapContainerRef,
  mapInitRef,
  setMapReady,
  setMapError,
  logError,
}: GeospatialMapProps) => {
  const { initMap } = useMapInitialization({
    mapStyle,
    homeLocation,
    mapRef,
    mapboxRef,
    mapContainerRef,
    setMapReady,
    setMapError,
    logError,
  });

  const { attachPopupHandlers } = useMapPopups(mapRef, mapboxRef);
  const { addBaseSourcesAndLayers, attachHoverHandlers } = useMapLayers();

  useEffect(() => {
    if (mapInitRef.current || !mapContainerRef.current) {
      return;
    }
    mapInitRef.current = true;

    let cleanupPopups: (() => void) | undefined;
    let cleanupHover: (() => void) | undefined;
    let cancelled = false;

    const init = async () => {
      const map = await initMap();
      if (cancelled) {
        if (map) {
          map.remove();
        }
        if (mapRef.current === map) {
          mapRef.current = null;
        }
        return;
      }
      if (!map) {
        return;
      }

      const onMapLoad = () => {
        if (cancelled) {
          return;
        }
        // 1. Add static layers and sources
        addBaseSourcesAndLayers(map, mapStyle, homeLocation);

        // 2. Attach interactive handlers
        cleanupPopups = attachPopupHandlers(map);
        cleanupHover = attachHoverHandlers(map);

        setMapReady(true);
      };

      if (map.isStyleLoaded()) {
        onMapLoad();
      } else {
        map.on('load', onMapLoad);
      }

      map.on('error', (e: any) => {
        if (cancelled) {
          return;
        }
        // Suppress Google Maps tile errors
        if (e?.error?.message === 'sn' || e?.sourceId === 'google-tiles') {
          if (mapStyle.startsWith('google-')) {
            setMapError('Google Maps tiles failed to load. Check API key configuration.');
          }
          return;
        }
        logError('Map error', e);
        setMapError('Map failed to load');
      });
    };

    init();

    return () => {
      cancelled = true;
      if (cleanupPopups) {
        cleanupPopups();
        cleanupPopups = undefined;
      }
      if (cleanupHover) {
        cleanupHover();
        cleanupHover = undefined;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      mapInitRef.current = false;
      setMapReady(false);
    };
  }, []);
};
