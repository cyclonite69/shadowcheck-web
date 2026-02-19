import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import type { GeocodingRunResult, GeocodingStats } from '../types/admin.types';

type GeocodingRunOptions = {
  provider: 'mapbox' | 'nominatim' | 'overpass' | 'opencage' | 'locationiq';
  mode: 'address-only' | 'poi-only' | 'both';
  limit: number;
  precision: number;
  perMinute: number;
  permanent?: boolean;
};

export const useGeocodingCache = (precision = 5) => {
  const [stats, setStats] = useState<GeocodingStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [lastResult, setLastResult] = useState<GeocodingRunResult | null>(null);

  const refreshStats = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await adminApi.getGeocodingStats(String(precision));
      setStats(data.stats);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load geocoding stats';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [precision]);

  const runGeocoding = useCallback(
    async (options: GeocodingRunOptions) => {
      setActionLoading(true);
      setActionMessage('');
      setError('');
      try {
        const data = await adminApi.runGeocoding(String(precision), options.limit);
        setActionMessage(data.message || 'Geocoding run completed');
        setLastResult(data.result || null);
        await refreshStats();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Geocoding run failed';
        setError(errorMessage);
      } finally {
        setActionLoading(false);
      }
    },
    [refreshStats]
  );

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return {
    stats,
    isLoading,
    actionLoading,
    error,
    actionMessage,
    lastResult,
    refreshStats,
    runGeocoding,
  };
};
