import React, { useCallback, useEffect, useState } from 'react';

interface MapLayersToggleProps {
  mapRef: React.MutableRefObject<any>;
  setShow3DBuildings: (enabled: boolean) => void;
  setShowTerrain: (enabled: boolean) => void;
}

export const useMapLayersToggle = ({
  mapRef,
  setShow3DBuildings,
  setShowTerrain,
}: MapLayersToggleProps) => {
  const [is3DBuildingsAvailable, setIs3DBuildingsAvailable] = useState(false);

  const resolve3DBuildingSource = useCallback((): string | null => {
    if (!mapRef.current) return null;

    const style = mapRef.current.getStyle();
    if (!style) return null;

    const sources = style.sources as Record<string, unknown> | undefined;
    if (!sources) return null;

    if (sources.composite) return 'composite';

    const buildingLayer = style.layers?.find(
      (layer: any) => layer?.['source-layer'] === 'building' && typeof layer?.source === 'string'
    ) as { source?: string } | undefined;

    return buildingLayer?.source && sources[buildingLayer.source] ? buildingLayer.source : null;
  }, [mapRef]);

  const refresh3DBuildingAvailability = useCallback(() => {
    const supported = Boolean(resolve3DBuildingSource());
    setIs3DBuildingsAvailable(supported);

    if (!mapRef.current) return;
    if (!supported && mapRef.current.getLayer('3d-buildings')) {
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
    if (!mapRef.current || mapRef.current.getLayer('3d-buildings')) return true;

    const sourceId = resolve3DBuildingSource();
    if (!sourceId) return false;

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

    if (enabled) {
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
    if (!mapRef.current || mapRef.current.getSource('mapbox-dem')) return;

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

    if (enabled) {
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
