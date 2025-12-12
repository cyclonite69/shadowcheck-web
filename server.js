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
    const explorerRoutes = require('./src/api/routes/v1/explorer');
    const threatsRoutes = require('./src/api/routes/v1/threats');
    const wigleRoutes = require('./src/api/routes/v1/wigle');
    const adminRoutes = require('./src/api/routes/v1/admin');
    const mlRoutes = require('./src/api/routes/v1/ml');
    const geospatialRoutes = require('./src/api/routes/v1/geospatial');
    const analyticsRoutes = require('./src/api/routes/v1/analytics');
    const networksV2Routes = require('./src/api/routes/v2/networks');
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
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://api.mapbox.com; " +
          "worker-src 'self' blob:; " +
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://api.mapbox.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: https:; " +
          "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://d1a3f4spazzrp4.cloudfront.net;"
      );
      next();
    });

    // Compression
    app.use(compression());

    // CORS
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3001', 'http://127.0.0.1:3001'];

    app.use(
      cors({
        origin: function (origin, callback) {
          if (!origin) {
            return callback(null, true);
          }
          if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
      })
    );

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
    // Serve built React app
    app.use(
      express.static(path.join(__dirname, 'dist'), {
        maxAge: '1h',
        etag: true,
      })
    );

    // Fallback to old public files for legacy endpoints
    app.use(
      '/legacy',
      express.static(path.join(__dirname, 'public'), {
        maxAge: '1h',
        etag: true,
      })
    );

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
    app.use('/api', explorerRoutes);
    app.use('/api', mlRoutes);
    app.use('/api', analyticsRoutes);
    app.use('/api', dashboardRoutes.router);
    app.use('/api', networksV2Routes);
    app.use('/api', locationMarkersRoutes(query));
    app.use('/api', backupRoutes);
    app.use('/api', exportRoutes);
    app.use('/api', settingsRoutes);

    // Kepler.gl data endpoint
    app.get('/api/kepler/data', async (req, res) => {
      try {
        const { bbox, limit } = req.query;

        let queryText = `
          SELECT bssid, 
                 COALESCE(ssid, 'Hidden Network') as ssid,
                 ST_AsGeoJSON(location)::json as geometry,
                 bestlevel, max_signal, first_seen, last_seen, 
                 COALESCE(manufacturer, 'Unknown') as manufacturer, 
                 COALESCE(device_type, 'Unknown') as device_type, 
                 COALESCE(encryption, 'Open/Unknown') as encryption,
                 COALESCE(channel::text, 'Unknown') as channel,
                 COALESCE(frequency::text, 'Unknown') as frequency,
                 COALESCE(type, 'WiFi') as type,
                 COALESCE(capabilities, 'Unknown') as capabilities
          FROM app.networks WHERE location IS NOT NULL
        `;

        let params = [];
        if (bbox) {
          const coords = bbox.split(',').map(Number);
          queryText += ' AND ST_Intersects(location, ST_MakeEnvelope($1,$2,$3,$4,4326))';
          params = coords;
        }

        queryText += ' ORDER BY bestlevel DESC';

        // Only add LIMIT if explicitly provided
        if (limit) {
          queryText += ` LIMIT ${parseInt(limit)}`;
        }

        const result = await query(queryText, params);

        const geojson = {
          type: 'FeatureCollection',
          features: result.rows.map((row) => ({
            type: 'Feature',
            geometry: row.geometry,
            properties: {
              bssid: row.bssid,
              ssid: row.ssid,
              bestlevel: row.bestlevel || 0,
              max_signal: row.max_signal || 0,
              first_seen: row.first_seen,
              last_seen: row.last_seen,
              manufacturer: row.manufacturer,
              device_type: row.device_type,
              encryption: row.encryption,
              channel: row.channel,
              frequency: row.frequency,
              type: row.type,
              capabilities: row.capabilities,
            },
          })),
        };

        res.json(geojson);
      } catch (error) {
        console.error('Kepler data error:', error);
        res.status(500).json({ error: 'Failed to fetch kepler data' });
      }
    });

    // All observations endpoint - THE FULL DATASET!
    app.get('/api/kepler/observations', async (req, res) => {
      try {
        const { bbox, limit } = req.query;

        let queryText = `
          SELECT bssid, 
                 ST_AsGeoJSON(location)::json as geometry,
                 signal_dbm, observed_at, source_type, source_device,
                 accuracy_meters, altitude_meters, fingerprint
          FROM app.observations 
          WHERE location IS NOT NULL
        `;

        let params = [];
        if (bbox) {
          const coords = bbox.split(',').map(Number);
          queryText += ' AND ST_Intersects(location, ST_MakeEnvelope($1,$2,$3,$4,4326))';
          params = coords;
        }

        queryText += ' ORDER BY observed_at DESC';

        if (limit) {
          queryText += ` LIMIT ${parseInt(limit)}`;
        }

        const result = await query(queryText, params);

        const geojson = {
          type: 'FeatureCollection',
          features: result.rows.map((row) => ({
            type: 'Feature',
            geometry: row.geometry,
            properties: {
              bssid: row.bssid,
              ssid: `Network-${row.bssid.substring(0, 8)}`,
              signal: row.signal_dbm || 0,
              timestamp: row.observed_at,
              source: row.source_type,
              device: row.source_device,
              accuracy: row.accuracy_meters,
              altitude: row.altitude_meters,
              fingerprint: row.fingerprint,
            },
          })),
        };

        res.json(geojson);
      } catch (error) {
        console.error('Observations data error:', error);
        res.status(500).json({ error: 'Failed to fetch observations data' });
      }
    });

    console.log('✓ All routes mounted successfully');

    // ============================================================================
    // 10. SPA FALLBACK (React Router support)
    // ============================================================================
    // Serve index.html for all non-API routes (must be after API routes)
    app.get('*', (req, res) => {
      // Don't handle API routes
      if (req.path.startsWith('/api') || req.path.startsWith('/legacy')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });

    // ============================================================================
    // 11. ERROR HANDLING
    // ============================================================================
    app.use(errorHandler);

    // ============================================================================
    // 12. SERVER STARTUP
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
