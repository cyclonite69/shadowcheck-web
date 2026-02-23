import { useState, useEffect, useCallback } from 'react';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import { logDebug } from '../logging/clientLogger';
import { apiClient } from '../api/client';
import type { NetworkRow, SortState } from '../types/network';
import { API_SORT_MAP, NETWORK_PAGE_LIMIT } from '../constants/network';
import { mapApiRowToNetwork } from '../utils/networkDataTransformation';

interface UseNetworkDataOptions {
  locationMode?: string;
  planCheck?: boolean;
}

interface UseNetworkDataReturn {
  networks: NetworkRow[];
  loading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  networkTotal: number | null;
  networkTruncated: boolean;
  expensiveSort: boolean;
  pagination: { offset: number; hasMore: boolean };
  sort: SortState[];
  setSort: React.Dispatch<React.SetStateAction<SortState[]>>;
  loadMore: () => void;
  resetNetworks: () => void;
  resetPagination: () => void;
}

const isCountTimeoutError = (err: unknown): boolean => {
  const e = err as { status?: number; message?: string; data?: unknown };
  const message = String(e?.message || '').toLowerCase();
  const dataText = JSON.stringify(e?.data || '').toLowerCase();
  const status = e?.status;

  return (
    (status === 500 || status === 503 || status === 504) &&
    (message.includes('timeout') ||
      message.includes('statement_timeout') ||
      message.includes('timed out') ||
      dataText.includes('timeout') ||
      dataText.includes('statement_timeout') ||
      dataText.includes('timed out'))
  );
};

export function useNetworkData(options: UseNetworkDataOptions = {}): UseNetworkDataReturn {
  const { locationMode = 'latest_observation', planCheck = false } = options;

  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkTotal, setNetworkTotal] = useState<number | null>(null);
  const [networkTruncated, setNetworkTruncated] = useState(false);
  const [expensiveSort, setExpensiveSort] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, hasMore: true });
  const [sort, setSort] = useState<SortState[]>([{ column: 'lastSeen', direction: 'desc' }]);
  const [includeTotal, setIncludeTotal] = useState(true);

  const [debouncedFilterState, setDebouncedFilterState] = useState(() =>
    useFilterStore.getState().getAPIFilters()
  );
  useDebouncedFilters((payload) => setDebouncedFilterState(payload), 500);

  const loadMore = useCallback(() => {
    setPagination((prev) => ({ ...prev, offset: prev.offset + NETWORK_PAGE_LIMIT }));
  }, []);

  const resetNetworks = useCallback(() => {
    setNetworks([]);
    setPagination({ offset: 0, hasMore: true });
  }, []);

  const resetPagination = useCallback(() => {
    setPagination({ offset: 0, hasMore: true });
  }, []);

  useEffect(() => {
    if (pagination.offset === 0) {
      setIncludeTotal(true);
    }
  }, [pagination.offset, JSON.stringify(debouncedFilterState), JSON.stringify(sort), planCheck]);

  // Derived state: loading more if pagination offset > 0 and loading
  const isLoadingMore = loading && pagination.offset > 0;

  // Fetch networks
  useEffect(() => {
    const controller = new AbortController();

    const fetchNetworks = async () => {
      setLoading(true);
      setError(null);
      setExpensiveSort(false);

      try {
        const sortKeys = sort
          .map((entry) => API_SORT_MAP[entry.column])
          .filter((value): value is string => Boolean(value));

        if (sortKeys.length !== sort.length) {
          setError('One or more sort columns are not supported by the API.');
          setLoading(false);
          return;
        }

        const params = new URLSearchParams({
          limit: String(NETWORK_PAGE_LIMIT),
          offset: String(pagination.offset),
          sort: sortKeys.join(','),
          order: sort.map((entry) => entry.direction.toUpperCase()).join(','),
          filters: JSON.stringify(debouncedFilterState.filters),
          enabled: JSON.stringify(debouncedFilterState.enabled),
          includeTotal: includeTotal ? '1' : '0',
        });
        if (debouncedFilterState.enabled.wigle_v3_observation_count_min) {
          params.set('pageType', 'wigle');
        }

        if (planCheck) {
          params.set('planCheck', '1');
        }

        const data = await apiClient.get<any>(`/v2/networks/filtered?${params.toString()}`, {
          signal: controller.signal,
        });
        logDebug(`Networks response received`);
        const rows = data.data || [];
        setExpensiveSort(Boolean(data.expensive_sort));
        setNetworkTotal(typeof data.pagination?.total === 'number' ? data.pagination.total : null);
        setNetworkTruncated(Boolean(data.truncated));

        const mapped: NetworkRow[] = rows.map(mapApiRowToNetwork);

        if (pagination.offset === 0) {
          setNetworks(mapped);
        } else {
          setNetworks((prev) => [...prev, ...mapped]);
        }

        setPagination((prev) => ({
          ...prev,
          hasMore:
            typeof data.pagination?.hasMore === 'boolean'
              ? data.pagination.hasMore
              : mapped.length === NETWORK_PAGE_LIMIT,
        }));
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          if (includeTotal && isCountTimeoutError(err)) {
            setIncludeTotal(false);
            setError(null);
          } else {
            setError(err.message);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNetworks();
    return () => controller.abort();
  }, [
    pagination.offset,
    JSON.stringify(debouncedFilterState),
    JSON.stringify(sort),
    planCheck,
    locationMode,
    includeTotal,
  ]);

  return {
    networks,
    loading,
    isLoadingMore,
    error,
    setError,
    networkTotal,
    networkTruncated,
    expensiveSort,
    pagination,
    sort,
    setSort,
    loadMore,
    resetNetworks,
    resetPagination,
  };
}

export default useNetworkData;
