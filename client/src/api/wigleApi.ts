/**
 * WiGLE API
 */

export const wigleApi = {
  // WiGLE API Status
  async getApiStatus(): Promise<any> {
    const res = await fetch('/api/wigle/api-status');
    return res.json();
  },

  // WiGLE Search
  async searchWigle(params: URLSearchParams): Promise<any> {
    const res = await fetch(`/api/wigle/search-api?${params.toString()}`, {
      credentials: 'same-origin',
    });
    return res.json();
  },

  // WiGLE Detail
  async getWigleObservations(netid: string): Promise<any> {
    const res = await fetch(`/api/wigle/observations/${encodeURIComponent(netid)}`);
    return res.json();
  },

  async getWigleDetail(
    bssid: string,
    isBluetooth: boolean,
    importData: boolean = true
  ): Promise<any> {
    const endpoint = isBluetooth
      ? `/api/wigle/detail/bt/${encodeURIComponent(bssid)}`
      : `/api/wigle/detail/${encodeURIComponent(bssid)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ import: importData }),
    });
    return response.json();
  },

  // WiGLE Import
  async importWigleV3(formData: FormData): Promise<any> {
    const res = await fetch('/api/wigle/import/v3', {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  // Network WiGLE Observations
  async getNetworkWigleObservations(bssid: string): Promise<any> {
    const response = await fetch(`/api/networks/${encodeURIComponent(bssid)}/wigle-observations`);
    return response.json();
  },

  // Mapbox Token (for WiGLE map)
  async getMapboxToken(): Promise<any> {
    const tokenRes = await fetch('/api/mapbox-token');
    return tokenRes.json();
  },

  // Local WiGLE Database Search
  async searchLocalWigle(endpoint: string, params: URLSearchParams): Promise<any> {
    const res = await fetch(`${endpoint}?${params.toString()}`);
    return res.json();
  },
};
