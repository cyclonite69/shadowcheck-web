/**
 * Agency API
 */

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

export interface AlprCameraProperties {
  id: string;
  osm_id: string;
  manufacturer: string | null;
  direction: string | null;
  camera_type: string | null;
  surveillance_zone: string | null;
  camera_mount: string | null;
  operator: string | null;
  electricity: string | null;
}

export interface AlprCameraFeature {
  type: 'Feature';
  id: number | string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: AlprCameraProperties;
}

export interface AlprCamerasGeoJSON {
  type: 'FeatureCollection';
  features: AlprCameraFeature[];
}

export const agencyApi = {
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

  async getAlprCameras(): Promise<AlprCamerasGeoJSON> {
    const response = await fetch('/api/v1/surveillance/alpr-cameras', {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch ALPR cameras');
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
