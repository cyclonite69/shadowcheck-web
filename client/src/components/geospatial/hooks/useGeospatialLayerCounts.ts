import { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';
import type { GeospatialLayerControlKey } from '../layers/layerCatalog';

export type LayerCountsMap = Record<GeospatialLayerControlKey, number | null>;

interface LayerCountsResponse {
  success: boolean;
  timestamp: string;
  cached: boolean;
  counts: Record<GeospatialLayerControlKey, number>;
}

export interface UseGeospatialLayerCountsResult {
  counts: LayerCountsMap;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const INITIAL_COUNTS: LayerCountsMap = {
  home: null,
  wigleV2: null,
  wigleV3: null,
  wigleKml: null,
  fieldObservations: null,
  fieldOffices: null,
  residentAgencies: null,
  courthouses: null,
  alpr: null,
  shotspotterZones: null,
  shotspotterSensors: null,
};

/**
 * Hook to fetch and track authoritative record counts for all 11 Geospatial layers.
 * Gracefully returns null for counts while loading or on error.
 */
export function useGeospatialLayerCounts(): UseGeospatialLayerCountsResult {
  const [counts, setCounts] = useState<LayerCountsMap>(INITIAL_COUNTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<LayerCountsResponse>('/geospatial/layer-counts');
      if (res?.success && res.counts) {
        setCounts(res.counts);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch layer counts';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  return {
    counts,
    loading,
    error,
    refresh: fetchCounts,
  };
}
