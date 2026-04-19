/**
 * WiGLE API
 */

import { apiClient } from './client';

export interface WiglePageNetwork {
  bssid?: string | null;
  netid?: string | null;
  ssid?: string | null;
  name?: string | null;
  type?: string | null;
  encryption?: string | null;
  capabilities?: string | null;
  channel?: number | string | null;
  frequency?: number | string | null;
  firsttime?: string | null;
  lasttime?: string | null;
  lastupdt?: string | null;
  trilat?: number | string | null;
  trilong?: number | string | null;
  trilon?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  manufacturer?: string | null;
  local_observations?: number | string | null;
  wigle_match?: boolean | string | null;
  observed_at?: string | null;
  source?: string | null;
  comment?: string | null;
  qos?: number | string | null;
  accuracy?: number | string | null;
  city?: string | null;
  region?: string | null;
  road?: string | null;
  housenumber?: string | null;
  geocoded_address?: string | null;
  geocoded_city?: string | null;
  geocoded_state?: string | null;
  geocoded_poi_name?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  local_first_seen?: string | null;
  local_last_seen?: string | null;
  localMatchExists?: boolean | null;
  localObservationCount?: number | null;
  wigle_source?: 'wigle-v2' | 'wigle-v3' | null;
  [key: string]: unknown;
}

type ApiClientError = Error & {
  status?: number;
  data?: unknown;
};

const normalizeApiEndpoint = (endpoint: string): string => {
  if (endpoint.startsWith('/api/')) {
    return endpoint.slice('/api'.length);
  }

  return endpoint;
};

const getErrorPayload = (error: unknown): any | null => {
  if (error && typeof error === 'object' && 'data' in error) {
    return (error as ApiClientError).data ?? null;
  }

  return null;
};

// TODO: server endpoint pending.
export const getWiglePageNetwork = async (netid: string): Promise<WiglePageNetwork> => {
  const cleanNetid = netid.trim().toUpperCase();
  return apiClient.get(`/wigle/page/network/${encodeURIComponent(cleanNetid)}`);
};

export const wigleApi = {
  // WiGLE API Status
  async getApiStatus(): Promise<any> {
    return apiClient.get('/wigle/api-status');
  },

  // WiGLE Search
  async searchWigle(params: URLSearchParams): Promise<any> {
    return apiClient.get(`/wigle/search-api?${params.toString()}`);
  },

  async importAllWigle(params: Record<string, string>): Promise<any> {
    return apiClient.post('/wigle/search-api/import-all', params);
  },

  async listImportRuns(params: URLSearchParams = new URLSearchParams()): Promise<any> {
    const suffix = params.toString();
    return apiClient.get(`/wigle/search-api/import-runs${suffix ? `?${suffix}` : ''}`);
  },

  async getImportRun(runId: number): Promise<any> {
    return apiClient.get(`/wigle/search-api/import-runs/${runId}`);
  },

  async getImportCompletenessReport(params: URLSearchParams = new URLSearchParams()): Promise<any> {
    const suffix = params.toString();
    return apiClient.get(
      `/wigle/search-api/import-runs/completeness/summary${suffix ? `?${suffix}` : ''}`
    );
  },

  async resumeImportRun(runId: number): Promise<any> {
    return apiClient.post(`/wigle/search-api/import-runs/${runId}/resume`, {});
  },

  async resumeLatestImportRun(params: Record<string, string>): Promise<any> {
    return apiClient.post('/wigle/search-api/import-runs/resume-latest', params);
  },

  async pauseImportRun(runId: number): Promise<any> {
    return apiClient.post(`/wigle/search-api/import-runs/${runId}/pause`, {});
  },

  async cancelImportRun(runId: number): Promise<any> {
    return apiClient.post(`/wigle/search-api/import-runs/${runId}/cancel`, {});
  },

  // WiGLE v3 Batch Enrichment
  async getEnrichmentStats(): Promise<any> {
    return apiClient.get('/wigle/enrichment/stats');
  },

  async getEnrichmentCatalog(params: URLSearchParams): Promise<any> {
    return apiClient.get(`/wigle/enrichment/catalog?${params.toString()}`);
  },

  async startEnrichment(bssids?: string[]): Promise<any> {
    return apiClient.post('/wigle/enrichment/start', { bssids });
  },

  async resumeEnrichment(runId: number): Promise<any> {
    return apiClient.post(`/wigle/enrichment/resume/${runId}`, {});
  },

  // WiGLE Detail
  async getWigleObservations(netid: string): Promise<any> {
    return apiClient.get(`/wigle/observations/${encodeURIComponent(netid)}`);
  },

  async getWiglePageNetwork(netid: string): Promise<WiglePageNetwork> {
    return getWiglePageNetwork(netid);
  },

  // raw fetch — server returns { ok: false } on WiGLE errors (4xx) and apiClient would throw
  // instead of returning the structured response that handleWigleLookup checks
  async getWigleDetail(
    bssid: string,
    isBluetooth: boolean,
    importData: boolean = true
  ): Promise<any> {
    const cleanBssid = bssid.trim().toUpperCase();
    const path = isBluetooth
      ? `/wigle/detail/bt/${encodeURIComponent(cleanBssid)}`
      : `/wigle/detail/${encodeURIComponent(cleanBssid)}`;

    try {
      return await apiClient.post(path, { import: importData });
    } catch (error) {
      const payload = getErrorPayload(error);
      if (payload) {
        return payload;
      }

      throw error;
    }
  },

  async importWigleV3(formData: FormData): Promise<any> {
    return apiClient.post('/wigle/import/v3', formData);
  },

  // Network WiGLE Observations
  async getNetworkWigleObservations(bssid: string): Promise<any> {
    return apiClient.get(`/networks/${encodeURIComponent(bssid)}/wigle-observations`);
  },

  async getKmlPoints(params: URLSearchParams): Promise<any> {
    const suffix = params.toString();
    return apiClient.get(`/wigle/kml-points${suffix ? `?${suffix}` : ''}`);
  },

  async cleanupCancelledCluster(): Promise<any> {
    return apiClient.delete('/wigle/search-api/import-runs/cluster-cleanup', {
      body: JSON.stringify({ confirm: true }),
    });
  },

  async getSavedSsidTerms(): Promise<any> {
    return apiClient.get('/wigle/search-api/saved-ssid-terms');
  },

  async saveSsidTerm(term: string): Promise<any> {
    return apiClient.post('/wigle/search-api/saved-ssid-terms', { term });
  },

  async deleteSavedSsidTerm(id: number): Promise<any> {
    return apiClient.delete(`/wigle/search-api/saved-ssid-terms/${id}`);
  },

  // Mapbox Token (for WiGLE map)
  async getMapboxToken(): Promise<any> {
    return apiClient.get('/mapbox-token');
  },

  async searchLocalWigle(endpoint: string, params: URLSearchParams): Promise<any> {
    const normalizedEndpoint = normalizeApiEndpoint(endpoint);
    const suffix = params.toString();
    return apiClient.get(`${normalizedEndpoint}${suffix ? `?${suffix}` : ''}`);
  },
};
