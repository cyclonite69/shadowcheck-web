console.log('Starting server...');

// Clear PostgreSQL environment variables that might interfere
delete process.env.PGHOST;
delete process.env.PGPORT;
delete process.env.PGDATABASE;
delete process.env.PGUSER;

(async () => {
  try {
    // ============================================================================
    // 1. CORE DEPENDENCIES
    // ============================================================================
    require('dotenv').config({ override: true });
    const express = require('express');
    const path = require('path');
    const { Pool } = require('pg');
    const cors = require('cors');
    const compression = require('compression');
    const rateLimit = require('express-rate-limit');

    // ============================================================================
    // 2. SECRETS MANAGEMENT
    // ============================================================================
    const { validateSecrets } = require('./src/utils/validateSecrets');
    const secretsManager = require('./src/services/secretsManager');

    await validateSecrets();

    // ============================================================================
    // 3. UTILITIES & ERROR HANDLING
    // ============================================================================
    const errorHandler = require('./utils/errorHandler');

    // ============================================================================
    // 4. ROUTE MODULES
    // ============================================================================
    const healthRoutes = require('./src/api/routes/v1/health');
    const networksRoutes = require('./src/api/routes/v1/networks');
    const threatsRoutes = require('./src/api/routes/v1/threats');
    const wigleRoutes = require('./src/api/routes/v1/wigle');
    const adminRoutes = require('./src/api/routes/v1/admin');
    const mlRoutes = require('./src/api/routes/v1/ml');
    const geospatialRoutes = require('./src/api/routes/v1/geospatial');
    const analyticsRoutes = require('./src/api/routes/v1/analytics');
    const dashboardRoutes = require('./src/api/routes/v1/dashboard');
    const locationMarkersRoutes = require('./src/api/routes/v1/location-markers');
    const backupRoutes = require('./src/api/routes/v1/backup');
    const exportRoutes = require('./src/api/routes/v1/export');
    const settingsRoutes = require('./src/api/routes/v1/settings');

    // ============================================================================
    // 5. APP INITIALIZATION
    // ============================================================================
    const app = express();
    const port = process.env.PORT || 3001;
    const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';

    // ============================================================================
    // 6. MIDDLEWARE SETUP
    // ============================================================================

    // Request ID middleware (first, so all requests have IDs)
    const requestIdMiddleware = require('./src/middleware/requestId');
    app.use(requestIdMiddleware);

    // HTTPS redirect (if enabled)
    if (FORCE_HTTPS) {
      app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https' && req.hostname !== 'localhost') {
          return res.redirect(301, `https://${req.hostname}${req.url}`);
        }
        next();
      });
    }

    // Security headers
    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      if (FORCE_HTTPS) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://api.mapbox.com; " +
      "worker-src 'self' blob:; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://api.mapbox.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com;"
      );
      next();
    });

    // Compression
    app.use(compression());

    // CORS
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:3001', 'http://127.0.0.1:3001'];

    app.use(cors({
      origin: function (origin, callback) {
        if (!origin) {return callback(null, true);}
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }));

    // Rate limiting
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      message: 'Too many requests from this IP, please try again after 15 minutes',
    });
    app.use('/api/', apiLimiter);

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // ============================================================================
    // 7. DATABASE SETUP
    // ============================================================================
    const pool = new Pool({
      user: process.env.DB_USER,
      host: '127.0.0.1',
      database: process.env.DB_NAME,
      password: secretsManager.getOrThrow('db_password'),
      port: 5432,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      application_name: 'shadowcheck-static',
      options: '-c search_path=public',
    });

    pool.on('connect', (client) => {
      console.log('Pool connected:', client.host, client.port);
    });

    pool.on('error', (err) => {
      console.error('Pool error:', err.message);
    });

    // Test database connection (non-blocking)
    (async () => {
      try {
        const client = await pool.connect();
        try {
          await client.query('SELECT NOW()');
          console.log('✓ Database connected successfully');
        } finally {
          client.release();
        }
      } catch (err) {
        console.warn('⚠️  Database connection test failed:', err.message);
        console.warn('⚠️  Server will continue - database will be retried on first request');
      }
    })();

    // ============================================================================
    // 8. STATIC FILES
    // ============================================================================
    app.use(express.static(path.join(__dirname, 'public'), {
      maxAge: '1h',
      etag: true,
    }));

    // ============================================================================
    // 9. ROUTE MOUNTING
    // ============================================================================

    // Make secretsManager available to routes
    app.locals.secretsManager = secretsManager;

    // Import database query function for routes that need it
    const { query } = require('./src/config/database');

    // Initialize dashboard routes with dependencies
    const NetworkRepository = require('./src/repositories/networkRepository');
    const DashboardService = require('./src/services/dashboardService');
    const networkRepository = new NetworkRepository();
    const dashboardService = new DashboardService(networkRepository);
    dashboardRoutes.initDashboardRoutes({ dashboardService });

    // Health check (no prefix, available at /health)
    app.use('/', healthRoutes);

    // Geospatial routes (includes root redirect)
    app.use('/', geospatialRoutes);

    // API routes
    app.use('/api', networksRoutes);
    app.use('/api', threatsRoutes);
    app.use('/api', wigleRoutes);
    app.use('/api', adminRoutes);
    app.use('/api', mlRoutes);
    app.use('/api', analyticsRoutes);
    app.use('/api', dashboardRoutes.router);
    app.use('/api', locationMarkersRoutes(query));
    app.use('/api', backupRoutes);
    app.use('/api', exportRoutes);
    app.use('/api', settingsRoutes);

    console.log('✓ All routes mounted successfully');

    // ============================================================================
    // 10. ERROR HANDLING
    // ============================================================================
    app.use(errorHandler);

    // ============================================================================
    // 11. SERVER STARTUP
    // ============================================================================
    app.listen(port, () => {
      console.log(`✓ Server listening on port ${port}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ HTTPS redirect: ${FORCE_HTTPS ? 'enabled' : 'disabled'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, closing server gracefully...');
      await pool.end();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\nSIGINT received, closing server gracefully...');
      await pool.end();
      process.exit(0);
    });

  } catch (err) {
    console.error('✗ Fatal error starting server:', err);
    process.exit(1);
  }
})();
