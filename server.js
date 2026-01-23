// Clear PostgreSQL environment variables that might interfere
const { clearPostgresEnv } = require('./src/utils/envSanitizer');
clearPostgresEnv();

(async () => {
  try {
    // ============================================================================
    // 1. CORE DEPENDENCIES
    // ============================================================================
    require('dotenv').config({ override: true });
    const logger = require('./src/logging/logger');
    const express = require('express');
    const path = require('path');

    logger.info('Starting server...');

    // ============================================================================
    // 2. SECRETS MANAGEMENT
    // ============================================================================
    const { validateSecrets } = require('./src/utils/validateSecrets');
    const secretsManager = require('./src/services/secretsManager');

    await validateSecrets();

    // ============================================================================
    // 3. UTILITIES & ERROR HANDLING
    // ============================================================================
    const { createErrorHandler, notFoundHandler } = require('./src/errors/errorHandler');
    const { mountDemoRoutes, mountApiRoutes } = require('./src/utils/routeMounts');
    const { getServerConfig } = require('./src/utils/serverConfig');
    const { startServer } = require('./src/utils/serverStartup');
    const { initializeMiddleware } = require('./src/utils/middlewareInit');

    // ============================================================================
    // 4. ROUTE MODULES
    // ============================================================================
    const healthRoutes = require('./src/api/routes/v1/health');
    const networksRoutes = require('./src/api/routes/v1/networks');
    const explorerRoutes = require('./src/api/routes/v1/explorer');
    const threatsRoutes = require('./src/api/routes/v1/threats');
    const wigleRoutes = require('./src/api/routes/v1/wigle');
    const adminRoutes = require('./src/api/routes/v1/admin');
    const mlRoutes = require('./src/api/routes/v1/ml');
    const geospatialRoutes = require('./src/api/routes/v1/geospatial');
    const analyticsRoutes = require('./src/api/routes/v1/analytics');
    const networksV2Routes = require('./src/api/routes/v2/networks');
    const filteredRoutes = require('./src/api/routes/v2/filtered');
    const dashboardRoutes = require('./src/api/routes/v1/dashboard');
    const locationMarkersRoutes = require('./src/api/routes/v1/location-markers');
    const homeLocationRoutes = require('./src/api/routes/v1/home-location');
    const keplerRoutes = require('./src/api/routes/v1/kepler');
    const backupRoutes = require('./src/api/routes/v1/backup');
    const exportRoutes = require('./src/api/routes/v1/export');
    const settingsRoutes = require('./src/api/routes/v1/settings');
    const networkTagsRoutes = require('./src/api/routes/v1/network-tags');
    const miscRoutes = require('./src/api/routes/v1/misc');

    // ============================================================================
    // 5. APP INITIALIZATION
    // ============================================================================
    const app = express();
    const { port, host, forceHttps, allowedOrigins } = getServerConfig();

    // ============================================================================
    // 6. MIDDLEWARE SETUP
    // ============================================================================
    initializeMiddleware(app, { forceHttps, allowedOrigins });

    // ============================================================================
    // 7. DATABASE SETUP
    // ============================================================================
    const { pool, query, testConnection } = require('./src/config/database');

    const { initializeDatabase } = require('./src/utils/databaseInit');
    await initializeDatabase({ pool, testConnection, logger });

    // ============================================================================
    // 8. DEMO ROUTES (before static files)
    // ============================================================================
    mountDemoRoutes(app, miscRoutes);

    // ============================================================================
    // 9. STATIC FILES
    // ============================================================================
    const { mountStaticAssets } = require('./src/middleware/staticAssets');
    mountStaticAssets(app, path.join(__dirname, 'dist'));

    // ============================================================================
    // 10. ROUTE MOUNTING
    // ============================================================================

    // Make secretsManager available to routes
    app.locals.secretsManager = secretsManager;

    // Initialize dashboard routes with dependencies
    const { initializeDashboardRoutes } = require('./src/utils/dashboardInit');
    initializeDashboardRoutes(dashboardRoutes);

    mountApiRoutes(app, {
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
    });

    logger.info('All routes mounted successfully');

    // Initialize background jobs
    const { initializeBackgroundJobs } = require('./src/utils/backgroundJobsInit');
    await initializeBackgroundJobs();

    // ============================================================================
    // 10. SPA FALLBACK (React Router support)
    // ============================================================================
    // Serve index.html for all non-API routes (must be after API routes)
    const { createSpaFallback } = require('./src/middleware/spaFallback');
    app.get('*', createSpaFallback(path.join(__dirname, 'dist')));

    // ============================================================================
    // 11. ERROR HANDLING
    // ============================================================================
    app.use(notFoundHandler);
    app.use(createErrorHandler(logger));

    // ============================================================================
    // 12. SERVER STARTUP
    // ============================================================================
    startServer(app, {
      port,
      host,
      forceHttps,
      logger,
    });

    // Graceful shutdown
    const { registerShutdownHandlers } = require('./src/utils/shutdownHandlers');
    registerShutdownHandlers({ logger, pool });
  } catch (err) {
    console.error(err); // PRINT STACK TRACE
    const logger = require('./src/logging/logger');
    logger.error(`Fatal error starting server: ${err.message}`, { error: err });
    process.exit(1);
  }
})();
