/**
 * WiGLE API
 */

import { apiClient } from './client';

type ApiClientError = Error & {
  status?: number;
  data?: any;
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
