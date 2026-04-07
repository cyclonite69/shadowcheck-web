import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { mapboxApi } from '../../../api/mapboxApi';
import { MAP_STYLES, DEFAULT_ZOOM } from '../../../constants/network';
import { createGoogleStyle } from '../../../utils/mapHelpers';

type HomeLocation = {
  center: [number, number];
  radius: number;
};

type MapInitProps = {
  mapStyle: string;
  homeLocation: HomeLocation;
  mapRef: MutableRefObject<MapboxMap | null>;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  mapContainerRef: MutableRefObject<HTMLDivElement | null>;
  setMapReady: Dispatch<SetStateAction<boolean>>;
  setMapError: Dispatch<SetStateAction<string | null>>;
  logError: (message: string, error?: unknown) => void;
};

export const useMapInitialization = ({
  mapStyle,
  homeLocation,
  mapRef,
  mapboxRef,
  mapContainerRef,
  setMapReady,
  setMapError,
  logError,
}: MapInitProps) => {
  const initMap = useCallback(async () => {
    try {
      setMapReady(false);
      setMapError(null);

      const tokenBody = await mapboxApi.getMapboxToken();
      if (!tokenBody?.token) {
        throw new Error(tokenBody?.error || `Mapbox token not available`);
      }

      const mapboxgl = mapboxRef.current ?? (await import('mapbox-gl')).default;
      mapboxRef.current = mapboxgl as any;
      await import('mapbox-gl/dist/mapbox-gl.css' as any);
      (mapboxgl as any).accessToken = String(tokenBody.token).trim();

      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = '';
      }

      // Determine initial style (Google or Mapbox)
      let initialStyle;
      if (mapStyle.startsWith('google-')) {
        const googleType = mapStyle.replace('google-', '');
        initialStyle = createGoogleStyle(googleType);
      } else {
        initialStyle = mapStyle.startsWith('mapbox://styles/mapbox/standard')
          ? 'mapbox://styles/mapbox/standard'
          : mapStyle;
      }

      const map = new mapboxgl.Map({
        container: mapContainerRef.current as HTMLDivElement,
        style: initialStyle,
        center: homeLocation.center,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      });

      mapRef.current = map;

      // Add navigation control
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Dynamically load orientation controls
      import('../../../utils/mapOrientationControls').then(
        async ({ attachMapOrientationControls }) => {
          await attachMapOrientationControls(map, {
            scalePosition: 'bottom-right',
            scaleUnit: 'metric',
            ensureNavigation: false,
          });
        }
      );

      // Handle Standard style config
      const styleConfig = MAP_STYLES.find((s) => s.value === mapStyle);
      if (styleConfig && 'config' in styleConfig && (styleConfig.config as any)?.lightPreset) {
        map.on('load', () => {
          map.setConfigProperty('basemap', 'lightPreset', (styleConfig.config as any).lightPreset);
        });
      }

      return map;
    } catch (err) {
      logError('Map init failed', err);
      setMapError(err instanceof Error ? err.message : 'Map initialization failed');
      return null;
    }
  }, [
    mapStyle,
    homeLocation,
    mapRef,
    mapboxRef,
    mapContainerRef,
    setMapReady,
    setMapError,
    logError,
  ]);

  return { initMap };
};
