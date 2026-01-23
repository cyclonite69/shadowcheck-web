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
    const { createSecurityHeaders } = require('./src/middleware/securityHeaders');
    const { mountCommonMiddleware } = require('./src/middleware/commonMiddleware');

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
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || '0.0.0.0';
    const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';

    // ============================================================================
    // 6. MIDDLEWARE SETUP
    // ============================================================================

    // Request ID middleware (first, so all requests have IDs)
    const requestIdMiddleware = require('./src/middleware/requestId');
    app.use(requestIdMiddleware);

    // HTTPS redirect (if enabled)
    if (FORCE_HTTPS) {
      const { createHttpsRedirect } = require('./src/middleware/httpsRedirect');
      app.use(createHttpsRedirect());
    }

    app.use(createSecurityHeaders(FORCE_HTTPS));

    // CORS
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3001', 'http://127.0.0.1:3001'];

    mountCommonMiddleware(app, { allowedOrigins });

    // ============================================================================
    // 7. DATABASE SETUP
    // ============================================================================
    const { pool, query, testConnection } = require('./src/config/database');

    const { initializeDatabase } = require('./src/utils/databaseInit');
    await initializeDatabase({ pool, testConnection, logger });

    // ============================================================================
    // 8. DEMO ROUTES (before static files)
    // ============================================================================
    app.use('/', miscRoutes);

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
    app.listen(port, host, () => {
      logger.info(`Server listening on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`HTTPS redirect: ${FORCE_HTTPS ? 'enabled' : 'disabled'}`);
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
