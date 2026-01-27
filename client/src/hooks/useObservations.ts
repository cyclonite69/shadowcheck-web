import { useState, useEffect } from 'react';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import type { Observation } from '../types/network';

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
        let allRows: any[] = [];

        const observationFilters = (() => {
          if (!useFilters) {
            return { filters: {}, enabled: {} };
          }
          const networkOnlyFilters: Array<keyof typeof debouncedFilterState.filters> = [
            'threatScoreMin',
            'threatScoreMax',
            'threatCategories',
            'stationaryConfidenceMin',
            'stationaryConfidenceMax',
            'distanceFromHomeMin',
            'distanceFromHomeMax',
          ];
          const enabled = { ...debouncedFilterState.enabled };
          networkOnlyFilters.forEach((key) => {
            if (key in enabled) {
              enabled[key] = false;
            }
          });
          return { filters: debouncedFilterState.filters, enabled };
        })();

        while (true) {
          const params = new URLSearchParams({
            filters: JSON.stringify(observationFilters.filters),
            enabled: JSON.stringify(observationFilters.enabled),
            bssids: JSON.stringify(selectedBssids),
            limit: String(limit),
            offset: String(offset),
          });

          if (offset === 0) {
            params.set('include_total', '1');
          }

          const res = await fetch(`/api/v2/networks/filtered/observations?${params.toString()}`, {
            signal: controller.signal,
          });

          if (!res.ok) throw new Error(`observations ${res.status}`);

          const data = await res.json();
          const rows = data.data || [];
          allRows = allRows.concat(rows);

          if (offset === 0 && typeof data.total === 'number') {
            fetchedTotal = data.total;
          }
          if (offset === 0 && typeof data.render_budget === 'number') {
            renderBudgetLimit = data.render_budget;
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

        const grouped = allRows.reduce((acc: Record<string, Observation[]>, row: any) => {
          const bssid = String(row.bssid || '').toUpperCase();
          const lat = typeof row.lat === 'number' ? row.lat : parseFloat(row.lat);
          const lon = typeof row.lon === 'number' ? row.lon : parseFloat(row.lon);

          if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return acc;
          }

          if (!acc[bssid]) acc[bssid] = [];
          acc[bssid].push({
            id: row.obs_number || `${bssid}-${row.time}`,
            bssid,
            lat,
            lon,
            signal: typeof row.level === 'number' ? row.level : (row.level ?? null),
            time: row.time,
            frequency: typeof row.radio_frequency === 'number' ? row.radio_frequency : null,
            acc: row.accuracy ?? null,
            altitude: typeof row.altitude === 'number' ? row.altitude : null,
          });

          return acc;
        }, {});

        setObservationsByBssid(grouped);
        setTotal(fetchedTotal);
        setTruncated(isTruncated || (fetchedTotal !== null && allRows.length < fetchedTotal));
        setRenderBudgetExceeded(Boolean((allRows as any).render_budget_exceeded));
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
  }, [selectedNetworks, JSON.stringify(debouncedFilterState), useFilters]);

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
