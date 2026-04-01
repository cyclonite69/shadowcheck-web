import { useState, useEffect, useRef } from 'react';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import type { Observation } from '../types/network';
import { apiClient } from '../api/client';
import { buildFilteredRequestParams } from '../utils/filteredRequestParams';
import { groupObservationRowsByBssid } from '../utils/observationDataTransformation';

interface UseObservationsOptions {
  useFilters?: boolean;
}

interface UseObservationsReturn {
  observationsByBssid: Record<string, Observation[]>;
  loading: boolean;
  error: string | null;
  total: number | null;
  truncated: boolean;
  renderBudgetExceeded: boolean;
  renderBudget: number | null;
}

export function useObservations(
  selectedNetworks: Set<string>,
  options: UseObservationsOptions = {}
): UseObservationsReturn {
  const { useFilters = true } = options;

  const [observationsByBssid, setObservationsByBssid] = useState<Record<string, Observation[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [renderBudgetExceeded, setRenderBudgetExceeded] = useState(false);
  const [renderBudget, setRenderBudget] = useState<number | null>(null);

  const [debouncedFilterState, setDebouncedFilterState] = useState(() =>
    useFilterStore.getState().getAPIFilters()
  );
  useDebouncedFilters((payload) => setDebouncedFilterState(payload), 500);
  const currentPage = useFilterStore((state) => state.currentPage);

  // Create a ref to track if filter state actually changed to avoid spurious refetches
  const prevFilterStateRef = useRef<string>('');
  const filterStateChanged = prevFilterStateRef.current !== JSON.stringify(debouncedFilterState);
  if (filterStateChanged) {
    prevFilterStateRef.current = JSON.stringify(debouncedFilterState);
  }

  useEffect(() => {
    const controller = new AbortController();

    const fetchObservations = async () => {
      if (!selectedNetworks.size) {
        setObservationsByBssid({});
        setTotal(null);
        setTruncated(false);
        setRenderBudgetExceeded(false);
        setRenderBudget(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const selectedBssids = Array.from(selectedNetworks);
        const limit = 20000;
        let offset = 0;
        let fetchedTotal: number | null = null;
        let isTruncated = false;
        let renderBudgetLimit: number | null = null;
        let didExceedRenderBudget = false;
        let allRows: any[] = [];
        const usePostTransport = selectedBssids.length > 100;

        const observationFilters = useFilters ? debouncedFilterState : { filters: {}, enabled: {} };

        while (true) {
          const pageType =
            currentPage === 'wigle' && observationFilters.enabled.wigle_v3_observation_count_min
              ? 'wigle'
              : undefined;
          const data = usePostTransport
            ? await apiClient.post<any>(
                '/v2/networks/filtered/observations',
                {
                  filters: observationFilters.filters,
                  enabled: observationFilters.enabled,
                  bssids: selectedBssids,
                  limit,
                  offset,
                  pageType,
                  include_total: offset === 0 ? 1 : 0,
                },
                { signal: controller.signal }
              )
            : await apiClient.get<any>(
                `/v2/networks/filtered/observations?${buildFilteredRequestParams({
                  payload: observationFilters,
                  selectedBssids,
                  limit,
                  offset,
                  pageType,
                }).toString()}`,
                { signal: controller.signal }
              );
          const rows = data.data || [];
          allRows = allRows.concat(rows);

          if (offset === 0 && typeof data.total === 'number') {
            fetchedTotal = data.total;
          }
          if (offset === 0 && typeof data.render_budget === 'number') {
            renderBudgetLimit = data.render_budget;
          }
          if (typeof data.render_budget_exceeded === 'boolean') {
            didExceedRenderBudget = didExceedRenderBudget || data.render_budget_exceeded;
          }

          if (!data.truncated || rows.length === 0) {
            isTruncated = Boolean(data.truncated);
            break;
          }

          offset += limit;

          if (renderBudgetLimit !== null && allRows.length >= renderBudgetLimit) {
            isTruncated = true;
            break;
          }
          if (fetchedTotal !== null && allRows.length >= fetchedTotal) {
            isTruncated = false;
            break;
          }
          if (controller.signal.aborted) {
            return;
          }
        }

        const grouped = groupObservationRowsByBssid(allRows);

        setObservationsByBssid(grouped);
        setTotal(fetchedTotal);
        setTruncated(isTruncated || (fetchedTotal !== null && allRows.length < fetchedTotal));
        setRenderBudgetExceeded(didExceedRenderBudget);
        setRenderBudget(renderBudgetLimit);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchObservations();
    return () => controller.abort();
  }, [selectedNetworks, filterStateChanged, useFilters, currentPage]);

  return {
    observationsByBssid,
    loading,
    error,
    total,
    truncated,
    renderBudgetExceeded,
    renderBudget,
  };
}

export default useObservations;
