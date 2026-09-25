import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { wigleApi } from '../../api/wigleApi';
import { buildFilteredRequestParams } from '../../utils/filteredRequestParams';
import { EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';
import { ensureFieldDataLayer, removeFieldDataLayer, updateFieldDataSource } from './mapLayers';
import { runWhenStyleReady } from './mapLifecycle';

interface UseWigleFieldDataProps {
  mapRef: MutableRefObject<Map | null>;
  mapReady: boolean;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  showFieldData: boolean;
  clusteringEnabled: boolean;
  fieldDataFCRef: MutableRefObject<any>;
}

export const useWigleFieldData = ({
  mapRef,
  mapReady,
  mapboxRef,
  showFieldData,
  clusteringEnabled,
  fieldDataFCRef,
}: UseWigleFieldDataProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureCount, setFeatureCount] = useState(0);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  const showFieldDataRef = useRef(showFieldData);

  showFieldDataRef.current = showFieldData;

  const syncFieldData = useCallback(
    (map: Map, features: object[]) => {
      const fc = { type: 'FeatureCollection', features };
      fieldDataFCRef.current = fc;
      setFeatureCount(features.length);

      return runWhenStyleReady(map, 'field-data', () => {
        if (!showFieldDataRef.current) {
          return;
        }
        ensureFieldDataLayer(map, fieldDataFCRef, clusteringEnabled);
        const latestFc = fieldDataFCRef.current;
        if (Array.isArray((latestFc as any)?.features)) {
          updateFieldDataSource(map, latestFc);
        }
      });
    },
    [clusteringEnabled, fieldDataFCRef]
  );

  const fetchFieldData = useCallback(async () => {
    void mapboxRef;

    const map = mapRef.current;
    if (!map || !mapReady || !showFieldDataRef.current) {
      return;
    }

    if (loadingRef.current) {
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const bounds = map.getBounds();
      if (!bounds) {
        syncFieldData(map, []);
        return;
      }
      const filters = {
        boundingBox: {
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        },
      };
      const enabled = { boundingBox: true };
      const limit = 50000;
      let offset = 0;
      const rows: any[] = [];

      while (showFieldDataRef.current) {
        const params = buildFilteredRequestParams({
          payload: { filters, enabled },
          limit,
          offset,
          includeTotal: true,
        });
        const result = await wigleApi.getLocalObservations(params);
        if (currentRequestId !== requestIdRef.current || !showFieldDataRef.current) {
          return;
        }

        const pageRows = Array.isArray(result?.data) ? result.data : [];
        rows.push(...pageRows);

        if (result?.truncated !== true || pageRows.length === 0) {
          break;
        }

        offset += limit;
      }

      const features: object[] = rows
        .filter(
          (obs: any) =>
            obs.lat !== null && obs.lat !== undefined && obs.lon !== null && obs.lon !== undefined
        )
        .map((obs: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [obs.lon, obs.lat] },
          properties: {
            bssid: obs.bssid ?? null,
            signal: obs.signal ?? obs.level ?? null,
            time: obs.time ?? null,
          },
        }));

      if (currentRequestId === requestIdRef.current && showFieldDataRef.current) {
        syncFieldData(map, features);
      }
    } catch (err: any) {
      if (currentRequestId === requestIdRef.current) {
        setError(err.message || 'Failed to load field data');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [mapReady, mapRef, mapboxRef, syncFieldData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    if (!showFieldData) {
      requestIdRef.current += 1;
      loadingRef.current = false;
      setLoading(false);
      setError(null);
      setFeatureCount(0);
      fieldDataFCRef.current = EMPTY_FEATURE_COLLECTION;
      if (map.isStyleLoaded()) {
        removeFieldDataLayer(map);
      }
      return;
    }

    void fetchFieldData();
    const handleMoveEnd = () => {
      void fetchFieldData();
    };
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [fetchFieldData, fieldDataFCRef, mapReady, mapRef, showFieldData]);

  return { loading, error, featureCount, fetchFieldData };
};
