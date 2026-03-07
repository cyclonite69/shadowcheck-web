import { useAsyncData } from './useAsyncData';
import { keplerApi } from '../api/keplerApi';
import { logDebug, logError } from '../logging/clientLogger';
import type { NetworkData } from '../components/kepler/types';
import { mapKeplerGeoJsonToNetworkData } from '../utils/keplerDataTransformation';

interface KeplerResult {
  networkData: NetworkData[];
  mapboxToken: string;
  actualCounts: { observations: number; networks: number } | null;
}

export const useKepler = (adaptedFilters: any, datasetType: 'observations' | 'networks') => {
  const {
    data,
    loading,
    error: fetchError,
  } = useAsyncData<KeplerResult>(async () => {
    logDebug(`[Kepler] loadData called, type: ${datasetType}`);
    logDebug(`[Kepler] Fetching data with filters`);

    const [tokenData, geojson] = await Promise.all([
      keplerApi.getMapboxToken(),
      datasetType === 'observations'
        ? keplerApi.getObservations(adaptedFilters)
        : keplerApi.getNetworks(adaptedFilters),
    ]);

    logDebug(`[Kepler] Data received, features: ${geojson.features?.length || 0}`);

    if (!tokenData?.token) {
      throw new Error('Mapbox token missing. Set it in Admin.');
    }
    if (geojson.error) throw new Error(`API Error: ${geojson.error}`);
    if (!geojson.features || !Array.isArray(geojson.features))
      throw new Error(`Invalid data format`);
    if (geojson.features.length === 0) throw new Error('No network data found');

    const networkData: NetworkData[] = mapKeplerGeoJsonToNetworkData(geojson);

    return {
      networkData,
      mapboxToken: tokenData.token,
      actualCounts: {
        observations: geojson.actualCounts?.observations || networkData.length,
        networks: geojson.actualCounts?.networks || networkData.length,
      },
    };
  }, [adaptedFilters, datasetType]);

  if (fetchError) {
    logError('[Kepler] Load error', fetchError);
  }

  return {
    loading,
    error: fetchError?.message ?? '',
    networkData: data?.networkData ?? [],
    mapboxToken: data?.mapboxToken ?? '',
    actualCounts: data?.actualCounts ?? null,
  };
};
