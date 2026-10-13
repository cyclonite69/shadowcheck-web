import type { Map, GeoJSONSource } from 'mapbox-gl';
import { EMPTY_FEATURE_COLLECTION } from '../../../utils/wigle';

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
    if (map.getLayer(id)) {
      map.setPaintProperty(id, 'circle-radius', radius);
    }
  });
};

/** Remove all v2 layers and source then re-add with the given cluster setting. */
export const resetV2Layers = (map: Map, v2FCRef: any, cluster: boolean) => {
  ['wigle-v2-clusters', 'wigle-v2-cluster-count', 'wigle-v2-unclustered'].forEach((id) => {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  if (map.getSource('wigle-v2-points')) {
    map.removeSource('wigle-v2-points');
  }
  ensureV2Layers(map, v2FCRef, cluster);
};

/** Remove all v3 layers and source then re-add with the given cluster setting. */
export const resetV3Layers = (map: Map, v3FCRef: any, cluster: boolean) => {
  ['wigle-v3-clusters', 'wigle-v3-cluster-count', 'wigle-v3-unclustered'].forEach((id) => {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  if (map.getSource('wigle-v3-points')) {
    map.removeSource('wigle-v3-points');
  }
  ensureV3Layers(map, v3FCRef, cluster);
};

/** Add the field-data GeoJSON source and cluster/unclustered layers. */
export const ensureFieldDataLayer = (map: Map, fieldDataFCRef: any, cluster = true) => {
  if (!map.getSource(FIELD_DATA_SOURCE)) {
    map.addSource(FIELD_DATA_SOURCE, {
      type: 'geojson',
      data: (fieldDataFCRef?.current || EMPTY_FEATURE_COLLECTION) as any,
      cluster,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });
  }
  if (!map.getLayer('wigle-field-clusters')) {
    map.addLayer({
      id: 'wigle-field-clusters',
      type: 'circle',
      source: FIELD_DATA_SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#06b6d4',
        'circle-opacity': 0.75,
        'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#0f172a',
      },
    });
  }
  if (!map.getLayer('wigle-field-cluster-count')) {
    map.addLayer({
      id: 'wigle-field-cluster-count',
      type: 'symbol',
      source: FIELD_DATA_SOURCE,
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
  if (!map.getLayer(FIELD_DATA_LAYER)) {
    map.addLayer({
      id: FIELD_DATA_LAYER,
      type: 'circle',
      source: FIELD_DATA_SOURCE,
      filter: ['!', ['has', 'point_count']],
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

/** Add the unpaginated field-observation vector-tile source and point layer. */
export const ensureFieldDataMvtLayer = (map: Map) => {
  if (!map.getSource('wigle-field-data-mvt')) {
    const tileBase = typeof window !== 'undefined' ? window.location.origin : '';
    map.addSource('wigle-field-data-mvt', {
      type: 'vector',
      tiles: [`${tileBase}/api/wigle/tiles/observations/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom: 22,
    });
  }

  if (!map.getLayer('wigle-field-mvt-points')) {
    map.addLayer({
      id: 'wigle-field-mvt-points',
      type: 'circle',
      source: 'wigle-field-data-mvt',
      'source-layer': 'observations',
      paint: {
        'circle-color': '#06b6d4',
        'circle-radius': 3.5,
        'circle-opacity': 0.85,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': '#083344',
      },
    });
  }
};

export const updateFieldDataSource = (map: Map, data: unknown) => {
  const src = map.getSource(FIELD_DATA_SOURCE) as GeoJSONSource | undefined;
  if (!src) {
    return;
  }
  src.setData(data as any);
};

/** Add the experimental ALPR vector-tile source and circle layer. */
export const ensureAlprMvtLayer = (map: Map) => {
  if (!map.getSource('alpr-cameras-mvt')) {
    const tileBase = typeof window !== 'undefined' ? window.location.origin : '';
    map.addSource('alpr-cameras-mvt', {
      type: 'vector',
      tiles: [`${tileBase}/api/wigle/tiles/alpr/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom: 22,
    });
  }

  if (!map.getLayer('alpr-cameras-mvt-pulse')) {
    map.addLayer({
      id: 'alpr-cameras-mvt-pulse',
      type: 'circle',
      source: 'alpr-cameras-mvt',
      'source-layer': 'alpr_cameras',
      paint: {
        'circle-color': '#d946ef',
        'circle-radius': 4,
        'circle-opacity': 0.8,
        'circle-pitch-alignment': 'map',
      },
    });
  }

  if (!map.getLayer('alpr-cameras-mvt-points')) {
    map.addLayer({
      id: 'alpr-cameras-mvt-points',
      type: 'circle',
      source: 'alpr-cameras-mvt',
      'source-layer': 'alpr_cameras',
      paint: {
        'circle-color': '#d946ef',
        'circle-opacity': 0.95,
        'circle-radius': 3.5,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#2e0238',
      },
    });
  }
};

const GEOSPATIAL_TILE_BASE =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/geospatial/tiles`
    : '/api/geospatial/tiles';

const ensureGeospatialVectorSource = (map: Map, sourceId: string, layer: string) => {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'vector',
      tiles: [`${GEOSPATIAL_TILE_BASE}/${layer}/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom: 22,
    });
  }
};

const ensureGeospatialCircleLayer = (
  map: Map,
  sourceId: string,
  sourceLayer: string,
  layerId: string,
  color: string,
  radius = 4,
  strokeWidth = 0.75,
  strokeColor = '#0f172a'
) => {
  if (!map.getLayer(layerId)) {
    map.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      'source-layer': sourceLayer,
      layout: { visibility: 'none' },
      paint: {
        'circle-color': color,
        'circle-radius': radius,
        'circle-opacity': 0.85,
        'circle-stroke-width': strokeWidth,
        'circle-stroke-color': strokeColor,
      },
    });
  }
};

/** Add field observations from the authenticated vector-tile endpoint. */
export const ensureGeospatialFieldDataMvtLayer = (map: Map) => {
  const sourceId = 'geospatial-field-mvt';
  ensureGeospatialVectorSource(map, sourceId, 'observations');
  ensureGeospatialCircleLayer(
    map,
    sourceId,
    'observations',
    'geospatial-field-mvt-points',
    '#06b6d4',
    3.5
  );
};

/** Add ALPR cameras from the authenticated vector-tile endpoint. */
export const ensureGeospatialAlprMvtLayer = (map: Map) => {
  const sourceId = 'geospatial-alpr-mvt';
  ensureGeospatialVectorSource(map, sourceId, 'alpr');
  if (!map.getLayer('geospatial-alpr-mvt-pulse')) {
    map.addLayer({
      id: 'geospatial-alpr-mvt-pulse',
      type: 'circle',
      source: sourceId,
      'source-layer': 'alpr_cameras',
      layout: { visibility: 'none' },
      paint: {
        'circle-color': '#d946ef',
        'circle-radius': 4,
        'circle-opacity': 0.8,
        'circle-pitch-alignment': 'map',
      },
    });
  }
  ensureGeospatialCircleLayer(
    map,
    sourceId,
    'alpr_cameras',
    'geospatial-alpr-mvt-points',
    '#d946ef',
    4,
    1.5,
    '#ffffff'
  );
};

/** Add KML observations from the authenticated vector-tile endpoint. */
export const ensureKmlMvtLayer = (map: Map) => {
  const sourceId = 'geospatial-kml-mvt';
  ensureGeospatialVectorSource(map, sourceId, 'kml');
  ensureGeospatialCircleLayer(map, sourceId, 'kml_points', 'geospatial-kml-mvt-points', '#eab308');
};

/** Add WiGLE v2 networks from the authenticated vector-tile endpoint. */
export const ensureWigleV2MvtLayer = (map: Map) => {
  const sourceId = 'geospatial-wigle-v2-mvt';
  ensureGeospatialVectorSource(map, sourceId, 'wigle-v2');
  ensureGeospatialCircleLayer(
    map,
    sourceId,
    'wigle_v2_networks',
    'geospatial-wigle-v2-mvt-points',
    '#3b82f6'
  );
};

/** Add WiGLE v3 observations from the authenticated vector-tile endpoint. */
export const ensureWigleV3MvtLayer = (map: Map) => {
  const sourceId = 'geospatial-wigle-v3-mvt';
  ensureGeospatialVectorSource(map, sourceId, 'wigle-v3');
  ensureGeospatialCircleLayer(
    map,
    sourceId,
    'wigle_v3_observations',
    'geospatial-wigle-v3-mvt-points',
    '#8b5cf6'
  );
};

/** Add DeFlock cameras from the authenticated vector-tile endpoint. */
export const ensureDeflockMvtLayer = (map: Map) => {
  const sourceId = 'geospatial-deflock-mvt';
  ensureGeospatialVectorSource(map, sourceId, 'deflock');
  ensureGeospatialCircleLayer(
    map,
    sourceId,
    'deflock_cameras',
    'geospatial-deflock-mvt-points',
    '#ff6a00'
  );
};

/** Add ShotSpotter zones and sensors while retaining their source tables and data pipeline. */
export const ensureShotspotterMvtLayers = (map: Map) => {
  const sourceId = 'geospatial-shotspotter-mvt';
  ensureGeospatialVectorSource(map, sourceId, 'shotspotter');

  if (!map.getLayer('geospatial-shotspotter-zone-fill')) {
    map.addLayer({
      id: 'geospatial-shotspotter-zone-fill',
      type: 'fill',
      source: sourceId,
      'source-layer': 'shotspotter_zones',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': '#7f1d1d',
        'fill-opacity': 0.18,
      },
    });
  }
  if (!map.getLayer('geospatial-shotspotter-zone-line')) {
    map.addLayer({
      id: 'geospatial-shotspotter-zone-line',
      type: 'line',
      source: sourceId,
      'source-layer': 'shotspotter_zones',
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#7f1d1d',
        'line-width': 2,
      },
    });
  }
  ensureGeospatialCircleLayer(
    map,
    sourceId,
    'shotspotter_sensors',
    'geospatial-shotspotter-sensor-points',
    '#fb7185',
    3.5
  );
};

const activeAlprMvtPulses = new WeakMap<Map, () => void>();
const ALPR_MVT_PULSE_DURATION_MS = 1500;
const ALPR_MVT_PULSE_MIN_RADIUS = 4;
const ALPR_MVT_PULSE_MAX_RADIUS = 18;
const ALPR_MVT_PULSE_MAX_OPACITY = 0.8;

/** Animate the MVT ALPR pulse layer while it exists and is visible. */
export const startAlprMvtPulse = (map: Map): (() => void) => {
  const activeCleanup = activeAlprMvtPulses.get(map);
  if (activeCleanup) {
    return activeCleanup;
  }
  if (typeof window === 'undefined') {
    return () => {};
  }

  let animationFrameId: number | null = null;
  let cancelled = false;

  const cleanup = () => {
    cancelled = true;
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    activeAlprMvtPulses.delete(map);
  };

  const animate = () => {
    animationFrameId = null;
    const pulseLayerIds = ['alpr-cameras-mvt-pulse', 'geospatial-alpr-mvt-pulse'];
    const visiblePulseLayerIds = pulseLayerIds.filter(
      (layerId) => map.getLayer(layerId) && map.getLayoutProperty(layerId, 'visibility') !== 'none'
    );
    if (cancelled || visiblePulseLayerIds.length === 0) {
      activeAlprMvtPulses.delete(map);
      return;
    }

    const progress = (Date.now() % ALPR_MVT_PULSE_DURATION_MS) / ALPR_MVT_PULSE_DURATION_MS;
    const radius =
      ALPR_MVT_PULSE_MIN_RADIUS +
      progress * (ALPR_MVT_PULSE_MAX_RADIUS - ALPR_MVT_PULSE_MIN_RADIUS);
    const opacity = ALPR_MVT_PULSE_MAX_OPACITY * (1 - progress);
    visiblePulseLayerIds.forEach((layerId) => {
      map.setPaintProperty(layerId, 'circle-radius', radius);
      map.setPaintProperty(layerId, 'circle-opacity', opacity);
    });
    animationFrameId = window.requestAnimationFrame(animate);
  };

  activeAlprMvtPulses.set(map, cleanup);
  if (
    ['alpr-cameras-mvt-pulse', 'geospatial-alpr-mvt-pulse'].some(
      (layerId) => map.getLayer(layerId) && map.getLayoutProperty(layerId, 'visibility') !== 'none'
    )
  ) {
    animationFrameId = window.requestAnimationFrame(animate);
  } else {
    activeAlprMvtPulses.delete(map);
  }

  return cleanup;
};

export const removeFieldDataLayer = (map: Map) => {
  ['wigle-field-clusters', 'wigle-field-cluster-count', FIELD_DATA_LAYER].forEach((id) => {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  if (map.getSource(FIELD_DATA_SOURCE)) {
    map.removeSource(FIELD_DATA_SOURCE);
  }
};

/** Remove all field-data layers and source then re-add with the given cluster setting. */
export const resetFieldDataLayers = (map: Map, fieldDataFCRef: any, cluster: boolean) => {
  ['wigle-field-clusters', 'wigle-field-cluster-count', FIELD_DATA_LAYER].forEach((id) => {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
  if (map.getSource(FIELD_DATA_SOURCE)) {
    map.removeSource(FIELD_DATA_SOURCE);
  }
  ensureFieldDataLayer(map, fieldDataFCRef, cluster);
};

export const applyLayerVisibility = (
  map: Map,
  layers: {
    v2: boolean;
    v3: boolean;
    kml: boolean;
    showFieldData?: boolean;
    mvtAlprCameras?: boolean;
  }
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
  setVis('wigle-field-mvt-points', layers.showFieldData ?? false);
  setVis('alpr-cameras-mvt-pulse', layers.mvtAlprCameras ?? false);
  setVis('alpr-cameras-mvt-points', layers.mvtAlprCameras ?? false);
};

export interface GeospatialMvtLayerVisibility {
  wigleV2: boolean;
  wigleV3: boolean;
  kml: boolean;
  fieldObservations: boolean;
  alpr: boolean;
  shotspotterZones: boolean;
  shotspotterSensors: boolean;
}

/** Apply the Geospatial Explorer's persistent menu toggles to MVT layers. */
export const applyGeospatialLayerVisibility = (map: Map, layers: GeospatialMvtLayerVisibility) => {
  const setVis = (layerId: string, visible: boolean) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
  };

  setVis('geospatial-field-mvt-points', layers.fieldObservations);
  setVis('geospatial-wigle-v2-mvt-points', layers.wigleV2);
  setVis('geospatial-wigle-v3-mvt-points', layers.wigleV3);
  setVis('geospatial-kml-mvt-points', layers.kml);
  setVis('geospatial-alpr-mvt-pulse', layers.alpr);
  setVis('geospatial-alpr-mvt-points', layers.alpr);
  setVis('geospatial-shotspotter-zone-fill', layers.shotspotterZones);
  setVis('geospatial-shotspotter-zone-line', layers.shotspotterZones);
  setVis('geospatial-shotspotter-sensor-points', layers.shotspotterSensors);

  if (layers.alpr) {
    startAlprMvtPulse(map);
  } else {
    activeAlprMvtPulses.get(map)?.();
  }
};
