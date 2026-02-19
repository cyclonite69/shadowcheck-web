/**
 * Kepler.gl API
 */

interface KeplerFilters {
  filtersForPage: Record<string, unknown>;
  enabledForPage: Record<string, boolean>;
}

interface MapboxTokenResponse {
  token: string;
}

interface KeplerGeoJSON {
  type: string;
  features: Array<{
    type: string;
    geometry: {
      type: string;
      coordinates: number[];
    };
    properties: Record<string, unknown>;
  }>;
  error?: string;
  actualCounts?: {
    observations: number;
    networks: number;
  };
}

export const keplerApi = {
  async getMapboxToken(): Promise<MapboxTokenResponse> {
    const response = await fetch('/api/mapbox-token');
    return response.json();
  },

  async getNetworks(filters: KeplerFilters, signal?: AbortSignal): Promise<KeplerGeoJSON> {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters.filtersForPage),
      enabled: JSON.stringify(filters.enabledForPage),
    });
    const response = await fetch(`/api/kepler/networks?${params}`, { signal });
    return response.json();
  },

  async getObservations(filters: KeplerFilters, signal?: AbortSignal): Promise<KeplerGeoJSON> {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters.filtersForPage),
      enabled: JSON.stringify(filters.enabledForPage),
    });
    const response = await fetch(`/api/kepler/observations?${params}`, { signal });
    return response.json();
  },
};
