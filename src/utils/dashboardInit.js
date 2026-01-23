/**
 * Initialize dashboard routes with required dependencies.
 * @param {{ initDashboardRoutes: Function }} dashboardRoutes - Dashboard routes module
 */
function initializeDashboardRoutes(dashboardRoutes) {
  const NetworkRepository = require('../repositories/networkRepository');
  const DashboardService = require('../services/dashboardService');
  const networkRepository = new NetworkRepository();
  const dashboardService = new DashboardService(networkRepository);
  dashboardRoutes.initDashboardRoutes({ dashboardService });
}

module.exports = { initializeDashboardRoutes };
