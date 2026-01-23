/**
 * Route mounting helpers for the main server bootstrap.
 */

/**
 * Mount demo routes (must run before static asset middleware).
 * @param {import('express').Express} app - Express app instance
 * @param {import('express').Router} miscRoutes - Misc/demo routes
 */
function mountDemoRoutes(app, miscRoutes) {
  app.use('/', miscRoutes);
}

/**
 * Mount API and page routes (must run after static assets).
 * @param {import('express').Express} app - Express app instance
 * @param {object} deps - Route dependencies
 * @param {import('express').Router} deps.healthRoutes - Health routes
 * @param {import('express').Router} deps.geospatialRoutes - Geospatial routes
 * @param {import('express').Router} deps.networksRoutes - Networks routes
 * @param {import('express').Router} deps.threatsRoutes - Threats routes
 * @param {import('express').Router} deps.wigleRoutes - WiGLE routes
 * @param {import('express').Router} deps.adminRoutes - Admin routes
 * @param {import('express').Router} deps.explorerRoutes - Explorer routes
 * @param {import('express').Router} deps.mlRoutes - ML routes
 * @param {import('express').Router} deps.analyticsRoutes - Analytics routes
 * @param {object} deps.dashboardRoutes - Dashboard routes module
 * @param {import('express').Router} deps.networksV2Routes - V2 networks routes
 * @param {import('express').Router} deps.filteredRoutes - V2 filtered routes
 * @param {Function} deps.locationMarkersRoutes - Location markers route factory
 * @param {import('express').Router} deps.homeLocationRoutes - Home location routes
 * @param {import('express').Router} deps.keplerRoutes - Kepler routes
 * @param {import('express').Router} deps.backupRoutes - Backup routes
 * @param {import('express').Router} deps.exportRoutes - Export routes
 * @param {import('express').Router} deps.settingsRoutes - Settings routes
 * @param {import('express').Router} deps.networkTagsRoutes - Network tags routes
 * @param {Function} deps.query - Database query function
 */
function mountApiRoutes(app, deps) {
  const {
    healthRoutes,
    geospatialRoutes,
    networksRoutes,
    threatsRoutes,
    wigleRoutes,
    adminRoutes,
    explorerRoutes,
    mlRoutes,
    analyticsRoutes,
    dashboardRoutes,
    networksV2Routes,
    filteredRoutes,
    locationMarkersRoutes,
    homeLocationRoutes,
    keplerRoutes,
    backupRoutes,
    exportRoutes,
    settingsRoutes,
    networkTagsRoutes,
    query,
  } = deps;

  // Health check (no prefix, available at /health)
  app.use('/', healthRoutes);

  // Geospatial routes (includes root redirect)
  app.use('/', geospatialRoutes);

  // API routes
  app.use('/api', networksRoutes);
  app.use('/api', threatsRoutes);
  app.use('/api', wigleRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', explorerRoutes);
  app.use('/api', mlRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api', dashboardRoutes.router);
  app.use('/api/v2/networks/filtered', filteredRoutes);
  app.use('/api', networksV2Routes);
  app.use('/api', locationMarkersRoutes(query));
  app.use('/api', homeLocationRoutes);
  app.use('/api', keplerRoutes);
  app.use('/api', backupRoutes);
  app.use('/api', exportRoutes);
  app.use('/api', settingsRoutes);
  app.use('/api/network-tags', networkTagsRoutes);
}

module.exports = {
  mountDemoRoutes,
  mountApiRoutes,
};
