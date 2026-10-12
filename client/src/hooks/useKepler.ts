import { useEffect } from 'react';
import { useAsyncData } from './useAsyncData';
import { keplerApi } from '../api/keplerApi';
import { logDebug, logError } from '../logging/clientLogger';
import type { NetworkData } from '../components/kepler/types';
import { mapKeplerGeoJsonToNetworkData } from '../utils/keplerDataTransformation';
import { mapKeplerArrowToNetworkData } from '../utils/keplerArrowDataTransformation';
import type { KeplerFilters } from '../api/keplerApi';

interface KeplerResult {
  networkData: NetworkData[];
  mapboxToken: string;
  actualCounts: { observations: number; networks: number } | null;
  timeBounds: { min: number; max: number } | null;
}

export const useKepler = (
  adaptedFilters: KeplerFilters,
  datasetType: 'observations' | 'networks'
) => {
  const {
    data,
    loading,
    error: fetchError,
  } = useAsyncData<KeplerResult>(
    async (signal) => {
      logDebug(`[Kepler] loadData called, type: ${datasetType}`);
      logDebug('[Kepler] Fetching data with filters');

      const [tokenData, data] = await Promise.all([
        keplerApi.getMapboxToken(signal),
        datasetType === 'observations'
          ? keplerApi.getObservationsArrow(adaptedFilters, signal)
          : keplerApi.getNetworks(adaptedFilters, signal),
      ]);

      if (!tokenData?.token) {
        throw new Error('Mapbox token missing. Set it in Admin.');
      }

      if (datasetType === 'observations') {
        const arrowData = mapKeplerArrowToNetworkData(data as ArrayBuffer);
        logDebug(`[Kepler] Arrow observations received: ${arrowData.networkData.length}`);
        return {
          networkData: arrowData.networkData,
          mapboxToken: tokenData.token,
          actualCounts: {
            observations: arrowData.networkData.length,
            networks: arrowData.uniqueNetworks,
          },
          timeBounds: arrowData.timeBounds,
        };
      }

      const geojson = data as Awaited<ReturnType<typeof keplerApi.getNetworks>>;
      logDebug(`[Kepler] Data received, features: ${geojson.features?.length || 0}`);
      if (geojson.error) {
        throw new Error(`API Error: ${geojson.error}`);
      }
      if (!geojson.features || !Array.isArray(geojson.features)) {
        throw new Error('Invalid data format');
      }
      const networkData: NetworkData[] = mapKeplerGeoJsonToNetworkData(geojson);

      return {
        networkData,
        mapboxToken: tokenData.token,
        actualCounts: {
          observations: geojson.actualCounts?.observations || networkData.length,
          networks: geojson.actualCounts?.networks || networkData.length,
        },
        timeBounds: null,
      };
    },
    [adaptedFilters, datasetType]
  );

  useEffect(() => {
    if (fetchError) {
      logError('[Kepler] Load error', fetchError);
    }
  }, [fetchError]);

  return {
    loading,
    error: fetchError?.message ?? '',
    networkData: data?.networkData ?? [],
    mapboxToken: data?.mapboxToken ?? '',
    actualCounts: data?.actualCounts ?? null,
    timeBounds: data?.timeBounds ?? null,
  };
};
