/**
 * Dashboard routes initialization.
 */

interface DashboardRoutesModule {
  initDashboardRoutes: (deps: { dashboardService: unknown }) => void;
  router: unknown;
}

/**
 * Initialize dashboard routes with required dependencies.
 */
function initializeDashboardRoutes(dashboardRoutes: DashboardRoutesModule): void {
  const NetworkRepository = require('../repositories/networkRepository');
  const DashboardService = require('../services/dashboardService');
  const networkRepository = new NetworkRepository();
  const dashboardService = new DashboardService(networkRepository);
  dashboardRoutes.initDashboardRoutes({ dashboardService });
}

export { initializeDashboardRoutes, DashboardRoutesModule };
