import type { Map, GeoJSONSource } from 'mapbox-gl';
import { EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';

export const FIELD_DATA_SOURCE = 'wigle-field-data';
export const FIELD_DATA_LAYER = 'wigle-field-unclustered';

export const ensureV2Layers = (map: Map, v2FCRef: any, cluster = true) => {
  if (!map.getSource('wigle-v2-points')) {
    map.addSource('wigle-v2-points', {
      type: 'geojson',
      data: v2FCRef.current || EMPTY_FEATURE_COLLECTION,
      cluster,
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

export const ensureV3Layers = (map: Map, v3FCRef: any, cluster = true) => {
  if (!map.getSource('wigle-v3-points')) {
    map.addSource('wigle-v3-points', {
      type: 'geojson',
      data: v3FCRef.current || EMPTY_FEATURE_COLLECTION,
      cluster,
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

/** Update circle-radius on all unclustered point layers. */
export const setPointRadius = (map: Map, radius: number) => {
  [
    'wigle-v2-unclustered',
    'wigle-v3-unclustered',
    'wigle-kml-unclustered',
    FIELD_DATA_LAYER,
  ].forEach((id) => {
    if (map.getLayer(id)) map.setPaintProperty(id, 'circle-radius', radius);
  });
};

/** Remove all v2 layers and source then re-add with the given cluster setting. */
export const resetV2Layers = (map: Map, v2FCRef: any, cluster: boolean) => {
  ['wigle-v2-clusters', 'wigle-v2-cluster-count', 'wigle-v2-unclustered'].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource('wigle-v2-points')) map.removeSource('wigle-v2-points');
  ensureV2Layers(map, v2FCRef, cluster);
};

/** Remove all v3 layers and source then re-add with the given cluster setting. */
export const resetV3Layers = (map: Map, v3FCRef: any, cluster: boolean) => {
  ['wigle-v3-clusters', 'wigle-v3-cluster-count', 'wigle-v3-unclustered'].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource('wigle-v3-points')) map.removeSource('wigle-v3-points');
  ensureV3Layers(map, v3FCRef, cluster);
};

/** Add the field-data GeoJSON source and circle layer (orange, non-clustering). */
export const ensureFieldDataLayer = (map: Map) => {
  if (!map.getSource(FIELD_DATA_SOURCE)) {
    map.addSource(FIELD_DATA_SOURCE, {
      type: 'geojson',
      data: EMPTY_FEATURE_COLLECTION as any,
    });
  }
  if (!map.getLayer(FIELD_DATA_LAYER)) {
    map.addLayer({
      id: FIELD_DATA_LAYER,
      type: 'circle',
      source: FIELD_DATA_SOURCE,
      paint: {
        'circle-color': '#06b6d4',
        'circle-opacity': 0.85,
        'circle-radius': 5,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#0e7490',
      },
    });
  }
};

export const updateFieldDataSource = (map: Map, data: unknown) => {
  const firstFeatureCoords = (data as any)?.features?.[0]?.geometry?.coordinates ?? null;
  console.log('[Field Data] updateFieldDataSource', {
    featureCount: Array.isArray((data as any)?.features) ? (data as any).features.length : 0,
    firstFeatureCoords,
  });
  const src = map.getSource(FIELD_DATA_SOURCE) as GeoJSONSource | undefined;
  if (src) src.setData(data as any);
};

export const removeFieldDataLayer = (map: Map) => {
  if (map.getLayer(FIELD_DATA_LAYER)) map.removeLayer(FIELD_DATA_LAYER);
  if (map.getSource(FIELD_DATA_SOURCE)) map.removeSource(FIELD_DATA_SOURCE);
};

export const applyLayerVisibility = (
  map: Map,
  layers: { v2: boolean; v3: boolean; kml: boolean }
) => {
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
  setVis('wigle-kml-clusters', layers.kml);
  setVis('wigle-kml-cluster-count', layers.kml);
  setVis('wigle-kml-unclustered', layers.kml);
};
