/**
 * WiGLE Map Initialization Hook
 * Handles Mapbox map setup and initial configuration
 */

import { useEffect, type MutableRefObject } from 'react';
import type mapboxglType from 'mapbox-gl';
import { logDebug } from '../../logging/clientLogger';
import { EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';

interface UseWigleMapInitProps {
  mapContainerRef: MutableRefObject<HTMLDivElement | null>;
  mapRef: MutableRefObject<mapboxglType.Map | null>;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  v2FCRef: MutableRefObject<any>;
  v3FCRef: MutableRefObject<any>;
  mapStyle: string;
  setMapSize: (size: { width: number; height: number }) => void;
  setTokenStatus: (status: 'idle' | 'ok' | 'error') => void;
  setError: (error: string | null) => void;
  setMapReady: (ready: boolean) => void;
  setTilesReady: (ready: boolean) => void;
  ensureAllLayers: () => void;
  attachClickHandlersCallback: () => void;
  updateAllClusterColorsCallback: () => void;
}

export const useWigleMapInit = ({
  mapContainerRef,
  mapRef,
  mapboxRef,
  v2FCRef,
  v3FCRef,
  mapStyle,
  setMapSize,
  setTokenStatus,
  setError,
  setMapReady,
  setTilesReady,
  ensureAllLayers,
  attachClickHandlersCallback,
  updateAllClusterColorsCallback,
}: UseWigleMapInitProps) => {
  useEffect(() => {
    let mounted = true;

    const updateSize = () => {
      if (!mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      setMapSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      mapRef.current?.resize();
    };

    const initMap = async () => {
      try {
        const mapboxgl = mapboxRef.current ?? (await import('mapbox-gl')).default;
        mapboxRef.current = mapboxgl;
        await import('mapbox-gl/dist/mapbox-gl.css');

        if (!mapboxgl.supported()) {
          throw new Error('Mapbox GL not supported (WebGL unavailable)');
        }

        const tokenRes = await fetch('/api/mapbox-token');
        const tokenBody = await tokenRes.json();
        if (!tokenRes.ok || !tokenBody?.token) {
          throw new Error(tokenBody?.error || 'Mapbox token not available');
        }
        setTokenStatus('ok');
        mapboxgl.accessToken = String(tokenBody.token).trim();

        if (!mounted || !mapContainerRef.current) return;

        const initialStyleUrl = mapStyle.startsWith('mapbox://styles/mapbox/standard')
          ? 'mapbox://styles/mapbox/standard'
          : mapStyle;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: initialStyleUrl,
          center: [-98.5795, 39.8283],
          zoom: 3,
        });
        mapRef.current = map;

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        import('../../utils/mapOrientationControls').then(
          async ({ attachMapOrientationControls }) => {
            await attachMapOrientationControls(map, {
              scalePosition: 'bottom-right',
              scaleUnit: 'metric',
              ensureNavigation: false,
            });
          }
        );

        updateSize();

        map.on('load', () => {
          const lightPresetMap: Record<string, string> = {
            'mapbox://styles/mapbox/standard': 'day',
            'mapbox://styles/mapbox/standard-dawn': 'dawn',
            'mapbox://styles/mapbox/standard-dusk': 'dusk',
            'mapbox://styles/mapbox/standard-night': 'night',
          };
          const lightPreset = lightPresetMap[mapStyle];
          if (lightPreset && typeof map.setConfigProperty === 'function') {
            try {
              map.setConfigProperty('basemap', 'lightPreset', lightPreset);
            } catch (e) {
              // setConfigProperty may not be available
            }
          }

          ensureAllLayers();
          attachClickHandlersCallback();

          const v2Src = map.getSource('wigle-v2-points') as mapboxglType.GeoJSONSource | undefined;
          if (v2Src) v2Src.setData((v2FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
          const v3Src = map.getSource('wigle-v3-points') as mapboxglType.GeoJSONSource | undefined;
          if (v3Src) v3Src.setData((v3FCRef.current || EMPTY_FEATURE_COLLECTION) as any);

          setMapReady(true);
          setTimeout(() => map.resize(), 0);
          updateAllClusterColorsCallback();
        });

        map.on('idle', () => {
          if (!mounted) return;
          setTilesReady(map.areTilesLoaded());
        });

        map.on('error', (event) => {
          if (!mounted) return;
          const errorMsg = event?.error?.message || '';

          if (
            errorMsg.includes('source') ||
            errorMsg.includes('layer') ||
            errorMsg.includes('composite') ||
            errorMsg.includes('building')
          ) {
            logDebug('[Wigle] Map style incompatibility (ignored):', errorMsg);
            return;
          }

          setError(errorMsg || 'Mapbox error');
        });

        map.on('moveend', updateAllClusterColorsCallback);
        map.on('zoomend', updateAllClusterColorsCallback);
        map.on('sourcedata', (event) => {
          if (
            (event.sourceId === 'wigle-v2-points' || event.sourceId === 'wigle-v3-points') &&
            event.isSourceLoaded
          ) {
            updateAllClusterColorsCallback();
          }
        });
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to initialize map');
          setTokenStatus('error');
        }
      }
    };

    initMap();
    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
};
