// Clear PostgreSQL environment variables that might interfere
const { clearPostgresEnv } = require('./src/utils/envSanitizer');
clearPostgresEnv();

(async () => {
  try {
    // ============================================================================
    // 1. CORE DEPENDENCIES
    // ============================================================================
    const { loadCoreDependencies, loadRouteModules } = require('./src/utils/serverDependencies');
    const { logger, express, path } = loadCoreDependencies();

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
    const {
      healthRoutes,
      networksRoutes,
      explorerRoutes,
      threatsRoutes,
      wigleRoutes,
      adminRoutes,
      mlRoutes,
      geospatialRoutes,
      analyticsRoutes,
      networksV2Routes,
      filteredRoutes,
      dashboardRoutes,
      locationMarkersRoutes,
      homeLocationRoutes,
      keplerRoutes,
      backupRoutes,
      exportRoutes,
      settingsRoutes,
      networkTagsRoutes,
      miscRoutes,
    } = loadRouteModules();

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
