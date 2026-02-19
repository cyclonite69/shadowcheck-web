/**
 * Agency API
 */

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
  bssid: string;
  agencies: AgencyOffice[];
}

export const agencyApi = {
  async getNearestAgenciesBatch(
    bssids: string[],
    radius: number = 250
  ): Promise<Record<string, AgencyOffice[]>> {
    const response = await fetch(`/api/networks/nearest-agencies/batch?radius=${radius}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bssids }),
    });
    return response.json();
  },

  async getNearestAgencies(bssid: string, radius: number): Promise<NearestAgenciesResponse> {
    const response = await fetch(
      `/api/networks/nearest-agencies/${encodeURIComponent(bssid)}?radius=${radius}`
    );
    return response.json();
  },

  async getAgencyOffices(): Promise<any> {
    const response = await fetch('/agency-offices');
    return response.json();
  },
};
