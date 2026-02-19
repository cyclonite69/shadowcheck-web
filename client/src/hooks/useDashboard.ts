import { useState, useEffect } from 'react';
import { dashboardApi } from '../api/dashboardApi';
import { logError } from '../logging/clientLogger';
import type { CardData } from '../components/dashboard/MetricCard';

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
          dashboardApi.getThreatSeverityCounts(filters, controller.signal).catch(() => ({
            counts: {
              critical: { unique_networks: 0, total_observations: 0 },
              high: { unique_networks: 0, total_observations: 0 },
              medium: { unique_networks: 0, total_observations: 0 },
              low: { unique_networks: 0, total_observations: 0 },
            },
          })),
        ]);

        setUpdatedCards((prev) =>
          prev.map((card) => {
            switch (card.type) {
              case 'total-networks':
                return {
                  ...card,
                  value: data.networks?.total || 0,
                  observations: data.observations?.total || 0,
                };
              case 'wifi-count':
                return {
                  ...card,
                  value: data.networks?.wifi || 0,
                  observations: data.observations?.wifi || 0,
                };
              case 'radio-ble':
                return {
                  ...card,
                  value: data.networks?.ble || 0,
                  observations: data.observations?.ble || 0,
                };
              case 'radio-bt':
                return {
                  ...card,
                  value: data.networks?.bluetooth || 0,
                  observations: data.observations?.bluetooth || 0,
                };
              case 'radio-lte':
                return {
                  ...card,
                  value: data.networks?.lte || 0,
                  observations: data.observations?.lte || 0,
                };
              case 'radio-gsm':
                return {
                  ...card,
                  value: data.networks?.gsm || 0,
                  observations: data.observations?.gsm || 0,
                };
              case 'radio-nr':
                return {
                  ...card,
                  value: data.networks?.nr || 0,
                  observations: data.observations?.nr || 0,
                };
              case 'threat-critical':
                return {
                  ...card,
                  value: threatCounts.counts?.critical?.unique_networks || 0,
                  observations: threatCounts.counts?.critical?.total_observations || 0,
                };
              case 'threat-high':
                return {
                  ...card,
                  value: threatCounts.counts?.high?.unique_networks || 0,
                  observations: threatCounts.counts?.high?.total_observations || 0,
                };
              case 'threat-medium':
                return {
                  ...card,
                  value: threatCounts.counts?.medium?.unique_networks || 0,
                  observations: threatCounts.counts?.medium?.total_observations || 0,
                };
              case 'threat-low':
                return {
                  ...card,
                  value: threatCounts.counts?.low?.unique_networks || 0,
                  observations: threatCounts.counts?.low?.total_observations || 0,
                };
              default:
                return card;
            }
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
