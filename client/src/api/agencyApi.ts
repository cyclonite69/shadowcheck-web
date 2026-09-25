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

export interface DeflockCameraProperties {
  id: number;
  city: string | null;
  state: string | null;
  source: string;
  source_id: string | null;
  camera_type: string | null;
  agency: string | null;
  operator: string | null;
  name: string | null;
  address: string | null;
  street: string | null;
  housenumber: string | null;
  postcode: string | null;
  country: string | null;
  manufacturer: string | null;
  manufacturer_wikidata: string | null;
  direction: string | null;
  camera_mount: string | null;
  surveillance: string | null;
  surveillance_type: string | null;
  surveillance_zone: string | null;
  electricity: string | null;
  website: string | null;
}

export interface DeflockCameraFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: DeflockCameraProperties;
}

export interface DeflockCamerasGeoJSON {
  type: 'FeatureCollection';
  features: DeflockCameraFeature[];
}

/** Single agency row returned from the batch nearest-agencies endpoint. */
export interface AgencyMatch {
  cluster_id?: number;
  cluster_count?: number;
  cluster_lat?: number;
  cluster_lon?: number;
  has_wigle_obs?: boolean;
  has_local_obs?: boolean;
  id?: number;
  name?: string | null;
  office_type?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_meters?: number;
}

interface NearestAgenciesBatchResponse {
  ok: boolean;
  bssids: string[];
  agencies: AgencyMatch[];
  count: number;
  radius_km: number;
}

export interface CourthouseMatch {
  cluster_id?: number;
  cluster_count?: number;
  cluster_lat?: number;
  cluster_lon?: number;
  has_wigle_obs?: boolean;
  has_local_obs?: boolean;
  id?: number | null;
  name?: string | null;
  short_name?: string | null;
  courthouse_type?: string | null;
  district?: string | null;
  circuit?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_meters?: number;
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

  async getNearestCourthousesBatch(
    bssids: string[],
    radius: number = 250
  ): Promise<{ ok: boolean; courthouses: CourthouseMatch[]; count: number; radius_km: number }> {
    return apiClient.post(`/networks/nearest-courthouses/batch?radius=${radius}`, { bssids });
  },

  // Agency Offices (GeoJSON)
  async getAgencyOffices(): Promise<any> {
    const response = await fetch('/agency-offices', { credentials: 'include' });
    if (!response.ok) {
      throw new Error('Failed to fetch agency offices');
    }
    return response.json();
  },

  async getFederalCourthouses(): Promise<any> {
    const response = await fetch('/federal-courthouses', { credentials: 'include' });
    if (!response.ok) {
      throw new Error('Failed to fetch federal courthouses');
    }
    return response.json();
  },

  async getDeflockCameras(): Promise<DeflockCamerasGeoJSON> {
    const response = await fetch('/api/v1/surveillance/deflock-cameras', {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch DeFlock cameras');
    }
    return response.json();
  },

  async getShotspotterSensors(): Promise<any> {
    const response = await fetch('/api/v1/surveillance/shotspotter-sensors', {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch ShotSpotter sensors');
    }
    return response.json();
  },
};
