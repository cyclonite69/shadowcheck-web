import { useState, useEffect, useCallback } from 'react';
import { networkApi } from '../api/networkApi';

export interface Observation {
  time: number; // epoch ms
  signal: number;
  lat: number;
  lon: number;
}

interface UseNetworkObservationsReturn {
  observations: Observation[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function normalizeObservation(o: Record<string, unknown>): Observation {
  let parsedTime = 0;
  if (typeof o.time === 'string') {
    parsedTime = parseInt(o.time, 10);
  } else if (typeof o.time === 'number') {
    parsedTime = o.time;
  }

  // Handle seconds vs milliseconds (API uses ms but extra safety)
  if (parsedTime > 0 && parsedTime < 1e12) {
    parsedTime *= 1000;
  }

  return {
    time: parsedTime,
    signal: typeof o.signal === 'string' ? parseInt(o.signal, 10) : ((o.signal as number) ?? -80),
    lat: typeof o.lat === 'string' ? parseFloat(o.lat) : ((o.lat as number) ?? 0),
    lon: typeof o.lon === 'string' ? parseFloat(o.lon) : ((o.lon as number) ?? 0),
  };
}

export function useNetworkObservations(bssid: string): UseNetworkObservationsReturn {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObservations = useCallback(async () => {
    if (!bssid) return;

    try {
      setLoading(true);
      setError(null);
      const data = await networkApi.getNetworkObservations(bssid);
      if (data.error) {
        throw new Error(data.error);
      }

      // Normalize data: API returns strings for some fields, frontend expects numbers
      const rawObs = data.observations || [];
      const normalized: Observation[] = rawObs
        .map((o: Record<string, unknown>): Observation => normalizeObservation(o))
        .filter((o: Observation) => o.time > 0 && !isNaN(o.time));

      setObservations(normalized);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load observations';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [bssid]);

  useEffect(() => {
    fetchObservations();
  }, [fetchObservations]);

  return {
    observations,
    loading,
    error,
    refetch: fetchObservations,
  };
}
