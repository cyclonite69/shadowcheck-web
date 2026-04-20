/**
 * WiGLE API
 */

import { apiClient } from './client';

/**
 * Flat shape used for initial tooltip render from map GeoJSON feature properties,
 * and as the merged working object in the click handler after enrichment.
 */
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
  // v3-derived temporal (from observation aggregation, not summary row)
  wigle_v3_first_seen?: string | null;
  wigle_v3_last_seen?: string | null;
  wigle_v3_observation_count?: number | null;
  // display coordinate metadata
  display_lat?: number | null;
  display_lon?: number | null;
  display_coordinate_source?: string | null;
  // public-pattern signals
  public_nonstationary_flag?: boolean | null;
  public_ssid_variant_flag?: boolean | null;
  // provenance caveat
  wigle_precision_warning?: boolean | null;
  [key: string]: unknown;
}

/**
 * Structured response from /wigle/page/network/:netid.
 * WiGLE-truth fields are isolated in `wigle`; local linkage is in `localLinkage`.
 */
export interface WiglePageNetworkResponse {
  wigle: {
    bssid: string;
    ssid: string | null;
    name: string | null;
    type: string | null;
    encryption: string | null;
    channel: number | null;
    frequency: number | null;
    qos: number | null;
    comment: string | null;
    wigle_source: 'wigle-v2' | 'wigle-v3';
    // v2 provenance fields
    wigle_v2_firsttime: string | null;
    wigle_v2_lasttime: string | null;
    wigle_v2_trilat: number | null;
    wigle_v2_trilong: number | null;
    wigle_v2_city: string | null;
    wigle_v2_region: string | null;
    wigle_v2_road: string | null;
    wigle_v2_housenumber: string | null;
    has_wigle_v2_record: boolean;
    // v3-derived temporal (obs-aggregated)
    wigle_v3_first_seen: string | null;
    wigle_v3_last_seen: string | null;
    wigle_v3_observation_count: number | null;
    wigle_v3_centroid_lat: number | null;
    wigle_v3_centroid_lon: number | null;
    wigle_v3_spread_m: number | null;
    has_wigle_v3_observations: boolean;
    // chosen display coordinate
    display_lat: number | null;
    display_lon: number | null;
    display_coordinate_source: 'wigle-v2-trilat' | 'wigle-v3-centroid' | 'wigle-v3-summary' | null;
    // enrichment
    manufacturer: string | null;
    // public-pattern signals
    public_nonstationary_flag: boolean;
    public_ssid_variant_flag: boolean;
    // precision caveat
    wigle_precision_warning: boolean;
  };
  localLinkage: {
    has_local_match: boolean;
    local_observation_count: number;
  };
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

export const getWiglePageNetwork = async (netid: string): Promise<WiglePageNetworkResponse> => {
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

  async getWiglePageNetwork(netid: string): Promise<WiglePageNetworkResponse> {
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
