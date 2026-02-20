/**
 * Analytics API
 */

import { apiClient } from './client';

export const analyticsApi = {
  async getNetworkTypes(): Promise<any> {
    return apiClient.get('/analytics/network-types');
  },

  async getSignalStrength(): Promise<any> {
    return apiClient.get('/analytics/signal-strength');
  },

  async getSecurity(): Promise<any> {
    return apiClient.get('/analytics/security');
  },

  async getTopNetworks(limit: number = 10): Promise<any> {
    return apiClient.get(`/analytics/top-networks?limit=${limit}`);
  },

  async getThreatDistribution(): Promise<any> {
    return apiClient.get('/analytics/threat-distribution');
  },

  async getThreatSeverityCounts(): Promise<any> {
    return apiClient.get('/v2/threats/severity-counts');
  },

  async getTemporalActivity(): Promise<any> {
    return apiClient.get('/analytics/temporal-activity');
  },

  async getRadioTypeOverTime(range: string = 'all'): Promise<any> {
    return apiClient.get(`/analytics/radio-type-over-time?range=${range}`);
  },

  async getThreatTrends(range: string = 'all'): Promise<any> {
    return apiClient.get(`/analytics/threat-trends?range=${range}`);
  },
};
