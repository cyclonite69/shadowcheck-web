import type { Map } from 'mapbox-gl';
import { EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';

export const ensureV2Layers = (map: Map, v2FCRef: any) => {
  if (!map.getSource('wigle-v2-points')) {
    map.addSource('wigle-v2-points', {
      type: 'geojson',
      data: v2FCRef.current || EMPTY_FEATURE_COLLECTION,
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 40,
    });
  }

  if (!map.getLayer('wigle-v2-clusters')) {
    map.addLayer({
      id: 'wigle-v2-clusters',
      type: 'circle',
      source: 'wigle-v2-points',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['coalesce', ['feature-state', 'color'], '#3b82f6'],
        'circle-opacity': 0.75,
        'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#0f172a',
      },
    });
  }

  if (!map.getLayer('wigle-v2-cluster-count')) {
    map.addLayer({
      id: 'wigle-v2-cluster-count',
      type: 'symbol',
      source: 'wigle-v2-points',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#0f172a',
      },
    });
  }

  if (!map.getLayer('wigle-v2-unclustered')) {
    map.addLayer({
      id: 'wigle-v2-unclustered',
      type: 'circle',
      source: 'wigle-v2-points',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.8,
        'circle-radius': 3,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': '#0f172a',
      },
    });
  }
};

export const ensureV3Layers = (map: Map, v3FCRef: any) => {
  if (!map.getSource('wigle-v3-points')) {
    map.addSource('wigle-v3-points', {
      type: 'geojson',
      data: v3FCRef.current || EMPTY_FEATURE_COLLECTION,
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 40,
    });
  }

  if (!map.getLayer('wigle-v3-clusters')) {
    map.addLayer({
      id: 'wigle-v3-clusters',
      type: 'circle',
      source: 'wigle-v3-points',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['coalesce', ['feature-state', 'color'], '#8b5cf6'],
        'circle-opacity': 0.75,
        'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#0f172a',
      },
    });
  }

  if (!map.getLayer('wigle-v3-cluster-count')) {
    map.addLayer({
      id: 'wigle-v3-cluster-count',
      type: 'symbol',
      source: 'wigle-v3-points',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#0f172a',
      },
    });
  }

  if (!map.getLayer('wigle-v3-unclustered')) {
    map.addLayer({
      id: 'wigle-v3-unclustered',
      type: 'circle',
      source: 'wigle-v3-points',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.8,
        'circle-radius': 3,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': '#1e1b4b',
      },
    });
  }
};

export const applyLayerVisibility = (map: Map, layers: { v2: boolean; v3: boolean }) => {
  const setVis = (layerId: string, visible: boolean) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
  };

  setVis('wigle-v2-clusters', layers.v2);
  setVis('wigle-v2-cluster-count', layers.v2);
  setVis('wigle-v2-unclustered', layers.v2);
  setVis('wigle-v3-clusters', layers.v3);
  setVis('wigle-v3-cluster-count', layers.v3);
  setVis('wigle-v3-unclustered', layers.v3);
};
