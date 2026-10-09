import { useEffect, useMemo, useRef } from 'react';
import type { GeoJSONSource, Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { useAdaptedFilters } from '../../../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../../../utils/filterCapabilities';
import { DEFAULT_LIMIT, EMPTY_FEATURE_COLLECTION, rowsToGeoJSON } from '../../../utils/wigle';
import { useWigleData } from './useWigleData';
import { useWigleKmlData } from './useWigleKmlData';
import { kmlRowsToGeoJSON, ensureKmlLayers } from './kmlLayers';
import {
  applyLayerVisibility,
  ensureV2Layers,
  ensureV3Layers,
  ensureFieldDataLayer,
  updateFieldDataSource,
  FIELD_DATA_LAYER,
  FIELD_DATA_SOURCE,
} from './mapLayers';
import { attachClickHandlers } from './mapHandlers';
import { updateAllClusterColors } from './clusterColors';
import { useWigleFieldData } from './useWigleFieldData';
import { useWigleAutoFetch } from './useWigleAutoFetch';

interface GeospatialWigleLayerVisibility {
  v2: boolean;
  v3: boolean;
  kml: boolean;
  fieldObservations: boolean;
}

interface UseGeospatialWigleResultLayersProps {
  mapRef: React.MutableRefObject<Map | null>;
  mapboxRef: React.MutableRefObject<typeof mapboxglType | null>;
  mapReady: boolean;
  visible: GeospatialWigleLayerVisibility;
}

export function useGeospatialWigleResultLayers({
  mapRef,
  mapboxRef,
  mapReady,
  visible,
}: UseGeospatialWigleResultLayersProps) {
  const adaptedFilters = useAdaptedFilters(getPageCapabilities('geospatial'));
  const {
    v2Loading,
    v3Loading,
    error: dataError,
    v2Rows,
    v3Rows,
    fetchPoints,
  } = useWigleData({
    limit: DEFAULT_LIMIT,
    offset: 0,
    typeFilter: '',
    adaptedFilters,
    v2Enabled: visible.v2,
    v3Enabled: visible.v3,
  });
  const {
    loading: kmlLoading,
    rows: kmlRows,
    error: kmlError,
    fetchPoints: fetchKmlPoints,
  } = useWigleKmlData({
    limit: DEFAULT_LIMIT,
    offset: 0,
    adaptedFilters,
    enabled: visible.kml,
  });

  const v2FeatureCollection = useMemo(() => rowsToGeoJSON(v2Rows), [v2Rows]);
  const v3FeatureCollection = useMemo(() => rowsToGeoJSON(v3Rows), [v3Rows]);
  const kmlFeatureCollection = useMemo(() => kmlRowsToGeoJSON(kmlRows), [kmlRows]);
  const fieldDataFCRef = useRef<any>(EMPTY_FEATURE_COLLECTION);
  const wigleHandlersAttachedRef = useRef(false);
  const clusterColorCache = useRef<Record<string, Record<number, string>>>({ v2: {}, v3: {} });

  const {
    loading: fieldDataLoading,
    error: fieldDataError,
    featureCount: fieldObservationCount,
    fetchFieldData,
  } = useWigleFieldData({
    mapRef,
    mapReady,
    mapboxRef,
    showFieldData: visible.fieldObservations,
    clusteringEnabled: true,
    fieldDataFCRef,
  });

  const autoFetchedRef = useRef({ v2: false, v3: false });
  useWigleAutoFetch({
    mapReady,
    layers: {
      v2: visible.v2,
      v3: visible.v3,
      kml: visible.kml,
    },
    v2Rows,
    v3Rows,
    kmlRows,
    v2Loading,
    v3Loading,
    kmlLoading,
    adaptedFilters,
    fetchPoints,
    fetchKmlPoints,
    autoFetchedRef,
  });

  useEffect(() => {
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (!map || !mapReady) {
      return;
    }

    const synchronizeLayers = () => {
      if (!map.getStyle()) {
        return;
      }
      ensureV2Layers(map, { current: v2FeatureCollection }, true);
      ensureV3Layers(map, { current: v3FeatureCollection }, true);
      ensureKmlLayers(map, { current: kmlFeatureCollection }, true);

      const v2Source = map.getSource('wigle-v2-points') as GeoJSONSource | undefined;
      const v3Source = map.getSource('wigle-v3-points') as GeoJSONSource | undefined;
      const kmlSource = map.getSource('wigle-kml-points') as GeoJSONSource | undefined;
      v2Source?.setData(v2FeatureCollection as any);
      v3Source?.setData(v3FeatureCollection as any);
      kmlSource?.setData(kmlFeatureCollection as any);

      if (visible.fieldObservations && fieldDataFCRef.current) {
        ensureFieldDataLayer(map, fieldDataFCRef, true);
        updateFieldDataSource(map, fieldDataFCRef.current);
      }

      applyLayerVisibility(map, {
        v2: visible.v2,
        v3: visible.v3,
        kml: visible.kml,
      });
      ['wigle-field-clusters', 'wigle-field-cluster-count', FIELD_DATA_LAYER].forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', visible.fieldObservations ? 'visible' : 'none');
        }
      });
      if (visible.fieldObservations && map.getSource(FIELD_DATA_SOURCE)) {
        updateFieldDataSource(map, fieldDataFCRef.current);
      }
      if (mapbox && !wigleHandlersAttachedRef.current) {
        attachClickHandlers(map, mapbox, wigleHandlersAttachedRef);
      }
      updateAllClusterColors(map, clusterColorCache);
    };

    if (map.isStyleLoaded()) {
      synchronizeLayers();
    } else {
      map.once('style.load', synchronizeLayers);
    }
    map.on('style.load', synchronizeLayers);
    return () => {
      map.off('style.load', synchronizeLayers);
    };
  }, [
    kmlFeatureCollection,
    mapReady,
    mapRef,
    mapboxRef,
    v2FeatureCollection,
    v3FeatureCollection,
    visible.fieldObservations,
    visible.kml,
    visible.v2,
    visible.v3,
  ]);

  return {
    loading: v2Loading || v3Loading || kmlLoading || fieldDataLoading,
    error: dataError || kmlError || fieldDataError,
    fetchFieldData,
    featureCount:
      v2FeatureCollection.features.length +
      v3FeatureCollection.features.length +
      kmlFeatureCollection.features.length +
      fieldObservationCount,
  };
}
