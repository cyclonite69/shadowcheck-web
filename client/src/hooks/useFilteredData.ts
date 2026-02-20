/**
 * Universal Filter Integration Hook
 * Connects filter state to API calls with debouncing
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import { NetworkFilters } from '../types/filters';
import { logError } from '../logging/clientLogger';
import { apiClient } from '../api/client';

interface UseFilteredDataOptions {
  endpoint: 'networks' | 'geospatial' | 'analytics' | 'observations';
  limit?: number;
  offset?: number;
  orderBy?: string;
  sort?: string;
  order?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface FilteredDataResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
}

export function useFilteredData<T = any>(options: UseFilteredDataOptions): FilteredDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);

  const { setLoading: setGlobalLoading } = useFilterStore();

  const {
    endpoint,
    limit = 1000,
    orderBy,
    sort,
    order,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  const fetchData = useCallback(
    async (
      payload: { filters: NetworkFilters; enabled: Record<keyof NetworkFilters, boolean> },
      resetOffset = true
    ) => {
      try {
        setLoading(true);
        setGlobalLoading(true);
        setError(null);

        const actualOffset = resetOffset ? 0 : currentOffset;
        const { filters, enabled } = payload;
        const params = new URLSearchParams({
          filters: JSON.stringify(filters),
          enabled: JSON.stringify(enabled),
          limit: limit.toString(),
          offset: actualOffset.toString(),
        });
        if (sort) params.set('sort', sort);
        if (order) params.set('order', order);
        if (orderBy) params.set('orderBy', orderBy);

        const endpointPath = endpoint === 'networks' ? '' : `/${endpoint}`;
        const result = await apiClient.get<any>(`/v2/networks/filtered${endpointPath}?${params}`);

        if (!result.ok) {
          const errorMsg =
            typeof result.error === 'string'
              ? result.error
              : result.error?.message || 'API request failed';
          throw new Error(errorMsg);
        }

        if (resetOffset) {
          setData(result.data || result.features || []);
          setCurrentOffset(0);
        } else {
          setData((prev) => [...prev, ...(result.data || result.features || [])]);
        }

        setTotal(result.pagination?.total || result.data?.length || 0);
      } catch (err) {
        logError('Filter data fetch error', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        if (resetOffset) {
          setData([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
        setGlobalLoading(false);
      }
    },
    [endpoint, limit, orderBy, currentOffset, setGlobalLoading]
  );

  // Debounced filter changes
  useDebouncedFilters(fetchData, 500);

  const refresh = useCallback(() => {
    const filters = useFilterStore.getState().getAPIFilters();
    fetchData(filters, true);
  }, [fetchData]);

  const loadMore = useCallback(() => {
    if (loading || currentOffset + limit >= total) return;

    const newOffset = currentOffset + limit;
    setCurrentOffset(newOffset);

    const filters = useFilterStore.getState().getAPIFilters();
    fetchData(filters, false);
  }, [loading, currentOffset, limit, total, fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  // Initial load
  useEffect(() => {
    const filters = useFilterStore.getState().getAPIFilters();
    fetchData(filters, true);
  }, []);

  return {
    data,
    loading,
    error,
    total,
    hasMore: currentOffset + limit < total,
    refresh,
    loadMore,
  };
}

// Specialized hooks for different data types
export const useFilteredNetworks = (options: Omit<UseFilteredDataOptions, 'endpoint'> = {}) =>
  useFilteredData({ ...options, endpoint: 'networks' });

export const useFilteredGeospatial = (options: Omit<UseFilteredDataOptions, 'endpoint'> = {}) =>
  useFilteredData({ ...options, endpoint: 'geospatial' });

export const useFilteredAnalytics = (options: Omit<UseFilteredDataOptions, 'endpoint'> = {}) =>
  useFilteredData({ ...options, endpoint: 'analytics' });

// URL synchronization hook
export const useFilterURLSync = () => {
  const { setFromURLParams } = useFilterStore();
  const filters = useFilterStore((state) => state.getCurrentFilters());
  const enabled = useFilterStore((state) => state.getCurrentEnabled());

  // Load from URL on mount only
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.toString()) {
      setFromURLParams(params);
    }
  }, []); // Only on mount

  // Create stable string from filters
  const filterString = useMemo(() => JSON.stringify({ filters, enabled }), [filters, enabled]);

  // Update URL when filter string changes
  useEffect(() => {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters),
      enabled: JSON.stringify(enabled),
    });
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
  }, [filterString]); // Only when stable string changes
};
