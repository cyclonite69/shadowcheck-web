/**
 * Analytics Service Index
 * Barrel export for analytics modules
 */

const coreAnalytics = require('./coreAnalytics');
const threatAnalytics = require('./threatAnalytics');
const networkAnalytics = require('./networkAnalytics');
const helpers = require('./helpers');

// Re-export all analytics modules
module.exports = {
  ...coreAnalytics,
  ...threatAnalytics,
  ...networkAnalytics,
  ...helpers,
};

// Also export sub-modules for direct access
module.exports.coreAnalytics = coreAnalytics;
module.exports.threatAnalytics = threatAnalytics;
module.exports.networkAnalytics = networkAnalytics;
module.exports.helpers = helpers;
