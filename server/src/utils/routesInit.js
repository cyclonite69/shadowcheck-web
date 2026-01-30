/**
 * Route initialization helpers.
 */

/**
 * Initialize API routes and their dependencies.
 * @param {import('express').Express} app - Express app instance
 * @param {{
 *   routes: {
 *     healthRoutes: import('express').Router,
 *     geospatialRoutes: import('express').Router,
 *     networksRoutes: import('express').Router,
 *     threatsRoutes: import('express').Router,
 *     wigleRoutes: import('express').Router,
 *     adminRoutes: import('express').Router,
 *     explorerRoutes: import('express').Router,
 *     mlRoutes: import('express').Router,
 *     analyticsRoutes: import('express').Router,
 *     dashboardRoutes: object,
 *     networksV2Routes: import('express').Router,
 *     filteredRoutes: import('express').Router,
 *     locationMarkersRoutes: Function,
 *     homeLocationRoutes: import('express').Router,
 *     keplerRoutes: import('express').Router,
 *     backupRoutes: import('express').Router,
 *     exportRoutes: import('express').Router,
 *     settingsRoutes: import('express').Router,
 *     networkTagsRoutes: import('express').Router
 *   },
 *   query: Function,
 *   secretsManager: object,
 *   logger: object
 * }} options - Initialization options
 */
function initializeRoutes(app, options) {
  const { routes, query, secretsManager, logger } = options;

  // Make secretsManager available to routes
  app.locals.secretsManager = secretsManager;

  const { initializeDashboardRoutes } = require('./dashboardInit');
  initializeDashboardRoutes(routes.dashboardRoutes);

  const { mountApiRoutes } = require('./routeMounts');
  mountApiRoutes(app, {
    healthRoutes: routes.healthRoutes,
    geospatialRoutes: routes.geospatialRoutes,
    networksRoutes: routes.networksRoutes,
    threatsRoutes: routes.threatsRoutes,
    wigleRoutes: routes.wigleRoutes,
    adminRoutes: routes.adminRoutes,
    explorerRoutes: routes.explorerRoutes,
    mlRoutes: routes.mlRoutes,
    analyticsRoutes: routes.analyticsRoutes,
    dashboardRoutes: routes.dashboardRoutes,
    networksV2Routes: routes.networksV2Routes,
    threatsV2Routes: routes.threatsV2Routes,
    filteredRoutes: routes.filteredRoutes,
    locationMarkersRoutes: routes.locationMarkersRoutes,
    homeLocationRoutes: routes.homeLocationRoutes,
    keplerRoutes: routes.keplerRoutes,
    backupRoutes: routes.backupRoutes,
    exportRoutes: routes.exportRoutes,
    analyticsPublicRoutes: routes.analyticsPublicRoutes,
    settingsRoutes: routes.settingsRoutes,
    networkTagsRoutes: routes.networkTagsRoutes,
    authRoutes: routes.authRoutes,
    query,
  });

  logger.info('All routes mounted successfully');
}

module.exports = {
  initializeRoutes,
};
