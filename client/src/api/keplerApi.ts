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
  actualCounts?: {
    observations: number;
    networks: number;
  };
}

export const keplerApi = {
  async getMapboxToken(): Promise<MapboxTokenResponse> {
    return apiClient.get<MapboxTokenResponse>('/mapbox-token');
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
};
