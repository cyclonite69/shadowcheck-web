import { useAsyncData } from './useAsyncData';
import { keplerApi } from '../api/keplerApi';
import { logDebug, logError } from '../logging/clientLogger';
import type { NetworkData } from '../components/kepler/types';

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

    const networkData: NetworkData[] = geojson.features
      .filter(
        (f: any) => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length >= 2
      )
      .map((f: any) => ({
        position: f.geometry.coordinates,
        bssid: f.properties.bssid,
        ssid: f.properties.ssid || 'Hidden',
        type: f.properties.type || 'unknown',
        signal: f.properties.signal || f.properties.rssi || -100,
        level: f.properties.level || f.properties.signal || -100,
        encryption: f.properties.encryption || f.properties.security || 'Unknown',
        channel: f.properties.channel,
        frequency: f.properties.frequency,
        security: f.properties.security || 'Unknown',
        manufacturer: f.properties.manufacturer || 'Unknown',
        device_type: f.properties.device_type || f.properties.type || 'unknown',
        capabilities: f.properties.capabilities || f.properties.security || 'Unknown',
        threat_level: f.properties.threat_level || 'none',
        rule_score: f.properties.rule_score || 0,
        ml_score: f.properties.ml_score || 0,
        timestamp: String(f.properties.timestamp || f.properties.time || ''),
        first_seen: f.properties.first_seen,
        last_seen: String(f.properties.last_seen || f.properties.time || ''),
        observation_count: f.properties.obs_count || f.properties.observation_count || 1,
        timespan_days: f.properties.timespan_days,
        distance_from_home: f.properties.distance_from_home,
        max_distance_km: f.properties.max_distance_km,
        unique_days: f.properties.unique_days,
        accuracy: f.properties.accuracy,
        altitude: f.properties.altitude,
      }));

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
