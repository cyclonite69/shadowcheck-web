import { useState, useEffect } from 'react';
import { dashboardApi } from '../api/dashboardApi';
import { logError } from '../logging/clientLogger';
import type { CardData } from '../components/dashboard/MetricCard';

const CARD_DATA_MAP: Record<
  string,
  (data: any, tc: any) => { value: number; observations: number }
> = {
  'total-networks': (d, _tc) => ({
    value: d.networks?.total || 0,
    observations: d.observations?.total || 0,
  }),
  'wifi-count': (d, _tc) => ({
    value: d.networks?.wifi || 0,
    observations: d.observations?.wifi || 0,
  }),
  'radio-ble': (d, _tc) => ({
    value: d.networks?.ble || 0,
    observations: d.observations?.ble || 0,
  }),
  'radio-bt': (d, _tc) => ({
    value: d.networks?.bluetooth || 0,
    observations: d.observations?.bluetooth || 0,
  }),
  'radio-lte': (d, _tc) => ({
    value: d.networks?.lte || 0,
    observations: d.observations?.lte || 0,
  }),
  'radio-gsm': (d, _tc) => ({
    value: d.networks?.gsm || 0,
    observations: d.observations?.gsm || 0,
  }),
  'radio-nr': (d, _tc) => ({ value: d.networks?.nr || 0, observations: d.observations?.nr || 0 }),
  'threat-critical': (d, tc) => ({
    value: tc?.counts?.critical?.unique_networks ?? d.threats?.critical ?? 0,
    observations: tc?.counts?.critical?.total_observations ?? d.threats?.critical ?? 0,
  }),
  'threat-high': (d, tc) => ({
    value: tc?.counts?.high?.unique_networks ?? d.threats?.high ?? 0,
    observations: tc?.counts?.high?.total_observations ?? d.threats?.high ?? 0,
  }),
  'threat-medium': (d, tc) => ({
    value: tc?.counts?.medium?.unique_networks ?? d.threats?.medium ?? 0,
    observations: tc?.counts?.medium?.total_observations ?? d.threats?.medium ?? 0,
  }),
  'threat-low': (d, tc) => ({
    value: tc?.counts?.low?.unique_networks ?? d.threats?.low ?? 0,
    observations: tc?.counts?.low?.total_observations ?? d.threats?.low ?? 0,
  }),
};

export const useDashboard = (cards: CardData[], filterKey: string) => {
  const [updatedCards, setUpdatedCards] = useState(cards);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersApplied, setFiltersApplied] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);

        const filters = JSON.parse(filterKey);

        // Parallel fetch for dashboard metrics and threat severity counts
        const [data, threatCounts] = await Promise.all([
          dashboardApi.getMetrics(filters, controller.signal),
          dashboardApi.getThreatSeverityCounts(filters, controller.signal).catch(() => null),
        ]);

        setUpdatedCards((prev) =>
          prev.map((card) => {
            const resolver = CARD_DATA_MAP[card.type];
            return resolver ? { ...card, ...resolver(data, threatCounts) } : card;
          })
        );
        setFiltersApplied(data.filtersApplied || 0);
        setError(null);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          logError('Dashboard fetch error', err);
          setError('Failed to load metrics');
        }
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [filterKey]);

  return {
    cards: updatedCards,
    setCards: setUpdatedCards,
    loading,
    error,
    filtersApplied,
  };
};
