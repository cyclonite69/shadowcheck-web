class DashboardService {
  constructor(networkRepository) {
    this.networkRepository = networkRepository;
  }

  async getMetrics() {
    try {
      const metrics = await this.networkRepository.getDashboardMetrics();
      return {
        ...metrics,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  async getThreats() {
    try {
      const networks = await this.networkRepository.getThreatenedNetworks();

      return networks
        .sort((a, b) => (b.threatScore || 0) - (a.threatScore || 0))
        .slice(0, 100)
        .map((n) => ({
          bssid: n.bssid,
          ssid: n.ssid,
          threatScore: n.threatScore,
          threatLevel: n.threatLevel,
          type: n.type,
          signal: n.signal,
          observations: n.observations,
          lastSeen: n.lastSeen,
        }));
    } catch (error) {
      console.error('Error getting threats:', error);
      throw error;
    }
  }

  async getNetworkDistribution() {
    try {
      const metrics = await this.networkRepository.getDashboardMetrics();

      return {
        wifi: metrics.wifiCount,
        ble: metrics.bleCount,
        bluetooth: metrics.bluetoothCount,
        lte: metrics.lteCount,
        total: metrics.totalNetworks,
      };
    } catch (error) {
      console.error('Error getting network distribution:', error);
      throw error;
    }
  }
}

module.exports = DashboardService;
