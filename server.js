// Clear PostgreSQL environment variables that might interfere
delete process.env.PGHOST;
delete process.env.PGPORT;
delete process.env.PGDATABASE;
delete process.env.PGUSER;

(async () => {
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // WiGLE Network Type Classifications (https://api.wigle.net/csvFormat.html)
  // W = WiFi, B = Bluetooth, E = BLE, G = GSM, C = CDMA, D = WCDMA, L = LTE, N = NR (5G), F = NFC
  function inferRadioType(radioType, ssid, frequency, capabilities) {
    // If database has a valid radio_type, use it
    if (radioType && radioType !== '' && radioType !== null) {
      return radioType;
    }

    const ssidUpper = String(ssid || '').toUpperCase();
    const capUpper = String(capabilities || '').toUpperCase();

    // Check for 5G NR (New Radio)
    if (ssidUpper.includes('5G') || capUpper.includes('NR') || capUpper.includes('5G NR')) {
      return 'N';
    }

    // Check for LTE (4G)
    if (
      ssidUpper.includes('LTE') ||
      ssidUpper.includes('4G') ||
      capUpper.includes('LTE') ||
      capUpper.includes('EARFCN')
    ) {
      return 'L';
    }

    // Check for WCDMA (3G)
    if (
      ssidUpper.includes('WCDMA') ||
      ssidUpper.includes('3G') ||
      ssidUpper.includes('UMTS') ||
      capUpper.includes('WCDMA') ||
      capUpper.includes('UMTS') ||
      capUpper.includes('UARFCN')
    ) {
      return 'D';
    }

    // Check for GSM (2G)
    if (
      ssidUpper.includes('GSM') ||
      ssidUpper.includes('2G') ||
      capUpper.includes('GSM') ||
      capUpper.includes('ARFCN')
    ) {
      return 'G';
    }

    // Check for CDMA
    if (ssidUpper.includes('CDMA') || capUpper.includes('CDMA')) {
      return 'C';
    }

    // Check for generic cellular keywords
    const cellularKeywords = ['T-MOBILE', 'VERIZON', 'AT&T', 'ATT', 'SPRINT', 'CARRIER', '3GPP'];
    if (cellularKeywords.some((keyword) => ssidUpper.includes(keyword))) {
      return 'L'; // Default cellular to LTE
    }

    // Check for BLE (Bluetooth Low Energy)
    if (
      ssidUpper.includes('[UNKNOWN / SPOOFED RADIO]') ||
      ssidUpper.includes('BLE') ||
      ssidUpper.includes('BTLE') ||
      capUpper.includes('BLE') ||
      capUpper.includes('BTLE') ||
      capUpper.includes('BLUETOOTH LOW ENERGY')
    ) {
      return 'E';
    }

    // Check for Bluetooth Classic
    if (ssidUpper.includes('BLUETOOTH') || capUpper.includes('BLUETOOTH')) {
      if (!capUpper.includes('LOW ENERGY') && !capUpper.includes('BLE')) {
        return 'B';
      }
      return 'E'; // Default Bluetooth to BLE if ambiguous
    }

    // Check frequency ranges
    if (frequency) {
      const freq = parseInt(frequency, 10);

      // WiFi 2.4GHz band (2400-2500 MHz)
      if (freq >= 2412 && freq <= 2484) {
        return 'W';
      }

      // WiFi 5GHz band (5000-6000 MHz)
      if (freq >= 5000 && freq <= 5900) {
        return 'W';
      }

      // WiFi 6GHz band (5925-7125 MHz)
      if (freq >= 5925 && freq <= 7125) {
        return 'W';
      }
    }

    // Check capabilities for WiFi keywords
    if (
      capUpper.includes('WPA') ||
      capUpper.includes('WEP') ||
      capUpper.includes('WPS') ||
      capUpper.includes('RSN') ||
      capUpper.includes('ESS') ||
      capUpper.includes('CCMP') ||
      capUpper.includes('TKIP')
    ) {
      return 'W';
    }

    // Unknown - don't default to WiFi
    return '?';
  }

  try {
    // ============================================================================
    // 1. CORE DEPENDENCIES
    // ============================================================================
    require('dotenv').config({ override: true });
    const logger = require('./src/logging/logger');
    const express = require('express');
    const path = require('path');
    const cors = require('cors');
    const compression = require('compression');
    const rateLimit = require('express-rate-limit');

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
    const filteredRoutes = require('./src/api/routes/v2/filtered');
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
    const { pool, query, testConnection } = require('./src/config/database');

    pool.on('connect', (client) => {
      logger.debug(`Pool connected: ${client.host}:${client.port}`);
    });

    // Fail fast if the database is unreachable or misconfigured
    await testConnection();

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

    // ============================================================================
    // 9. ROUTE MOUNTING
    // ============================================================================

    // Make secretsManager available to routes
    app.locals.secretsManager = secretsManager;

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
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api', dashboardRoutes.router);
    app.use('/api/v2/networks/filtered', filteredRoutes);
    app.use('/api', networksV2Routes);
    app.use('/api', locationMarkersRoutes(query));
    app.use('/api', backupRoutes);
    app.use('/api', exportRoutes);
    app.use('/api', settingsRoutes);

    // Geocoding endpoint
    app.post('/api/geocode', async (req, res) => {
      try {
        const { address } = req.body;
        if (!address) {
          return res.status(400).json({ error: 'Address is required' });
        }

        // Use Mapbox Geocoding API
        const mapboxToken = await secretsManager.getSecret('MAPBOX_TOKEN');
        if (!mapboxToken) {
          return res.status(500).json({ error: 'Mapbox token not configured' });
        }

        const encodedAddress = encodeURIComponent(address);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const [lng, lat] = feature.center;

          res.json({
            lat: lat,
            lng: lng,
            formatted_address: feature.place_name,
            confidence: feature.relevance,
          });
        } else {
          res.status(404).json({ error: 'Address not found' });
        }
      } catch (error) {
        logger.error(`Geocoding error: ${error.message}`, { error });
        res.status(500).json({ error: 'Geocoding failed' });
      }
    });

    // Kepler.gl data endpoint
    app.get('/api/kepler/data', async (req, res) => {
      try {
        const { _bbox, limit: limitRaw } = req.query;
        const limit = limitRaw ? Math.min(parseInt(limitRaw, 10) || 5000, 50000) : 5000;

        // Get latest observation per network (similar to networks endpoint but simpler)
        const result = await query(
          `
          WITH obs_latest AS (
            SELECT DISTINCT ON (bssid)
              bssid,
              ssid,
              lat,
              lon,
              level,
              accuracy,
              time AS observed_at,
              radio_type,
              radio_frequency,
              radio_capabilities
            FROM public.observations
            WHERE lat IS NOT NULL AND lon IS NOT NULL
            ORDER BY bssid, time DESC
          )
          SELECT
            obs.bssid,
            obs.ssid,
            obs.lat,
            obs.lon,
            obs.level,
            obs.accuracy,
            obs.observed_at,
            obs.radio_frequency AS frequency,
            obs.radio_capabilities AS capabilities,
            obs.radio_type AS type,
            COALESCE(ap.total_observations, 1) AS observations,
            ap.first_seen,
            ap.last_seen
          FROM obs_latest obs
          LEFT JOIN public.access_points ap ON ap.bssid = obs.bssid
          WHERE obs.lat IS NOT NULL AND obs.lon IS NOT NULL
          ORDER BY obs.observed_at DESC
          LIMIT $1
        `,
          [limit]
        );

        const geojson = {
          type: 'FeatureCollection',
          features: result.rows.map((row) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [row.lon, row.lat],
            },
            properties: {
              bssid: row.bssid,
              ssid: row.ssid || 'Hidden Network',
              bestlevel: row.level || 0,
              signal: row.level || 0,
              level: row.level || 0,
              first_seen: row.first_seen || row.observed_at,
              last_seen: row.last_seen || row.observed_at,
              timestamp: row.last_seen || row.observed_at,
              manufacturer: 'Unknown',
              device_type: 'Unknown',
              type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
              channel: row.frequency ? Math.floor((row.frequency - 2407) / 5) : null,
              frequency: row.frequency || null,
              capabilities: row.capabilities || '',
              encryption: row.capabilities || 'Open/Unknown',
              altitude: null,
              accuracy: row.accuracy,
              obs_count: row.observations || 0,
            },
          })),
        };

        res.json(geojson);
      } catch (error) {
        logger.error(`Kepler data error: ${error.message}`, { error });
        res.status(500).json({ error: error.message || 'Failed to fetch kepler data' });
      }
    });

    // All observations endpoint - THE FULL DATASET!
    app.get('/api/kepler/observations', async (req, res) => {
      try {
        const result = await query(`
          SELECT
            bssid,
            ssid,
            level,
            lat,
            lon,
            altitude,
            accuracy,
            observed_at,
            device_id,
            source_tag,
            radio_type,
            radio_frequency,
            radio_capabilities,
            ST_AsGeoJSON(geom)::json as geometry
          FROM public.observations
          WHERE geom IS NOT NULL
          ORDER BY observed_at DESC
        `);

        const geojson = {
          type: 'FeatureCollection',
          features: result.rows.map((row) => ({
            type: 'Feature',
            geometry: row.geometry,
            properties: {
              bssid: row.bssid,
              ssid: row.ssid || 'Hidden Network',
              bestlevel: row.level || 0,
              signal: row.level || 0,
              first_seen: row.observed_at,
              last_seen: row.observed_at,
              timestamp: row.observed_at,
              manufacturer: 'Unknown',
              device_type: 'Unknown',
              type: inferRadioType(
                row.radio_type,
                row.ssid,
                row.radio_frequency,
                row.radio_capabilities
              ),
              channel: row.radio_frequency ? Math.floor((row.radio_frequency - 2407) / 5) : null,
              frequency: row.radio_frequency || null,
              capabilities: row.radio_capabilities || '',
              encryption: row.radio_capabilities || 'Open/Unknown',
              device_id: row.device_id,
              source_tag: row.source_tag,
              altitude: row.altitude,
              accuracy: row.accuracy,
            },
          })),
        };

        res.json(geojson);
      } catch (error) {
        logger.error(`Observations data error: ${error.message}`, { error });
        res.status(500).json({ error: error.message });
      }
    });

    // Networks endpoint - Trilaterated networks from access_points
    app.get('/api/kepler/networks', async (req, res) => {
      try {
        // Get networks from access_points with latest observation data
        const result = await query(`
          WITH obs_latest AS (
            SELECT DISTINCT ON (bssid)
              bssid,
              ssid,
              lat,
              lon,
              level,
              accuracy,
              time AS observed_at,
              radio_type,
              radio_frequency,
              radio_capabilities
            FROM public.observations
            WHERE lat IS NOT NULL AND lon IS NOT NULL
            ORDER BY bssid, time DESC
          )
          SELECT
            ap.bssid,
            COALESCE(NULLIF(obs.ssid, ''), ap.latest_ssid) AS ssid,
            obs.lat,
            obs.lon,
            obs.level,
            obs.accuracy,
            ap.total_observations AS observations,
            ap.first_seen,
            ap.last_seen,
            obs.radio_frequency AS frequency,
            obs.radio_capabilities AS capabilities,
            obs.radio_type AS type,
            ST_SetSRID(ST_MakePoint(obs.lon, obs.lat), 4326) AS geom
          FROM public.access_points ap
          LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
          WHERE obs.lat IS NOT NULL 
            AND obs.lon IS NOT NULL
          ORDER BY ap.last_seen DESC
        `);

        const geojson = {
          type: 'FeatureCollection',
          features: result.rows
            .filter((row) => row.geom)
            .map((row) => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [row.lon, row.lat],
              },
              properties: {
                bssid: row.bssid,
                ssid: row.ssid || 'Hidden Network',
                bestlevel: row.level || 0,
                signal: row.level || 0,
                level: row.level || 0,
                first_seen: row.first_seen,
                last_seen: row.last_seen,
                timestamp: row.last_seen,
                manufacturer: 'Unknown',
                device_type: 'Unknown',
                type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
                channel: row.frequency ? Math.floor((row.frequency - 2407) / 5) : null,
                frequency: row.frequency || null,
                capabilities: row.capabilities || '',
                encryption: row.capabilities || 'Open/Unknown',
                altitude: null,
                accuracy: row.accuracy,
                obs_count: row.observations || 0,
                observation_count: row.observations || 0,
                observations: row.observations || 0,
              },
            })),
        };

        res.json(geojson);
      } catch (error) {
        logger.error(`Networks data error: ${error.message}`, { error });
        res.status(500).json({ error: error.message });
      }
    });

    logger.info('All routes mounted successfully');

    // ============================================================================
    // 10. SPA FALLBACK (React Router support)
    // ============================================================================
    // Serve index.html for all non-API routes (must be after API routes)
    app.get('*', (req, res) => {
      // Don't handle API routes
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });

    // ============================================================================
    // 11. ERROR HANDLING
    // ============================================================================
    // 11. IMPORT ENDPOINTS
    // ============================================================================
    const { importWigleDirectory } = require('./src/services/wigleImportService');

    app.post('/api/import/wigle', async (req, res) => {
      try {
        const importDir = path.join(__dirname, 'imports', 'wigle');
        const result = await importWigleDirectory(importDir);
        res.json({ success: true, ...result });
      } catch (error) {
        logger.error(`WiGLE import error: ${error.message}`, { error });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Data quality endpoint
    app.get('/api/data-quality', async (req, res) => {
      try {
        const filter = req.query.filter || 'none'; // none, temporal, extreme, duplicate, all
        const { DATA_QUALITY_FILTERS } = require('./src/services/dataQualityFilters');

        let whereClause = '';
        if (filter === 'temporal') {
          whereClause = DATA_QUALITY_FILTERS.temporal_clusters;
        } else if (filter === 'extreme') {
          whereClause = DATA_QUALITY_FILTERS.extreme_signals;
        } else if (filter === 'duplicate') {
          whereClause = DATA_QUALITY_FILTERS.duplicate_coords;
        } else if (filter === 'all') {
          whereClause = DATA_QUALITY_FILTERS.all();
        }

        const query = `
          SELECT COUNT(*) as total_observations,
                 COUNT(DISTINCT bssid) as unique_networks,
                 MIN(time) as earliest_time,
                 MAX(time) as latest_time
          FROM observations 
          WHERE 1=1 ${whereClause}
        `;

        const result = await pool.query(query);
        res.json({
          filter_applied: filter,
          ...result.rows[0],
        });
      } catch (error) {
        logger.error(`Data quality error: ${error.message}`, { error });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ============================================================================
    app.use(errorHandler);

    // ============================================================================
    // 12. SERVER STARTUP
    // ============================================================================
    app.listen(port, host, () => {
      logger.info(`Server listening on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`HTTPS redirect: ${FORCE_HTTPS ? 'enabled' : 'disabled'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, closing server gracefully...');
      await pool.end();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, closing server gracefully...');
      await pool.end();
      process.exit(0);
    });
  } catch (err) {
    const logger = require('./src/logging/logger');
    logger.error(`Fatal error starting server: ${err.message}`, { error: err });
    process.exit(1);
  }
})();
