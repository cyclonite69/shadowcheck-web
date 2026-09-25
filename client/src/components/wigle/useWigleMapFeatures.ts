import { useEffect } from 'react';
import { logWarn } from '../../logging/clientLogger';
import { setPointRadius } from './mapLayers';
import { apply3dBuildings, applyTerrain, runWhenStyleReady } from './mapLifecycle';

export function useWigleMapFeatures({
  mapRef,
  mapReady,
  mapStyle,
  show3dBuildings,
  showTerrain,
  pointSize,
  styleEffectInitRef,
  wigleHandlersAttachedRef,
  applyEnabledWigleOverlays,
}: any): void {
  // Point radius sync
  useEffect(() => {
    if (mapRef.current && mapReady) {
      setPointRadius(mapRef.current, pointSize);
    }
  }, [mapReady, mapRef, pointSize]);

  // Style change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    if (!styleEffectInitRef.current) {
      styleEffectInitRef.current = true;
      return;
    }

    const actualStyleUrl = mapStyle.startsWith('mapbox://styles/mapbox/standard')
      ? 'mapbox://styles/mapbox/standard'
      : mapStyle;
    const lightPresetMap: Record<string, string> = {
      'mapbox://styles/mapbox/standard': 'day',
      'mapbox://styles/mapbox/standard-dawn': 'dawn',
      'mapbox://styles/mapbox/standard-dusk': 'dusk',
      'mapbox://styles/mapbox/standard-night': 'night',
    };
    const lightPreset = lightPresetMap[mapStyle];

    let complete = false;

    const cleanup = () => {
      map.off('style.load', handleStyleReady);
      map.off('idle', handleStyleReady);
    };

    function handleStyleReady() {
      if (complete || !map.isStyleLoaded()) {
        return;
      }
      complete = true;
      cleanup();
      if (lightPreset && typeof map.setConfigProperty === 'function') {
        try {
          map.setConfigProperty('basemap', 'lightPreset', lightPreset);
        } catch (err) {
          logWarn('[WiGLE] Failed to apply Mapbox light preset after style reload', err);
        }
      }
      wigleHandlersAttachedRef.current = false;
      applyEnabledWigleOverlays('style-change');
    }

    map.once('style.load', handleStyleReady);
    map.once('idle', handleStyleReady);

    try {
      map.setStyle(actualStyleUrl);
    } catch (err) {
      cleanup();
      logWarn('[WiGLE] Failed to set map style', err);
    }

    return cleanup;
  }, [
    mapStyle,
    mapReady,
    mapRef,
    applyEnabledWigleOverlays,
    styleEffectInitRef,
    wigleHandlersAttachedRef,
  ]);

  // 3D buildings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    return runWhenStyleReady(map, '3d-buildings', () =>
      apply3dBuildings(map, mapStyle, show3dBuildings)
    );
  }, [mapReady, mapRef, mapStyle, show3dBuildings]);

  // Terrain
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }
    return runWhenStyleReady(map, 'terrain', () => applyTerrain(map, mapStyle, showTerrain));
  }, [mapReady, mapRef, mapStyle, showTerrain]);
}
