import { useState, useEffect, useCallback } from 'react';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import { logDebug } from '../logging/clientLogger';
import { apiClient } from '../api/client';
import type { NetworkRow, SortState } from '../types/network';
import { API_SORT_MAP, NETWORK_PAGE_LIMIT } from '../constants/network';
import { mapApiRowToNetwork } from '../utils/networkDataTransformation';
import { buildFilteredRequestParams } from '../utils/filteredRequestParams';

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

  if (status === 504) {
    return true;
  }

  return (
    (status === 500 || status === 503) &&
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

  const [debouncedFilterState, setDebouncedFilterState] = useState(() =>
    useFilterStore.getState().getAPIFilters()
  );
  useDebouncedFilters((payload) => setDebouncedFilterState(payload), 500);
  const currentPage = useFilterStore((state) => state.currentPage);

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

        // Send all filters and enabled flags - backend will handle which to apply
        const applyResponse = (data: any) => {
          const rows = data.data || [];
          setExpensiveSort(Boolean(data.expensive_sort));
          setNetworkTotal(
            typeof data.pagination?.total === 'number' ? data.pagination.total : null
          );
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
        };

        const requestNetworks = async (includeTotalFlag: boolean, limit = NETWORK_PAGE_LIMIT) => {
          const params = buildFilteredRequestParams({
            payload: debouncedFilterState,
            limit,
            offset: pagination.offset,
            sort: sortKeys.join(','),
            order: sort.map((entry) => entry.direction.toUpperCase()).join(','),
            includeTotal: includeTotalFlag,
            pageType:
              currentPage === 'wigle' && debouncedFilterState.enabled.wigle_v3_observation_count_min
                ? 'wigle'
                : undefined,
            planCheck,
          });
          return apiClient.get<any>(`/v2/networks/filtered?${params.toString()}`, {
            signal: controller.signal,
          });
        };

        const shouldIncludeTotal = pagination.offset === 0;
        let data;
        try {
          data = await requestNetworks(shouldIncludeTotal);
        } catch (primaryErr: any) {
          if (
            shouldIncludeTotal &&
            primaryErr?.name !== 'AbortError' &&
            isCountTimeoutError(primaryErr)
          ) {
            try {
              data = await requestNetworks(false);
            } catch (secondaryErr: any) {
              if (secondaryErr?.name !== 'AbortError' && isCountTimeoutError(secondaryErr)) {
                data = await requestNetworks(false, 200);
              } else {
                throw secondaryErr;
              }
            }
          } else {
            throw primaryErr;
          }
        }

        logDebug(`Networks response received`);
        applyResponse(data);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          const errorMessage =
            typeof err === 'object' && err !== null
              ? err.message || JSON.stringify(err)
              : String(err);
          setError(errorMessage);
          setLoading(false);
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
