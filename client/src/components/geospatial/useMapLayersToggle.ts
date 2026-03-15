import React, { useCallback, useEffect, useState } from 'react';

interface MapLayersToggleProps {
  mapRef: React.MutableRefObject<any>;
  setShow3DBuildings: (enabled: boolean) => void;
  setShowTerrain: (enabled: boolean) => void;
  mapStyle?: string;
}

export const useMapLayersToggle = ({
  mapRef,
  setShow3DBuildings,
  setShowTerrain,
  mapStyle,
}: MapLayersToggleProps) => {
  const [is3DBuildingsAvailable, setIs3DBuildingsAvailable] = useState(false);

  const isStandardStyle = useCallback((): boolean => {
    if (!mapRef.current) return false;
    if (mapStyle?.startsWith('mapbox://styles/mapbox/standard')) return true;

    try {
      const style = mapRef.current.getStyle();
      return (
        style?.schema?.basemap !== undefined ||
        style?.imports?.some((i: any) => i.id === 'basemap') ||
        typeof mapRef.current.setConfigProperty === 'function'
      );
    } catch {
      return false;
    }
  }, [mapRef, mapStyle]);

  const resolve3DBuildingSource = useCallback((): string | null => {
    if (!mapRef.current) return null;
    if (typeof mapRef.current.isStyleLoaded === 'function' && !mapRef.current.isStyleLoaded()) {
      return null;
    }

    if (isStandardStyle()) return 'mapbox-standard';

    let style;
    try {
      style = mapRef.current.getStyle();
    } catch {
      return null;
    }
    if (!style) return null;

    const sources = style.sources as Record<string, unknown> | undefined;
    if (!sources) return null;

    if (sources.composite) return 'composite';

    const buildingLayer = style.layers?.find(
      (layer: any) => layer?.['source-layer'] === 'building' && typeof layer?.source === 'string'
    ) as { source?: string } | undefined;

    return buildingLayer?.source && sources[buildingLayer.source] ? buildingLayer.source : null;
  }, [mapRef, isStandardStyle]);

  const refresh3DBuildingAvailability = useCallback(() => {
    const sourceId = resolve3DBuildingSource();
    const supported = Boolean(sourceId);
    setIs3DBuildingsAvailable(supported);

    if (!mapRef.current) return;

    // For non-standard styles, if building source is missing, remove our custom layer
    if (!supported && sourceId !== 'mapbox-standard' && mapRef.current.getLayer('3d-buildings')) {
      mapRef.current.removeLayer('3d-buildings');
      setShow3DBuildings(false);
      localStorage.setItem('shadowcheck_show_3d_buildings', 'false');
    }
  }, [mapRef, resolve3DBuildingSource, setShow3DBuildings]);

  useEffect(() => {
    let cancelled = false;
    let animationFrameId = 0;
    let boundMap: any = null;

    const handler = () => refresh3DBuildingAvailability();

    const bindMapEvents = () => {
      if (cancelled) return;

      const map = mapRef.current;
      if (!map) {
        animationFrameId = window.requestAnimationFrame(bindMapEvents);
        return;
      }

      boundMap = map;
      handler();
      map.on('load', handler);
      map.on('style.load', handler);
    };

    bindMapEvents();

    return () => {
      cancelled = true;
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (boundMap) {
        boundMap.off('load', handler);
        boundMap.off('style.load', handler);
      }
    };
  }, [mapRef, refresh3DBuildingAvailability]);

  const add3DBuildings = (): boolean => {
    if (!mapRef.current) return false;
    if (typeof mapRef.current.isStyleLoaded === 'function' && !mapRef.current.isStyleLoaded()) {
      return false;
    }

    const sourceId = resolve3DBuildingSource();
    if (!sourceId) return false;

    // Standard style handles 3D buildings via config property
    if (sourceId === 'mapbox-standard') {
      try {
        mapRef.current.setConfigProperty('basemap', 'show3dObjects', true);
        return true;
      } catch {
        return false;
      }
    }

    if (mapRef.current.getLayer('3d-buildings')) return true;

    const layers = mapRef.current.getStyle()?.layers;
    const labelLayerId = layers?.find(
      (layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']
    )?.id;

    try {
      mapRef.current.addLayer(
        {
          id: '3d-buildings',
          source: sourceId,
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
        } as any,
        labelLayerId
      );
      return true;
    } catch {
      return false;
    }
  };

  const toggle3DBuildings = (enabled: boolean) => {
    if (!mapRef.current) return;

    const sourceId = resolve3DBuildingSource();
    if (sourceId === 'mapbox-standard') {
      try {
        mapRef.current.setConfigProperty('basemap', 'show3dObjects', enabled);
      } catch (e) {
        console.error('Failed to set standard style 3D buildings:', e);
      }
    } else if (enabled) {
      if (!add3DBuildings()) {
        setShow3DBuildings(false);
        localStorage.setItem('shadowcheck_show_3d_buildings', 'false');
        return;
      }
    } else if (mapRef.current.getLayer('3d-buildings')) {
      mapRef.current.removeLayer('3d-buildings');
    }

    localStorage.setItem('shadowcheck_show_3d_buildings', String(enabled));
    setShow3DBuildings(enabled);
  };

  const addTerrain = () => {
    if (!mapRef.current) return;
    if (typeof mapRef.current.isStyleLoaded === 'function' && !mapRef.current.isStyleLoaded()) {
      return;
    }

    if (isStandardStyle()) {
      try {
        mapRef.current.setConfigProperty('basemap', 'showTerrain', true);
        return;
      } catch (e) {
        // Fallback to traditional method if setConfigProperty fails
      }
    }

    if (mapRef.current.getSource('mapbox-dem')) return;

    mapRef.current.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    });

    mapRef.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  };

  const toggleTerrain = (enabled: boolean) => {
    if (!mapRef.current) return;

    if (isStandardStyle()) {
      try {
        mapRef.current.setConfigProperty('basemap', 'showTerrain', enabled);
      } catch (e) {
        console.error('Failed to set standard style terrain:', e);
      }
    } else if (enabled) {
      addTerrain();
    } else {
      mapRef.current.setTerrain(null);
      if (mapRef.current.getSource('mapbox-dem')) {
        mapRef.current.removeSource('mapbox-dem');
      }
    }

    localStorage.setItem('shadowcheck_show_terrain', String(enabled));
    setShowTerrain(enabled);
  };

  return { toggle3DBuildings, toggleTerrain, add3DBuildings, addTerrain, is3DBuildingsAvailable };
};
