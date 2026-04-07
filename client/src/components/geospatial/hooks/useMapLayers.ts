import { useCallback } from 'react';
import type { Map as MapboxMap, GeoJSONSource, MapLayerMouseEvent } from 'mapbox-gl';
import { createCirclePolygon, calculateSignalRange, macColor } from '../../../utils/mapHelpers';

const getNumericProperty = (props: Record<string, unknown>, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = props[key];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return value;
      continue;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
};

type HomeLocation = {
  center: [number, number];
  radius: number;
};

export const useMapLayers = () => {
  const addBaseSourcesAndLayers = useCallback(
    (map: MapboxMap, mapStyle: string, homeLocation: HomeLocation) => {
      // 1. Observation Sources
      map.addSource('observations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('observation-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // 2. Observation Layers
      map.addLayer({
        id: 'observation-lines',
        type: 'line',
        source: 'observation-lines',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.6,
        },
      });

      map.addLayer({
        id: 'observation-points',
        type: 'circle',
        source: 'observations',
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.8,
        },
      });

      map.addLayer({
        id: 'observation-labels',
        type: 'symbol',
        source: 'observations',
        layout: {
          'text-field': ['get', 'number'],
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // 3. Hover Circle Source & Layers
      map.addSource('hover-circle', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      const isStandardStyle = mapStyle.startsWith('mapbox://styles/mapbox/standard');

      if (isStandardStyle) {
        map.addLayer({
          id: 'hover-circle-fill',
          type: 'fill',
          source: 'hover-circle',
          filter: ['==', ['geometry-type'], 'Polygon'],
          slot: 'middle',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.25,
          },
        } as any);

        map.addLayer({
          id: 'hover-circle-outline',
          type: 'line',
          source: 'hover-circle',
          filter: ['==', ['geometry-type'], 'Polygon'],
          slot: 'middle',
          paint: {
            'line-color': ['get', 'strokeColor'],
            'line-width': 2,
            'line-opacity': 0.9,
          },
        } as any);

        map.addLayer({
          id: 'hover-circle-radius-line',
          type: 'line',
          source: 'hover-circle',
          filter: ['==', ['geometry-type'], 'LineString'],
          slot: 'middle',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1.5,
            'line-dasharray': [2, 2],
            'line-opacity': 0.7,
          },
        } as any);

        map.addLayer({
          id: 'hover-circle-label',
          type: 'symbol',
          source: 'hover-circle',
          filter: ['==', ['geometry-type'], 'LineString'],
          slot: 'top',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'symbol-placement': 'line',
            'text-anchor': 'center',
            'text-offset': [0, -1.5],
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': 'rgba(0,0,0,0.75)',
            'text-halo-width': 1.5,
          },
        } as any);
      } else {
        map.addLayer(
          {
            id: 'hover-circle-fill',
            type: 'fill',
            source: 'hover-circle',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': 0.25,
            },
          },
          'observation-lines'
        );

        map.addLayer(
          {
            id: 'hover-circle-outline',
            type: 'line',
            source: 'hover-circle',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'line-color': ['get', 'strokeColor'],
              'line-width': 2,
              'line-opacity': 0.9,
            },
          },
          'observation-lines'
        );

        map.addLayer(
          {
            id: 'hover-circle-radius-line',
            type: 'line',
            source: 'hover-circle',
            filter: ['==', ['geometry-type'], 'LineString'],
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 1.5,
              'line-dasharray': [2, 2],
              'line-opacity': 0.7,
            },
          },
          'observation-lines'
        );

        map.addLayer({
          id: 'hover-circle-label',
          type: 'symbol',
          source: 'hover-circle',
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'symbol-placement': 'line',
            'text-anchor': 'center',
            'text-offset': [0, -1.5],
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': 'rgba(0,0,0,0.75)',
            'text-halo-width': 1.5,
          },
        });
      }

      // 4. Home Location Sources & Layers
      map.addSource('home-location-point', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: homeLocation.center },
              properties: { title: 'Home' },
            },
          ],
        },
      });

      map.addSource('home-location-circle', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [createCirclePolygon(homeLocation.center, homeLocation.radius)],
        },
      });

      map.addLayer({
        id: 'home-circle-fill',
        type: 'fill',
        source: 'home-location-circle',
        paint: { 'fill-color': '#10b981', 'fill-opacity': 0.15 },
      });

      map.addLayer({
        id: 'home-circle-outline',
        type: 'line',
        source: 'home-location-circle',
        paint: { 'line-color': '#10b981', 'line-width': 2, 'line-opacity': 0.8 },
      });

      map.addLayer({
        id: 'home-dot',
        type: 'circle',
        source: 'home-location-point',
        paint: {
          'circle-radius': 8,
          'circle-color': '#10b981',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'home-marker',
        type: 'symbol',
        source: 'home-location-point',
        layout: {
          'text-field': 'H',
          'text-size': 14,
          'text-anchor': 'center',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#ffffff' },
      });
    },
    []
  );

  const attachHoverHandlers = useCallback((map: MapboxMap) => {
    const handleMouseEnter = (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = 'pointer';

      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const props = feature.properties as Record<string, unknown> | undefined;
      if (!props) return;

      const signal = getNumericProperty(
        props,
        'signal',
        'level',
        'bestlevel',
        'rssi',
        'signalDbm',
        'maxSignal',
        'max_signal'
      );
      const frequency = getNumericProperty(props, 'frequency', 'radio_frequency');
      const coChannelNeighbors = getNumericProperty(props, 'co_channel_neighbors') ?? 0;
      const signalRadius = calculateSignalRange(
        signal,
        frequency,
        map.getZoom(),
        e.lngLat.lat,
        coChannelNeighbors,
        String(props.radio_type || props.type || ''),
        String(props.capabilities || '')
      );
      const bssidColor = macColor(String(props.bssid ?? ''));
      const center: [number, number] = [
        (feature.geometry as any).coordinates[0],
        (feature.geometry as any).coordinates[1],
      ];
      const radiusLabel =
        signalRadius >= 1000
          ? `~${(signalRadius / 1000).toFixed(1)} km`
          : `~${Math.round(signalRadius)} m`;

      const hoverCircleSource = map.getSource('hover-circle') as GeoJSONSource;
      if (hoverCircleSource) {
        const radiusKm = signalRadius / 1000;
        const radiusLng = radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180));
        const radiusLineCoords: [number, number][] = [center, [center[0] + radiusLng, center[1]]];

        hoverCircleSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              ...createCirclePolygon(center, signalRadius),
              properties: { color: bssidColor, strokeColor: bssidColor },
            },
            {
              type: 'Feature' as const,
              geometry: { type: 'LineString' as const, coordinates: radiusLineCoords },
              properties: { label: radiusLabel, color: bssidColor },
            },
          ],
        });
      }
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      const hoverCircleSource = map.getSource('hover-circle') as GeoJSONSource;
      if (hoverCircleSource) {
        hoverCircleSource.setData({ type: 'FeatureCollection', features: [] });
      }
    };

    map.on('mouseenter', 'observation-points', handleMouseEnter);
    map.on('mouseleave', 'observation-points', handleMouseLeave);

    return () => {
      map.off('mouseenter', 'observation-points', handleMouseEnter);
      map.off('mouseleave', 'observation-points', handleMouseLeave);
    };
  }, []);

  return { addBaseSourcesAndLayers, attachHoverHandlers };
};
