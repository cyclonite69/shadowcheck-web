import React from 'react';

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
  const add3DBuildings = () => {
    if (!mapRef.current || mapRef.current.getLayer('3d-buildings')) return;

    const layers = mapRef.current.getStyle().layers;
    const labelLayerId = layers?.find(
      (layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']
    )?.id;

    mapRef.current.addLayer(
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
      } as any,
      labelLayerId
    );
  };

  const toggle3DBuildings = (enabled: boolean) => {
    if (!mapRef.current) return;

    if (enabled) {
      add3DBuildings();
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

  return { toggle3DBuildings, toggleTerrain };
};
