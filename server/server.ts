// Register TypeScript support with transpile-only mode to avoid type checking issues
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
  },
});

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
    const { initializeCredentials } = require('./src/utils/credentialsInit');
    const secretsManager = await initializeCredentials();

    // ============================================================================
    // 3. UTILITIES & ERROR HANDLING
    // ============================================================================
    const { registerErrorHandlers } = require('./src/utils/errorHandlingInit');
    const { mountDemoRoutes } = require('./src/utils/routeMounts');
    const { startServer } = require('./src/utils/serverStartup');
    const { initializeMiddleware } = require('./src/utils/middlewareInit');
    const { initializeDatabaseConnection } = require('./src/utils/databaseSetup');
    const { mountStaticAssets, registerSpaFallback } = require('./src/utils/staticSetup');
    const { initializeRoutes } = require('./src/utils/routesInit');
    const { initializeLifecycle } = require('./src/utils/serverLifecycle');
    const { initializeApp } = require('./src/utils/appInit');

    // ============================================================================
    // 4. ROUTE MODULES
    // ============================================================================
    const routes = loadRouteModules();

    // ============================================================================
    // 5. APP INITIALIZATION
    // ============================================================================
    const { app, port, host, forceHttps, allowedOrigins } = initializeApp(express);

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
    mountDemoRoutes(app, routes.miscRoutes);

    // ============================================================================
    // 9. STATIC FILES
    // ============================================================================
    const distPath = process.env.FRONTEND_DIST || path.resolve(process.cwd(), 'dist');
    mountStaticAssets(app, distPath);

    // ============================================================================
    // 10. ROUTE MOUNTING
    // ============================================================================
    initializeRoutes(app, {
      routes,
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
    // 12. REDIS CACHE (OPTIONAL)
    // ============================================================================
    const { cacheService } = require('./src/services/cacheService');
    cacheService.connect().catch((err: Error) => {
      logger.warn('Redis connection failed, caching disabled', { error: err.message });
    });

    // ============================================================================
    // 13. SERVER STARTUP
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
