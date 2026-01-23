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
    const { registerErrorHandlers } = require('./src/utils/errorHandlingInit');
    const { mountDemoRoutes } = require('./src/utils/routeMounts');
    const { getServerConfig } = require('./src/utils/serverConfig');
    const { startServer } = require('./src/utils/serverStartup');
    const { initializeMiddleware } = require('./src/utils/middlewareInit');
    const { initializeDatabaseConnection } = require('./src/utils/databaseSetup');
    const { mountStaticAssets, registerSpaFallback } = require('./src/utils/staticSetup');
    const { initializeRoutes } = require('./src/utils/routesInit');
    const { initializeLifecycle } = require('./src/utils/serverLifecycle');

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
    const { pool, query } = await initializeDatabaseConnection(logger);

    // ============================================================================
    // 8. DEMO ROUTES (before static files)
    // ============================================================================
    mountDemoRoutes(app, miscRoutes);

    // ============================================================================
    // 9. STATIC FILES
    // ============================================================================
    const distPath = path.join(__dirname, 'dist');
    mountStaticAssets(app, distPath);

    // ============================================================================
    // 10. ROUTE MOUNTING
    // ============================================================================
    initializeRoutes(app, {
      routes: {
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
      },
      query,
      secretsManager,
      logger,
    });

    // Initialize background jobs and shutdown handlers
    await initializeLifecycle({ logger, pool });

    // ============================================================================
    // 10. SPA FALLBACK (React Router support)
    // ============================================================================
    // Serve index.html for all non-API routes (must be after API routes)
    registerSpaFallback(app, distPath);

    // ============================================================================
    // 11. ERROR HANDLING
    // ============================================================================
    registerErrorHandlers(app, logger);

    // ============================================================================
    // 12. SERVER STARTUP
    // ============================================================================
    startServer(app, {
      port,
      host,
      forceHttps,
      logger,
    });
  } catch (err) {
    console.error(err); // PRINT STACK TRACE
    const logger = require('./src/logging/logger');
    logger.error(`Fatal error starting server: ${err.message}`, { error: err });
    process.exit(1);
  }
})();
