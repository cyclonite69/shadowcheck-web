import { networkApi } from '../api/networkApi';
import { useAsyncData } from './useAsyncData';

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
  const {
    data,
    loading,
    error: fetchError,
    refetch,
  } = useAsyncData<Observation[]>(async () => {
    if (!bssid) {
      return [];
    }
    const res = await networkApi.getNetworkObservations(bssid);
    if (res.error) {
      throw new Error(res.error);
    }
    // Normalize data: API returns strings for some fields, frontend expects numbers
    return (res.observations || [])
      .map((o: Record<string, unknown>): Observation => normalizeObservation(o))
      .filter((o: Observation) => o.time > 0 && !isNaN(o.time));
  }, [bssid]);

  return {
    observations: data ?? [],
    loading,
    error: fetchError?.message ?? null,
    refetch,
  };
}
