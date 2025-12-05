/**
 * Dashboard service
 * Business logic for dashboard operations
 */

class DashboardService {
  constructor(networkRepository) {
    this.networkRepository = networkRepository;
  }

  /**
   * Get dashboard metrics
   * Aggregates various statistics for the dashboard
   * @returns {Promise<Object>} Dashboard metrics
   */
  async getMetrics() {
    try {
      const metrics = await this.networkRepository.getDashboardMetrics();

      // Add any business logic transformations here
      // For example, calculate percentages, trends, etc.

      return {
        totalNetworks: metrics.totalNetworks,
        threatsCount: metrics.threatsCount,
        surveillanceCount: metrics.surveillanceCount,
        enrichedCount: metrics.enrichedCount,
        wifiCount: metrics.wifiCount,
        btCount: metrics.btCount,
        bleCount: metrics.bleCount,
        lteCount: metrics.lteCount,
        gsmCount: metrics.gsmCount,
        // Could add derived metrics:
        // enrichmentPercentage: Math.round((metrics.enrichedCount / metrics.totalNetworks) * 100),
        // threatPercentage: Math.round((metrics.threatsCount / metrics.totalNetworks) * 100),
      };
    } catch (err) {
      console.error('DashboardService: Error fetching metrics', err);
      throw new Error('Failed to fetch dashboard metrics');
    }
  }

  /**
   * Get dashboard summary with additional context
   * @returns {Promise<Object>}
   */
  async getSummary() {
    const metrics = await this.getMetrics();

    return {
      ...metrics,
      summary: {
        hasThreats: metrics.threatsCount > 0,
        hasSurveillance: metrics.surveillanceCount > 0,
        enrichmentRate: metrics.totalNetworks > 0
          ? Math.round((metrics.enrichedCount / metrics.totalNetworks) * 100)
          : 0,
      },
    };
  }
}

module.exports = DashboardService;
