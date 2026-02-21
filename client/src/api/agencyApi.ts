/**
 * Agency API
 */

import { apiClient } from './client';

interface AgencyOffice {
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  website: string;
  latitude: number;
  longitude: number;
  distance_meters?: number;
}

interface NearestAgenciesResponse {
  ok: boolean;
  bssid: string;
  agencies: AgencyOffice[];
  count: number;
  radius_km: number;
}

interface NearestAgenciesBatchResponse {
  ok: boolean;
  bssids: string[];
  agencies: AgencyOffice[];
  count: number;
  radius_km: number;
}

export const agencyApi = {
  async getNearestAgenciesBatch(
    bssids: string[],
    radius: number = 250
  ): Promise<NearestAgenciesBatchResponse> {
    return apiClient.post<NearestAgenciesBatchResponse>(
      `/networks/nearest-agencies/batch?radius=${radius}`,
      { bssids }
    );
  },

  async getNearestAgencies(bssid: string, radius: number): Promise<NearestAgenciesResponse> {
    return apiClient.get<NearestAgenciesResponse>(
      `/networks/nearest-agencies/${encodeURIComponent(bssid)}?radius=${radius}`
    );
  },

  // Static file at root (not under /api/) — raw fetch
  async getAgencyOffices(): Promise<any> {
    const response = await fetch('/agency-offices', { credentials: 'include' });
    return response.json();
  },
};
