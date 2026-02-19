/**
 * Analytics API
 */

export const analyticsApi = {
  async getNetworkTypes(): Promise<any> {
    const response = await fetch('/api/analytics/network-types');
    return response.json();
  },

  async getSignalStrength(): Promise<any> {
    const response = await fetch('/api/analytics/signal-strength');
    return response.json();
  },

  async getSecurity(): Promise<any> {
    const response = await fetch('/api/analytics/security');
    return response.json();
  },

  async getTopNetworks(limit: number = 10): Promise<any> {
    const response = await fetch(`/api/analytics/top-networks?limit=${limit}`);
    return response.json();
  },

  async getThreatDistribution(): Promise<any> {
    const response = await fetch('/api/analytics/threat-distribution');
    return response.json();
  },

  async getThreatSeverityCounts(): Promise<any> {
    const response = await fetch('/api/v2/threats/severity-counts');
    return response.json();
  },

  async getTemporalActivity(): Promise<any> {
    const response = await fetch('/api/analytics/temporal-activity');
    return response.json();
  },

  async getRadioTypeOverTime(range: string = 'all'): Promise<any> {
    const response = await fetch(`/api/analytics/radio-type-over-time?range=${range}`);
    return response.json();
  },

  async getThreatTrends(range: string = 'all'): Promise<any> {
    const response = await fetch(`/api/analytics/threat-trends?range=${range}`);
    return response.json();
  },
};
