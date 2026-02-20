/**
 * Location API
 */

import { apiClient } from './client';

interface HomeLocationResponse {
  latitude: number;
  longitude: number;
  radius: number;
}

export const locationApi = {
  async getHomeLocation(): Promise<HomeLocationResponse | null> {
    try {
      return await apiClient.get<HomeLocationResponse>('/home-location');
    } catch {
      return null;
    }
  },
};
