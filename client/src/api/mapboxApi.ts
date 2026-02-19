/**
 * Mapbox API
 */

interface MapboxTokenResponse {
  token: string;
  error?: string;
}

interface GeocodingFeature {
  id: string;
  type: string;
  place_type: string[];
  relevance: number;
  properties: Record<string, unknown>;
  text: string;
  place_name: string;
  center: [number, number];
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  context?: Array<{
    id: string;
    text: string;
  }>;
}

interface GeocodingResponse {
  type: string;
  query: string[];
  features: GeocodingFeature[];
  attribution: string;
}

export const mapboxApi = {
  async getMapboxToken(): Promise<MapboxTokenResponse> {
    const response = await fetch('/api/mapbox-token');
    return response.json();
  },

  async exportKML(bssids: string): Promise<string> {
    const url = `/api/kml?bssids=${encodeURIComponent(bssids)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to export KML');
    return response.text();
  },

  async geocodeSearch(
    query: string,
    token: string,
    params?: Record<string, string>
  ): Promise<GeocodingResponse> {
    const searchParams = new URLSearchParams({
      access_token: token,
      ...params,
    });
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${searchParams.toString()}`
    );
    return response.json();
  },
};
