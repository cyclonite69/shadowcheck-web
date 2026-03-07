/**
 * Universal Filter Integration Hook
 * Connects filter state to API calls with debouncing
 */

import { useEffect, useState, useCallback } from 'react';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import { NetworkFilters } from '../types/filters';
import { logError } from '../logging/clientLogger';
import { apiClient } from '../api/client';
import { buildFilteredRequestParams } from '../utils/filteredRequestParams';

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

interface FilteredResponse<T> {
  ok?: boolean;
  error?: unknown;
  data?: T[];
  features?: T[];
  pagination?: {
    total?: number;
  };
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

export function useFilteredData<T = unknown>(
  options: UseFilteredDataOptions
): FilteredDataResult<T> {
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

        const params = buildFilteredRequestParams({
          payload: { filters, enabled },
          limit,
          offset: actualOffset,
          sort,
          order,
          orderBy,
        });

        const endpointPath = endpoint === 'networks' ? '' : `/${endpoint}`;
        const fullUrl = `/v2/networks/filtered${endpointPath}?${params}`;

        const result = await apiClient.get<FilteredResponse<T>>(fullUrl);

        if (!result.ok) {
          const errorObj = result.error as { message?: string } | undefined;
          const errorMsg =
            typeof result.error === 'string'
              ? result.error
              : errorObj?.message || 'API request failed';
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
  useDebouncedFilters((payload) => {
    fetchData(payload, true);
  }, 500);

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
