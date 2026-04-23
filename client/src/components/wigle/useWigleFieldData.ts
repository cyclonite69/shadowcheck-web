import { useEffect, type MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { wigleApi } from '../../api/wigleApi';
import { buildFilteredRequestParams } from '../../utils/filteredRequestParams';
import { EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';
import { ensureFieldDataLayer, removeFieldDataLayer, updateFieldDataSource } from './mapLayers';

interface UseWigleFieldDataProps {
  mapRef: MutableRefObject<Map | null>;
  mapReady: boolean;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  showFieldData: boolean;
  fieldDataFCRef: MutableRefObject<any>;
}

export const useWigleFieldData = ({
  mapRef,
  mapReady,
  mapboxRef,
  showFieldData,
  fieldDataFCRef,
}: UseWigleFieldDataProps) => {
  useEffect(() => {
    void mapboxRef;

    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!showFieldData) {
      fieldDataFCRef.current = EMPTY_FEATURE_COLLECTION;
      if (map.isStyleLoaded()) removeFieldDataLayer(map);
      return;
    }

    let cancelled = false;
    let requestId = 0;

    const syncFieldData = (features: object[]) => {
      const fc = { type: 'FeatureCollection', features };
      fieldDataFCRef.current = fc;

      if (!map.isStyleLoaded()) return;
      console.log('[Field Data] ensuring layer');
      ensureFieldDataLayer(map);
      console.log('[Field Data] updating source', { featureCount: features.length });
      updateFieldDataSource(map, fc);
    };

    const loadFieldData = async () => {
      const currentRequestId = ++requestId;
      const bounds = map.getBounds();
      if (!bounds) {
        syncFieldData([]);
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
      const limit = 20000;
      let offset = 0;
      const rows: any[] = [];

      console.log('[Field Data] fetching viewport observations', {
        west: filters.boundingBox.west,
        south: filters.boundingBox.south,
        east: filters.boundingBox.east,
        north: filters.boundingBox.north,
      });

      while (!cancelled) {
        const params = buildFilteredRequestParams({
          payload: { filters, enabled },
          limit,
          offset,
          includeTotal: true,
        });
        const result = await wigleApi.getLocalObservations(params);
        if (cancelled || currentRequestId !== requestId) return;

        const pageRows = Array.isArray(result?.data) ? result.data : [];
        rows.push(...pageRows);

        if (result?.truncated !== true || pageRows.length === 0) {
          break;
        }

        offset += limit;
      }

      const features: object[] = rows
        .filter((obs: any) => obs.lat != null && obs.lon != null)
        .map((obs: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [obs.lon, obs.lat] },
          properties: {
            bssid: obs.bssid ?? null,
            signal: obs.signal ?? obs.level ?? null,
            time: obs.time ?? null,
          },
        }));

      console.log('[Field Data] fetched observations', {
        observationCount: rows.length,
        featureCount: features.length,
      });
      syncFieldData(features);
    };

    void loadFieldData();
    const handleMoveEnd = () => {
      void loadFieldData();
    };
    map.on('moveend', handleMoveEnd);

    return () => {
      cancelled = true;
      map.off('moveend', handleMoveEnd);
    };
  }, [fieldDataFCRef, mapReady, mapRef, mapboxRef, showFieldData]);
};
