import { useState, useEffect, useCallback } from 'react';

/**
 * Generic async data fetching hook.
 *
 * Handles the useState/useEffect/loading/error boilerplate for a single
 * async fetch that re-runs whenever `deps` change. Provides a `refetch`
 * callback to manually trigger a re-fetch without changing the deps.
 *
 * @param fetcher  Async function that returns the data. Re-created whenever
 *                 `deps` change (same semantics as useEffect deps).
 * @param deps     Dependency array — same usage as useEffect second argument.
 *
 * @example
 * const { data, loading, error, refetch } = useAsyncData(
 *   () => adminApi.getAwsOverview(),
 *   []
 * );
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: any[] = []
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!cancelled && err?.name !== 'AbortError') {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // deps is intentionally dynamic — same contract as useEffect
  }, [...deps, tick]);

  return { data, loading, error, refetch };
}
