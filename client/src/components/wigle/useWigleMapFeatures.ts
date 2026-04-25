import { useEffect } from 'react';
import type { Map, GeoJSONSource } from 'mapbox-gl';
import { logDebug } from '../../logging/clientLogger';
import { EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';
import { ensureFieldDataLayer, updateFieldDataSource, setPointRadius } from './mapLayers';

export function useWigleMapFeatures({
  mapRef,
  mapReady,
  mapStyle,
  show3dBuildings,
  showTerrain,
  pointSize,
  v2FCRef,
  v3FCRef,
  kmlFCRef,
  fieldDataFCRef,
  showFieldDataRef,
  aggregatedFCRef,
  styleEffectInitRef,
  wigleHandlersAttachedRef,
  ensureAllLayers,
  attachClickHandlersCallback,
  applyLayerVisibilityCallback,
  updateAllClusterColorsCallback,
}: any): void {
  // Point radius sync
  useEffect(() => {
    if (mapRef.current && mapReady) setPointRadius(mapRef.current, pointSize);
  }, [pointSize, mapReady]);

  // Style change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!styleEffectInitRef.current) {
      styleEffectInitRef.current = true;
      return;
    }

    const recreateLayers = () => {
      ensureAllLayers();
      attachClickHandlersCallback();
      const v2Src = map.getSource('wigle-v2-points') as GeoJSONSource | undefined;
      if (v2Src) v2Src.setData((v2FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
      const v3Src = map.getSource('wigle-v3-points') as GeoJSONSource | undefined;
      if (v3Src) v3Src.setData((v3FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
      const kmlSrc = map.getSource('wigle-kml-points') as GeoJSONSource | undefined;
      if (kmlSrc) kmlSrc.setData((kmlFCRef.current || EMPTY_FEATURE_COLLECTION) as any);
      if (showFieldDataRef.current && fieldDataFCRef.current) {
        ensureFieldDataLayer(map);
        updateFieldDataSource(map, fieldDataFCRef.current);
      }
      const aggregatedSrc = map.getSource('wigle-aggregated') as GeoJSONSource | undefined;
      if (aggregatedSrc)
        aggregatedSrc.setData((aggregatedFCRef.current || EMPTY_FEATURE_COLLECTION) as any);
      applyLayerVisibilityCallback();
      updateAllClusterColorsCallback();
    };

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

    map.setStyle(actualStyleUrl);
    map.once('style.load', () => {
      if (lightPreset && typeof map.setConfigProperty === 'function') {
        try {
          map.setConfigProperty('basemap', 'lightPreset', lightPreset);
        } catch (e) {}
      }
      wigleHandlersAttachedRef.current = false;
      recreateLayers();
    });
  }, [
    mapStyle,
    mapReady,
    ensureAllLayers,
    attachClickHandlersCallback,
    applyLayerVisibilityCallback,
    updateAllClusterColorsCallback,
  ]);

  // 3D buildings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const ensure3DView = () => {
      if (map.getPitch() < 45) map.easeTo({ pitch: 60, duration: 600, essential: true });
    };
    const toggleBuildings = () => {
      const style = map.getStyle();
      const isStandardStyle =
        mapStyle.includes('mapbox://styles/mapbox/standard') ||
        (typeof map.setConfigProperty === 'function' &&
          (style?.schema?.hasOwnProperty('basemap') ||
            style?.imports?.some((i: any) => i.id === 'basemap' || i.id === 'mapbox-standard')));

      try {
        if (isStandardStyle) {
          try {
            map.setConfigProperty('basemap', 'show3dObjects', show3dBuildings);
            if (show3dBuildings) ensure3DView();
          } catch (e) {
            try {
              map.setConfigProperty('mapbox-standard', 'show3dObjects', show3dBuildings);
              if (show3dBuildings) ensure3DView();
            } catch (e2) {
              logDebug('[Wigle] Standard style 3D buildings config failed');
            }
          }
          return;
        }

        if (show3dBuildings) {
          if (!map.getLayer('3d-buildings')) {
            const styleLayers = map.getStyle().layers;
            const labelLayerId = styleLayers?.find(
              (layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']
            )?.id;
            map.addLayer(
              {
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 15,
                paint: {
                  'fill-extrusion-color': '#aaa',
                  'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15,
                    0,
                    15.05,
                    ['get', 'height'],
                  ],
                  'fill-extrusion-base': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15,
                    0,
                    15.05,
                    ['get', 'min_height'],
                  ],
                  'fill-extrusion-opacity': 0.6,
                },
              },
              labelLayerId
            );
            ensure3DView();
          }
        } else if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings');
      } catch (err) {
        logDebug('[Wigle] 3D buildings error: ' + (err as Error).message);
      }
    };
    if (map.isStyleLoaded()) toggleBuildings();
    else map.once('style.load', toggleBuildings);
  }, [show3dBuildings, mapReady, mapStyle]);

  // Terrain
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const ensure3DView = () => {
      if (map.getPitch() < 45) map.easeTo({ pitch: 60, duration: 600, essential: true });
    };

    const toggleTerrainAction = () => {
      const style = map.getStyle();
      const isStandardStyle =
        mapStyle.includes('mapbox://styles/mapbox/standard') ||
        (typeof map.setConfigProperty === 'function' &&
          (style?.schema?.hasOwnProperty('basemap') ||
            style?.imports?.some((i: any) => i.id === 'basemap' || i.id === 'mapbox-standard')));

      try {
        if (isStandardStyle) {
          try {
            map.setConfigProperty('basemap', 'showTerrain', showTerrain);
            if (showTerrain) ensure3DView();
          } catch (e) {
            try {
              map.setConfigProperty('mapbox-standard', 'showTerrain', showTerrain);
              if (showTerrain) ensure3DView();
            } catch (e2) {
              logDebug('[Wigle] Standard style terrain config failed');
            }
          }
          return;
        }

        if (showTerrain) {
          if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', {
              type: 'raster-dem',
              url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
              tileSize: 512,
              maxzoom: 14,
            });
          }
          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          ensure3DView();
        } else {
          map.setTerrain(null);
          if (map.getSource('mapbox-dem')) map.removeSource('mapbox-dem');
        }
      } catch (err) {
        logDebug('[Wigle] Terrain error: ' + (err as Error).message);
      }
    };
    if (map.isStyleLoaded()) toggleTerrainAction();
    else map.once('style.load', toggleTerrainAction);
  }, [showTerrain, mapReady, mapStyle]);
}
