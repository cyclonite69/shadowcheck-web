/**
 * Kepler.gl API
 */

import { apiClient } from './client';

export interface KeplerFilters {
  filtersForPage: Record<string, unknown>;
  enabledForPage: Record<string, boolean>;
}

interface MapboxTokenResponse {
  token: string;
}

export interface KeplerGeoJSON {
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
  complete?: boolean;
  actualCounts?: {
    observations: number;
    networks: number;
  };
}

export const keplerApi = {
  async getMapboxToken(signal?: AbortSignal): Promise<MapboxTokenResponse> {
    return apiClient.get<MapboxTokenResponse>('/mapbox-token', { signal });
  },

  async getNetworks(filters: KeplerFilters, signal?: AbortSignal): Promise<KeplerGeoJSON> {
    return apiClient.get<KeplerGeoJSON>('/kepler/networks', {
      params: {
        filters: JSON.stringify(filters.filtersForPage),
        enabled: JSON.stringify(filters.enabledForPage),
      },
      signal,
    });
  },

  async getObservations(filters: KeplerFilters, signal?: AbortSignal): Promise<KeplerGeoJSON> {
    return apiClient.get<KeplerGeoJSON>('/kepler/observations', {
      params: {
        filters: JSON.stringify(filters.filtersForPage),
        enabled: JSON.stringify(filters.enabledForPage),
      },
      signal,
    });
  },

  async getObservationsArrow(filters: KeplerFilters, signal?: AbortSignal): Promise<ArrayBuffer> {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters.filtersForPage),
      enabled: JSON.stringify(filters.enabledForPage),
    });
    const response = await fetch(`/api/kepler/observations.arrow?${params}`, {
      credentials: 'include',
      signal,
      headers: { Accept: 'application/vnd.apache.arrow.stream' },
    });
    if (!response.ok) {
      const detail = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : null;
      throw new Error(detail?.error || `Arrow observations request failed (${response.status})`);
    }
    return response.arrayBuffer();
  },
};
