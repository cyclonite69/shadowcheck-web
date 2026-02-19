/**
 * Location API
 */

interface HomeLocationResponse {
  latitude: number;
  longitude: number;
  radius: number;
}

export const locationApi = {
  async getHomeLocation(): Promise<HomeLocationResponse | null> {
    const response = await fetch('/api/home-location');
    if (!response.ok) return null;
    return response.json();
  },
};
