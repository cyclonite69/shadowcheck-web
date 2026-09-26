import type { Map } from 'mapbox-gl';
import { logDebug, logWarn } from '../../logging/clientLogger';

type StyleReadyCallback = () => void;

export function runWhenStyleReady(
  map: Map,
  reason: string,
  callback: StyleReadyCallback
): (() => void) | undefined {
  const runSafely = () => {
    try {
      callback();
    } catch (err) {
      logWarn(`[WiGLE] Map overlay apply failed (${reason})`, err);
    }
  };

  if (map.isStyleLoaded()) {
    runSafely();
    return undefined;
  }

  let complete = false;

  const cleanup = () => {
    map.off('style.load', runIfReady);
    map.off('idle', runIfReady);
  };

  function runIfReady() {
    if (complete || !map.isStyleLoaded()) {
      return;
    }
    complete = true;
    cleanup();
    runSafely();
  }

  map.on('style.load', runIfReady);
  map.on('idle', runIfReady);
  logDebug(`[WiGLE] Queued map overlay apply until style is ready (${reason})`);

  return cleanup;
}

export function apply3dBuildings(map: Map, mapStyle: string, enabled: boolean) {
  const isStandardStyle = mapStyle.includes('mapbox://styles/mapbox/standard');

  if (isStandardStyle) {
    try {
      map.setConfigProperty('basemap', 'show3dObjects', enabled);
      return;
    } catch (err) {
      try {
        map.setConfigProperty('mapbox-standard', 'show3dObjects', enabled);
        return;
      } catch (fallbackErr) {
        logDebug('[Wigle] Standard style 3D buildings config failed', { err, fallbackErr });
      }
    }
  }

  if (enabled) {
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
    }
  } else if (map.getLayer('3d-buildings')) {
    map.removeLayer('3d-buildings');
  }
}

export function applyTerrain(map: Map, mapStyle: string, enabled: boolean) {
  const isStandardStyle = mapStyle.includes('mapbox://styles/mapbox/standard');

  if (isStandardStyle) {
    try {
      map.setConfigProperty('basemap', 'showTerrain', enabled);
      return;
    } catch (err) {
      try {
        map.setConfigProperty('mapbox-standard', 'showTerrain', enabled);
        return;
      } catch (fallbackErr) {
        logDebug('[Wigle] Standard style terrain config failed', { err, fallbackErr });
      }
    }
  }

  if (enabled) {
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  } else {
    map.setTerrain(null);
    if (map.getSource('mapbox-dem')) {
      map.removeSource('mapbox-dem');
    }
  }
}
