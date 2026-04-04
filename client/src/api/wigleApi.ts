/**
 * WiGLE API
 */

import { apiClient } from './client';

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
      ? `/api/wigle/detail/bt/${encodeURIComponent(cleanBssid)}`
      : `/api/wigle/detail/${encodeURIComponent(cleanBssid)}`;
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ import: importData }),
    });
    return res.json();
  },

  // FormData — raw fetch (apiClient forces application/json header)
  async importWigleV3(formData: FormData): Promise<any> {
    const res = await fetch('/api/wigle/import/v3', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    return res.json();
  },

  // Network WiGLE Observations
  async getNetworkWigleObservations(bssid: string): Promise<any> {
    return apiClient.get(`/networks/${encodeURIComponent(bssid)}/wigle-observations`);
  },

  // Mapbox Token (for WiGLE map)
  async getMapboxToken(): Promise<any> {
    return apiClient.get('/mapbox-token');
  },

  // Arbitrary caller-supplied path — raw fetch (apiClient would double-prefix /api/)
  async searchLocalWigle(endpoint: string, params: URLSearchParams): Promise<any> {
    const res = await fetch(`${endpoint}?${params.toString()}`, { credentials: 'include' });
    return res.json();
  },
};
