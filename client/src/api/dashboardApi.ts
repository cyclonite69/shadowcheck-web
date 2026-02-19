/**
 * Dashboard API
 */

interface DashboardFilters {
  filters: Record<string, unknown>;
  enabled: Record<string, boolean>;
}

interface DashboardMetrics {
  networks: {
    total: number;
    wifi: number;
    ble: number;
    cellular: number;
    bluetooth?: number;
    lte?: number;
    gsm?: number;
    nr?: number;
  };
  observations: {
    total: number;
    wifi: number;
    ble: number;
    cellular: number;
    bluetooth?: number;
    lte?: number;
    gsm?: number;
    nr?: number;
  };
  filtersApplied?: number;
}

interface ThreatSeverityCounts {
  counts: {
    critical: Record<string, number>;
    high: Record<string, number>;
    medium: Record<string, number>;
    low: Record<string, number>;
  };
}

export const dashboardApi = {
  async getMetrics(filters: DashboardFilters, signal?: AbortSignal): Promise<DashboardMetrics> {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters.filters),
      enabled: JSON.stringify(filters.enabled),
    });
    const response = await fetch(`/api/dashboard-metrics?${params}`, { signal });
    if (!response.ok) throw new Error('Failed to fetch dashboard metrics');
    return response.json();
  },

  async getThreatSeverityCounts(
    filters: DashboardFilters,
    signal?: AbortSignal
  ): Promise<ThreatSeverityCounts> {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters.filters),
      enabled: JSON.stringify(filters.enabled),
    });
    const response = await fetch(`/api/v2/threats/severity-counts?${params}`, { signal });
    if (!response.ok) throw new Error('Failed to fetch threat severity counts');
    return response.json();
  },
};
