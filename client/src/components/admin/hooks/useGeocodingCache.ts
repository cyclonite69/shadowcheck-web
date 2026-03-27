import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import type {
  GeocodingDaemonConfig,
  GeocodingDaemonStatus,
  GeocodingProviderProbeResult,
  GeocodingRunResult,
  GeocodingStats,
} from '../types/admin.types';

type GeocodingRunOptions = {
  provider: 'mapbox' | 'nominatim' | 'overpass' | 'opencage' | 'geocodio' | 'locationiq';
  mode: 'address-only' | 'poi-only' | 'both';
  limit: number;
  precision: number;
  perMinute: number;
  permanent?: boolean;
};

type GeocodingDaemonOptions = GeocodingDaemonConfig;

export const useGeocodingCache = (precision = 5) => {
  const [stats, setStats] = useState<GeocodingStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [lastResult, setLastResult] = useState<GeocodingRunResult | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<GeocodingProviderProbeResult | null>(null);
  const [daemon, setDaemon] = useState<GeocodingDaemonStatus | null>(null);

  const refreshStats = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await adminApi.getGeocodingStats(String(precision));
      setStats(data.stats);
      setLastResult(data.stats?.last_run?.result || null);
      setDaemon(data.stats?.daemon || null);
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
        const data = await adminApi.runGeocoding(options);
        setActionMessage(data.message || 'Geocoding run started in background');
        setLastResult(data.result || null);
        await refreshStats();
        window.setTimeout(() => {
          void refreshStats();
        }, 5000);
        window.setTimeout(() => {
          void refreshStats();
        }, 15000);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Geocoding run failed';
        setError(errorMessage);
      } finally {
        setActionLoading(false);
      }
    },
    [refreshStats]
  );

  const testProvider = useCallback(async (options: GeocodingRunOptions) => {
    setProbeLoading(true);
    setError('');
    try {
      const data = await adminApi.testGeocodingProvider(options);
      setProbeResult(data.result || null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Provider test failed';
      setError(errorMessage);
    } finally {
      setProbeLoading(false);
    }
  }, []);

  const startDaemon = useCallback(
    async (options: GeocodingDaemonOptions) => {
      setActionLoading(true);
      setActionMessage('');
      setError('');
      try {
        const data = await adminApi.startGeocodingDaemon(options);
        setDaemon(data.daemon || null);
        setActionMessage(
          data.started === false
            ? 'Geocoding daemon was already running; configuration refreshed.'
            : 'Geocoding daemon started.'
        );
        await refreshStats();
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to start geocoding daemon';
        setError(errorMessage);
      } finally {
        setActionLoading(false);
      }
    },
    [refreshStats]
  );

  const stopDaemon = useCallback(async () => {
    setActionLoading(true);
    setActionMessage('');
    setError('');
    try {
      const data = await adminApi.stopGeocodingDaemon();
      setDaemon(data.daemon || null);
      setActionMessage(
        data.stopped ? 'Geocoding daemon stop requested.' : 'Geocoding daemon is already stopped.'
      );
      await refreshStats();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop geocoding daemon';
      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  }, [refreshStats]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (!daemon?.running) return;
    const intervalId = window.setInterval(() => {
      void refreshStats();
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [daemon?.running, refreshStats]);

  return {
    stats,
    daemon,
    isLoading,
    actionLoading,
    error,
    actionMessage,
    lastResult,
    probeLoading,
    probeResult,
    refreshStats,
    runGeocoding,
    testProvider,
    startDaemon,
    stopDaemon,
  };
};
