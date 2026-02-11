/**
 * Analytics Service Layer
 * Encapsulates business logic for analytics operations
 *
 * Modular structure:
 * - analytics/coreAnalytics.js: temporal, signal, type queries
 * - analytics/threatAnalytics.js: security & threat analytics
 * - analytics/networkAnalytics.js: manufacturer, channel, counts
 * - analytics/helpers.js: utilities & normalization
 * - analytics/index.js: barrel export
 */

// Re-export all from analytics subdirectory
const analytics = require('./analytics');

/**
 * Bulk retrieve analytics data
 * Optimized for dashboard loading
 */
async function getBulkAnalytics() {
  const [networkTypes, signalStrength, security, topNetworks, dashStats] = await Promise.all([
    analytics.getNetworkTypes(),
    analytics.getSignalStrengthDistribution(),
    analytics.getSecurityDistribution(),
    analytics.getTopNetworks(50),
    analytics.getDashboardStats(),
  ]);

  return {
    dashboard: dashStats,
    networkTypes,
    signalStrength,
    security,
    topNetworks,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  ...analytics,
  getBulkAnalytics,
};
