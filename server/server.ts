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
    const { initializeCredentials } = require('./src/core/initialization/credentialsInit');
    const secretsManager = await initializeCredentials();

    // ============================================================================
    // 3. UTILITIES & ERROR HANDLING
    // ============================================================================
    const { registerErrorHandlers } = require('./src/core/initialization/errorHandlingInit');
    const { mountDemoRoutes } = require('./src/utils/routeMounts');
    const { startServer } = require('./src/utils/serverStartup');
    const { initializeMiddleware } = require('./src/core/initialization/middlewareInit');
    const { initializeDatabaseConnection } = require('./src/utils/databaseSetup');
    const { mountStaticAssets, registerSpaFallback } = require('./src/utils/staticSetup');
    const { initializeRoutes } = require('./src/core/initialization/routesInit');
    const { initializeLifecycle } = require('./src/utils/serverLifecycle');
    const { initializeApp } = require('./src/core/initialization/appInit');
    const { authService, cacheService } = require('./src/config/container');

    // ============================================================================
    // 4. APP INITIALIZATION
    // ============================================================================
    const { app, port, host, forceHttps, allowedOrigins } = initializeApp(express);

    // ============================================================================
    // 5. SECRETS VALIDATION (must happen before loading routes/database)
    // ============================================================================
    const { validateSecrets } = require('./src/utils/validateSecrets');
    await validateSecrets({ secretsManager, logger, exit: process.exit });

    // ============================================================================
    // 6. ROUTE MODULES (after secrets loaded)
    // ============================================================================
    const routes = loadRouteModules();

    // ============================================================================
    // 7. MIDDLEWARE SETUP
    // ============================================================================
    initializeMiddleware(app, { forceHttps, allowedOrigins });

    // ============================================================================
    // 8. DATABASE SETUP
    // ============================================================================
    const { pool, query } = await initializeDatabaseConnection(logger);
    const mobileIngestService = require('./src/services/mobileIngestService').default;
    await mobileIngestService.recoverStuckUploads();

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
      authService,
      cacheService,
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
    cacheService.connect().catch((err: Error) => {
      logger.warn('Redis connection failed, caching disabled', { error: err.message });
    });

    // ============================================================================
    // 13. SERVER STARTUP
    // ============================================================================
    const server = startServer(app, {
      port,
      host,
      forceHttps,
      allowedOrigins,
      logger,
    });

    // ============================================================================
    // 14. SSM WEBSOCKET TERMINAL
    // ============================================================================
    const { initializeSsmWebSocket } = require('./src/websocket/ssmTerminal');
    initializeSsmWebSocket(server, logger);
  } catch (err) {
    console.error(err); // PRINT STACK TRACE
    const logger = require('./src/logging/logger');
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Fatal error starting server: ${errorMessage}`, { error: err });
    process.exit(1);
  }
})();
