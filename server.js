console.log('Starting server...');

// Clear PostgreSQL environment variables that might interfere
delete process.env.PGHOST;
delete process.env.PGPORT;
delete process.env.PGDATABASE;
delete process.env.PGUSER;

// Helper functions
function requireAuth(req, res, next) {
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {return next();} // Skip auth if no key configured
  const key = req.headers['x-api-key']; // Only accept via header (not query param for security)
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - API key required' });
  }
  next();
}

function sanitizeBSSID(bssid) {
  if (!bssid || typeof bssid !== 'string') {return null;}
  const cleaned = bssid.trim().toUpperCase();
  if (cleaned.length > 64) {return null;} // Prevent excessive length
  // Valid MAC address format
  if (/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(cleaned)) {return cleaned;}
  // Valid alphanumeric tower ID (up to 32 chars)
  if (/^[A-Z0-9_-]{1,32}$/.test(cleaned)) {return cleaned;}
  return null;
}

async function queryWithPool(pool, text, params = [], tries = 2) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    // Retry on transient errors
    const transientErrors = ['57P01', '53300', '08006', '08003', '08000'];
    const isTransient = transientErrors.includes(error.code) ||
                        error.message?.includes('ETIMEDOUT') ||
                        error.message?.includes('ECONNRESET');

    if (isTransient && tries > 0) {
      console.log(`Retrying query (${tries} attempts left)...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      return queryWithPool(pool, text, params, tries - 1);
    }
    throw error;
  }
}

try {
  require('dotenv').config({ override: true });
  const express = require('express');
  const path = require('path');
  const { Pool } = require('pg');
  const errorHandler = require('./utils/errorHandler');
  const rateLimit = require('express-rate-limit');
  const cors = require('cors');
  const compression = require('compression');

  const app = express();
  const port = process.env.PORT || 3001;
  const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';

  // HTTPS redirect middleware (if enabled)
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
            "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com;"
    );
    next();
  });

  // Enable gzip compression
  app.use(compression());

  // Enable CORS with origin restrictions
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3001', 'http://127.0.0.1:3001'];

  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) {return callback(null, true);}

      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));

  // Rate limiting to prevent abuse
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  });

  // Apply the rate limiting middleware to API calls only
  app.use('/api/', apiLimiter);

  // Configuration constants
  const CONFIG = {
    THREAT_THRESHOLD: parseInt(process.env.THREAT_THRESHOLD) || 40,
    MIN_OBSERVATIONS: parseInt(process.env.MIN_OBSERVATIONS) || 2,
    MIN_VALID_TIMESTAMP: 946684800000, // Jan 1, 2000
    MAX_PAGE_SIZE: 5000,
    DEFAULT_PAGE_SIZE: 100,
  };

  // Database connection configuration with pool limits
  // Force IPv4 to avoid IPv6 timeout issues in Docker environments
  const pool = new Pool({
    user: process.env.DB_USER,
    host: '127.0.0.1',
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: 5432,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    application_name: 'shadowcheck-static',
    // Force connection through loopback interface
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

  // Parse JSON request bodies with size limit to prevent DoS
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Query wrapper that uses the pool
  const query = (text, params, tries) => queryWithPool(pool, text, params, tries);

  // Serve static files from the 'public' directory
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true,
  }));

  // Serve the HTML file
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Mapbox token endpoint
  app.get('/api/mapbox-token', async (req, res) => {
    try {
      const keyringService = require('./src/services/keyringService');
      const token = await keyringService.getMapboxToken();

      if (!token || token === 'your-mapbox-token-here') {
        return res.status(500).json({ error: 'Mapbox token not configured' });
      }

      res.json({ token });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load Mapbox token' });
    }
  });

  // Location markers endpoints
  app.get('/api/location-markers', async (req, res, next) => {
    try {
      const result = await query(`
          SELECT 
            marker_id,
            marker_type,
            ST_X(location::geometry) as longitude,
            ST_Y(location::geometry) as latitude,
            created_at,
            updated_at
          FROM app.location_markers
          ORDER BY created_at DESC
        `);
      res.json({ ok: true, markers: result.rows });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/location-markers/home', async (req, res, next) => {
    try {
      const { latitude, longitude } = req.body;
      if (!latitude || !longitude) {
        return res.status(400).json({ ok: false, error: 'Latitude and longitude are required' });
      }
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ ok: false, error: 'Invalid coordinates' });
      }
      await query('DELETE FROM app.location_markers WHERE marker_type = \'home\'');
      const result = await query(`
          INSERT INTO app.location_markers (marker_type, location)
          VALUES ('home', ST_SetSRID(ST_MakePoint($1, $2), 4326))
          RETURNING marker_id, marker_type, ST_X(location::geometry) as longitude, ST_Y(location::geometry) as latitude, created_at
        `, [lng, lat]);
      res.json({ ok: true, marker: result.rows[0] });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/location-markers/home', async (req, res, next) => {
    try {
      await query('DELETE FROM app.location_markers WHERE marker_type = \'home\'');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // WiGLE API v2/v3 integration endpoints
  app.get('/api/wigle/network/:bssid', async (req, res, next) => {
    try {
      const keyringService = require('./src/services/keyringService');
      const creds = await keyringService.getWigleCredentials();
      if (!creds) {return res.status(401).json({ error: 'WiGLE credentials not configured' });}

      const response = await fetch(`https://api.wigle.net/api/v2/network/detail?netid=${req.params.bssid}`, {
        headers: { 'Authorization': `Basic ${creds.encoded}` },
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/wigle/search', async (req, res, next) => {
    try {
      const keyringService = require('./src/services/keyringService');
      const creds = await keyringService.getWigleCredentials();
      if (!creds) {return res.status(401).json({ error: 'WiGLE credentials not configured' });}

      const params = new URLSearchParams(req.query);
      const response = await fetch(`https://api.wigle.net/api/v2/network/search?${params}`, {
        headers: { 'Authorization': `Basic ${creds.encoded}` },
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // ============================================
  // PHASE 1 MODERNIZATION: Modular Architecture
  // ============================================
  // Initialize dependency injection container
  const { initContainer } = require('./src/config/container');
  const container = initContainer();

  // Initialize dashboard routes (modular)
  const { initDashboardRoutes } = require('./src/api/routes/v1/dashboard');
  const dashboardRoutes = initDashboardRoutes({
    dashboardService: container.get('dashboardService'),
  });
  app.use('/api', dashboardRoutes);

  // Initialize settings routes
  const settingsRoutes = require('./src/api/routes/v1/settings');
  app.use('/api/settings', settingsRoutes);

  // Initialize export routes
  const exportRoutes = require('./src/api/routes/v1/export');
  app.use('/api/export', exportRoutes);

  // Initialize backup routes
  const backupRoutes = require('./src/api/routes/v1/backup');
  app.use('/api/backup', backupRoutes);

  // Initialize threats routes
  const threatsRoutes = require('./src/api/routes/v1/threats');
  app.use('/api/threats', threatsRoutes);

  console.log('✓ Modular routes initialized (Phase 1)');
  // ============================================

  // API endpoint to get dashboard metrics (LEGACY - keeping for now)
  app.get('/api/dashboard-metrics', async (req, res, next) => {
    try {
      // Get total networks
      const totalResult = await query('SELECT COUNT(*) as count FROM app.networks');
      const totalNetworks = parseInt(totalResult.rows[0].count);

      // Get threats count (score >= 30)
      const threatsResult = await query(`
        SELECT COUNT(DISTINCT n.bssid) as count
        FROM app.networks n
        JOIN app.observations o ON n.bssid = o.bssid
        WHERE o.latitude IS NOT NULL
        GROUP BY n.bssid
        HAVING COUNT(DISTINCT o.unified_id) >= 2
      `);
      const threatsCount = threatsResult.rows.length;

      // Get surveillance count (tagged as THREAT)
      const survResult = await query(`SELECT COUNT(*) as count FROM app.network_tags WHERE tag_type = 'THREAT'`);
      const surveillanceCount = parseInt(survResult.rows[0].count);

      // Get enriched count
      const enrichedResult = await query(`SELECT COUNT(*) as count FROM app.networks WHERE manufacturer IS NOT NULL OR address IS NOT NULL`);
      const enrichedCount = parseInt(enrichedResult.rows[0].count);

      // Get radio type counts
      const radioResult = await query(`
        SELECT
          CASE
            WHEN type = 'W' THEN 'WiFi'
            WHEN type = 'E' THEN 'BLE'
            WHEN type = 'B' THEN 'BT'
            WHEN type = 'L' THEN 'LTE'
            WHEN type = 'N' THEN 'LTE'
            WHEN type = 'G' THEN 'GSM'
            ELSE 'Other'
          END as radio_type,
          COUNT(*) as count
        FROM app.networks
        WHERE type IS NOT NULL
        GROUP BY radio_type
      `);

      const radioCounts = {};
      radioResult.rows.forEach(row => {
        radioCounts[row.radio_type] = parseInt(row.count);
      });

      res.json({
        totalNetworks,
        threatsCount,
        surveillanceCount,
        enrichedCount,
        wifiCount: radioCounts.WiFi || 0,
        btCount: radioCounts.BT || 0,
        bleCount: radioCounts.BLE || 0,
        lteCount: radioCounts.LTE || 0,
        gsmCount: radioCounts.GSM || 0
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/analytics/network-types', async (req, res, next) => {
    try {
      const { rows } = await query(`
          SELECT
            CASE
              WHEN type = 'W' THEN 'WiFi'
              WHEN type = 'E' THEN 'BLE'
              WHEN type = 'B' AND (frequency < 5000 OR capabilities LIKE '%BLE%') THEN 'BLE'
              WHEN type = 'B' THEN 'BT'
              WHEN type = 'L' THEN 'LTE'
              WHEN type = 'N' THEN 'NR'
              WHEN type = 'G' AND capabilities LIKE '%LTE%' THEN 'LTE'
              WHEN type = 'G' THEN 'GSM'
              ELSE type
            END as network_type,
            COUNT(*) as count
          FROM app.networks
          WHERE type IS NOT NULL
          GROUP BY network_type
          ORDER BY count DESC
        `);

      res.json({
        ok: true,
        data: rows.map(row => ({
          type: row.network_type,
          count: parseInt(row.count),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint for analytics - signal strength distribution
  app.get('/api/analytics/signal-strength', async (req, res, next) => {
    try {
      const { rows } = await query(`
          SELECT
            CASE
              WHEN bestlevel >= -30 THEN '-30'
              WHEN bestlevel >= -40 THEN '-40'
              WHEN bestlevel >= -50 THEN '-50'
              WHEN bestlevel >= -60 THEN '-60'
              WHEN bestlevel >= -70 THEN '-70'
              WHEN bestlevel >= -80 THEN '-80'
              ELSE '-90'
            END as signal_range,
            COUNT(*) as count
          FROM app.networks
          WHERE bestlevel IS NOT NULL
          GROUP BY signal_range
          ORDER BY signal_range DESC
        `);

      res.json({
        ok: true,
        data: rows.map(row => ({
          range: row.signal_range,
          count: parseInt(row.count),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint for analytics - temporal activity
  app.get('/api/analytics/temporal-activity', async (req, res, next) => {
    try {
      const { rows } = await query(`
          SELECT
            EXTRACT(HOUR FROM last_seen) as hour,
            COUNT(*) as count
          FROM app.networks
          WHERE last_seen IS NOT NULL
            AND EXTRACT(EPOCH FROM last_seen) * 1000 >= $1
          GROUP BY hour
          ORDER BY hour
        `, [CONFIG.MIN_VALID_TIMESTAMP]);

      res.json({
        ok: true,
        data: rows.map(row => ({
          hour: parseInt(row.hour),
          count: parseInt(row.count),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint for analytics - radio type over time (last 30 days)
  app.get('/api/analytics/radio-type-over-time', async (req, res, next) => {
    try {
      const range = req.query.range || '30d';

      // Validate range parameter
      const validRanges = ['24h', '7d', '30d', '90d', 'all'];
      if (!validRanges.includes(range)) {
        return res.status(400).json({ error: 'Invalid range parameter. Must be one of: 24h, 7d, 30d, 90d, all' });
      }

      // Determine time interval and grouping
      let interval = '30 days';
      let dateFormat = 'DATE(last_seen)';

      switch (range) {
        case '24h':
          interval = '24 hours';
          dateFormat = "DATE_TRUNC('hour', last_seen)";
          break;
        case '7d':
          interval = '7 days';
          dateFormat = 'DATE(last_seen)';
          break;
        case '30d':
          interval = '30 days';
          dateFormat = 'DATE(last_seen)';
          break;
        case '90d':
          interval = '90 days';
          dateFormat = 'DATE(last_seen)';
          break;
        case 'all':
          interval = '100 years'; // Effectively all time
          dateFormat = "DATE_TRUNC('week', last_seen)";
          break;
      }

      const whereClause = range === 'all'
        ? 'WHERE last_seen IS NOT NULL AND EXTRACT(EPOCH FROM last_seen) * 1000 >= $1'
        : `WHERE last_seen >= NOW() - INTERVAL '${interval}' AND last_seen IS NOT NULL AND EXTRACT(EPOCH FROM last_seen) * 1000 >= $1`;

      const { rows } = await query(`
          WITH time_counts AS (
            SELECT
              ${dateFormat} as date,
              CASE
                WHEN type = 'W' THEN 'WiFi'
                WHEN type = 'E' THEN 'BLE'
                WHEN type = 'B' AND (frequency < 5000 OR capabilities LIKE '%BLE%') THEN 'BLE'
                WHEN type = 'B' THEN 'BT'
                WHEN type = 'L' THEN 'LTE'
                WHEN type = 'N' THEN 'NR'
                WHEN type = 'G' AND capabilities LIKE '%LTE%' THEN 'LTE'
                WHEN type = 'G' THEN 'GSM'
                ELSE 'Other'
              END as network_type,
              COUNT(*) as count
            FROM app.networks
            ${whereClause}
            GROUP BY date, network_type
            ORDER BY date, network_type
          )
          SELECT * FROM time_counts
        `, [CONFIG.MIN_VALID_TIMESTAMP]);

      res.json({
        ok: true,
        data: rows.map(row => ({
          date: row.date,
          type: row.network_type,
          count: parseInt(row.count),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint for analytics - security analysis
  app.get('/api/analytics/security', async (req, res, next) => {
    try {
      const { rows } = await query(`
          SELECT
            CASE
              -- WPA3 variants
              WHEN capabilities ILIKE '%WPA3%' AND capabilities ILIKE '%ENT%' THEN 'WPA3-E'
              WHEN capabilities ILIKE '%WPA3%' AND (capabilities ILIKE '%SAE%' OR capabilities ILIKE '%PSK%') THEN 'WPA3-P'
              WHEN capabilities ILIKE '%WPA3%' THEN 'WPA3'

              -- WPA2 variants
              WHEN capabilities ILIKE '%WPA2%' AND capabilities ILIKE '%ENT%' THEN 'WPA2-E'
              WHEN capabilities ILIKE '%WPA2%' AND capabilities ILIKE '%PSK%' THEN 'WPA2-P'
              WHEN capabilities ILIKE '%WPA2%' THEN 'WPA2'

              -- WPA (original)
              WHEN capabilities ILIKE '%WPA%' AND NOT capabilities ILIKE '%WPA2%' AND NOT capabilities ILIKE '%WPA3%' THEN 'WPA'

              -- WEP
              WHEN capabilities ILIKE '%WEP%' THEN 'WEP'

              -- WPS (WiFi Protected Setup)
              WHEN capabilities ILIKE '%WPS%' AND (capabilities IS NULL OR capabilities = '' OR NOT capabilities ILIKE '%WPA%') THEN 'WPS'

              -- Open networks
              WHEN capabilities IS NULL OR capabilities = '' OR capabilities ILIKE '%ESS%' THEN 'OPEN'

              ELSE 'OPEN'
            END as security_type,
            COUNT(*) as count
          FROM app.networks
          WHERE type = 'W'  -- WiFi networks only
          GROUP BY security_type
          ORDER BY count DESC
        `);

      res.json({
        ok: true,
        data: rows.map(row => ({
          type: row.security_type,
          count: parseInt(row.count),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint for quick threat detection with pagination
  // ENHANCED: ML-integrated, location-to-location surveillance detection
  app.get('/api/threats/quick', async (req, res, next) => {
    console.log('[DEBUG] /api/threats/quick called with params:', req.query);
    try {
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);
      const minSeverity = req.query.minSeverity ? parseInt(req.query.minSeverity) : null;
      const excludeTagged = req.query.exclude_tagged === 'true';

      console.log(`[DEBUG] exclude_tagged param: ${req.query.exclude_tagged}, parsed: ${excludeTagged}`);

      if (isNaN(page) || page <= 0) {
        return res.status(400).json({ error: 'Invalid page parameter. Must be a positive integer.' });
      }
      if (isNaN(limit) || limit <= 0 || limit > 5000) {
        return res.status(400).json({ error: 'Invalid limit parameter. Must be between 1 and 5000.' });
      }
      if (minSeverity !== null && (isNaN(minSeverity) || minSeverity < 0 || minSeverity > 100)) {
        return res.status(400).json({ error: 'minSeverity must be a number between 0 and 100.' });
      }

      const offset = (page - 1) * limit;

      const queryParams = [CONFIG.MIN_VALID_TIMESTAMP];
      let paramIndex = 2; // Starting index for dynamic parameters

      const whereClauses = [];

      // NEW ENHANCED THREAT SCORING WITH ML INTEGRATION
      const threatScoreCalculation = `
            CASE
              -- If user manually tagged, use their score (highest priority)
              WHEN nt.user_override = true AND nt.threat_score IS NOT NULL THEN nt.threat_score * 100

              -- If ML model is trained and confident, prioritize ML
              WHEN nt.ml_confidence IS NOT NULL AND nt.ml_confidence > 0.7 THEN (
                -- ML base score
                (nt.ml_confidence * 100) +

                -- ML BONUS: High confidence predictions get extra points
                CASE WHEN nt.ml_confidence >= 0.9 THEN 50
                     WHEN nt.ml_confidence >= 0.8 THEN 30
                     WHEN nt.ml_confidence >= 0.7 THEN 15
                     ELSE 0 END +

                -- Distance weighting (farther = more suspicious)
                CASE WHEN ns.max_distance_from_home_km >= 10 THEN 40
                     WHEN ns.max_distance_from_home_km >= 5 THEN 30
                     WHEN ns.max_distance_from_home_km >= 2 THEN 20
                     WHEN ns.max_distance_from_home_km >= 1 THEN 10
                     WHEN ns.max_distance_from_home_km >= 0.5 THEN 5
                     ELSE 0 END +

                -- Temporal persistence bonus
                CASE WHEN ns.unique_days >= 7 THEN 30
                     WHEN ns.unique_days >= 3 THEN 20
                     WHEN ns.unique_days >= 2 THEN 10
                     ELSE 0 END
              )

              -- Otherwise use rule-based scoring
              ELSE (
                -- RULE 1: CORE SURVEILLANCE DETECTION (seen at home, then far away)
                -- This is the PRIMARY indicator of tracking
                CASE WHEN ns.seen_at_home AND ns.max_distance_from_home_km >= 10 THEN 100
                     WHEN ns.seen_at_home AND ns.max_distance_from_home_km >= 5 THEN 80
                     WHEN ns.seen_at_home AND ns.max_distance_from_home_km >= 2 THEN 60
                     WHEN ns.seen_at_home AND ns.max_distance_from_home_km >= 1 THEN 50
                     WHEN ns.seen_at_home AND ns.max_distance_from_home_km >= 0.5 THEN 40
                     WHEN ns.seen_at_home AND ns.seen_away_from_home THEN 30  -- 300m+ from home
                     ELSE 0 END +

                -- RULE 2: LOCATION-TO-LOCATION JUMPS (surveillance pattern)
                -- Detected at distinct locations outside each other's range
                CASE WHEN ns.location_jump_score >= 3.0 THEN 80   -- Multiple long jumps
                     WHEN ns.location_jump_score >= 2.0 THEN 60   -- Several jumps
                     WHEN ns.location_jump_score >= 1.0 THEN 40   -- Some jumps
                     WHEN ns.location_jump_score >= 0.5 THEN 20   -- Few jumps
                     ELSE 0 END +

                -- RULE 3: DISTANCE WEIGHTING (farther from home = higher threat)
                CASE WHEN ns.max_distance_from_home_km >= 10 THEN 40
                     WHEN ns.max_distance_from_home_km >= 5 THEN 30
                     WHEN ns.max_distance_from_home_km >= 2 THEN 20
                     WHEN ns.max_distance_from_home_km >= 1 THEN 10
                     WHEN ns.max_distance_from_home_km >= 0.5 THEN 5
                     ELSE 0 END +

                -- RULE 4: MULTIPLE LOCATIONS (following pattern)
                CASE WHEN ns.unique_locations >= 10 THEN 40
                     WHEN ns.unique_locations >= 7 THEN 30
                     WHEN ns.unique_locations >= 5 THEN 20
                     WHEN ns.unique_locations >= 3 THEN 10
                     ELSE 0 END +

                -- RULE 5: TEMPORAL PERSISTENCE (multiple days = sustained tracking)
                CASE WHEN ns.unique_days >= 7 THEN 30
                     WHEN ns.unique_days >= 3 THEN 20
                     WHEN ns.unique_days >= 2 THEN 10
                     ELSE 0 END +

                -- RULE 6: OBSERVATION FREQUENCY (persistent presence)
                CASE WHEN ns.observation_count >= 50 THEN 20
                     WHEN ns.observation_count >= 20 THEN 10
                     WHEN ns.observation_count >= 10 THEN 5
                     ELSE 0 END -

                -- PENALTY 1: Strong stationary WiFi signal (likely fixed infrastructure)
                CASE WHEN ns.type = 'W' AND ns.max_signal > -50 THEN 25 ELSE 0 END -

                -- PENALTY 2: Single location only (not moving = not following)
                CASE WHEN ns.unique_locations = 1 THEN 30 ELSE 0 END
              )
            END`;

      // Lower threshold to catch more surveillance candidates
      const minThreshold = minSeverity !== null ? minSeverity : 30;
      whereClauses.push(`${threatScoreCalculation} >= $${paramIndex++}`);
      queryParams.push(minThreshold);

      // Exclude tagged networks if requested (for UNDETERMINED list)
      if (excludeTagged) {
        whereClauses.push(`NOT EXISTS (
          SELECT 1 FROM app.network_tags
          WHERE network_tags.bssid = ns.bssid
        )`);
        console.log('[DEBUG] Adding exclude_tagged filter with NOT EXISTS');
      }

      // Construct the full WHERE clause
      const fullWhereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      if (excludeTagged) {
        console.log('[DEBUG] WHERE clause with exclude_tagged:', fullWhereClause);
        console.log('[DEBUG] Query params:', queryParams);
      }

      // Add limit and offset parameters
      queryParams.push(limit, offset);

      const { rows } = await query(`
          WITH home_location AS (
            SELECT location::geography as home_point
            FROM app.location_markers
            WHERE marker_type = 'home'
            LIMIT 1
          ),
          -- Calculate location-to-location jumps (surveillance pattern detection)
          location_jumps AS (
            SELECT
              l1.bssid,
              COUNT(DISTINCT l1.unified_id || '-' || l2.unified_id) as jump_count,
              AVG(ST_Distance(
                ST_SetSRID(ST_MakePoint(l1.longitude, l1.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(l2.longitude, l2.latitude), 4326)::geography
              ) / 1000.0) as avg_jump_distance_km,
              MAX(ST_Distance(
                ST_SetSRID(ST_MakePoint(l1.longitude, l1.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(l2.longitude, l2.latitude), 4326)::geography
              ) / 1000.0) as max_jump_distance_km
            FROM app.observations l1
            JOIN app.observations l2 ON
              l1.bssid = l2.bssid
              AND l1.unified_id < l2.unified_id  -- Avoid double counting
              AND l1.observed_at < l2.observed_at
              -- Only count "jumps" that are outside typical radio range (300m+)
              AND ST_Distance(
                ST_SetSRID(ST_MakePoint(l1.longitude, l1.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(l2.longitude, l2.latitude), 4326)::geography
              ) > 300
            WHERE l1.latitude IS NOT NULL AND l1.longitude IS NOT NULL
              AND l2.latitude IS NOT NULL AND l2.longitude IS NOT NULL
              AND EXTRACT(EPOCH FROM l1.observed_at)::BIGINT * 1000 >= $1
              AND EXTRACT(EPOCH FROM l2.observed_at)::BIGINT * 1000 >= $1
              AND (l1.accuracy_meters IS NULL OR l1.accuracy_meters <= 100)
              AND (l2.accuracy_meters IS NULL OR l2.accuracy_meters <= 100)
            GROUP BY l1.bssid
          ),
          network_stats AS (
            SELECT
              n.bssid,
              n.ssid,
              n.type,
              n.encryption,
              COUNT(DISTINCT l.unified_id) as observation_count,
              COUNT(DISTINCT DATE(to_timestamp(EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 / 1000.0))) as unique_days,
              COUNT(DISTINCT ST_SnapToGrid(ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geometry, 0.001)) as unique_locations,
              MAX(l.signal_dbm) as max_signal,
              MIN(EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000) as first_seen,
              MAX(EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000) as last_seen,
              MIN(ST_Distance(
                ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
                h.home_point
              )) / 1000.0 as min_distance_from_home_km,
              MAX(ST_Distance(
                ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
                h.home_point
              )) / 1000.0 as max_distance_from_home_km,
              BOOL_OR(ST_Distance(
                ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
                h.home_point
              ) < 100) as seen_at_home,
              -- CHANGED: 300m threshold instead of 500m for "seen_away_from_home"
              BOOL_OR(ST_Distance(
                ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
                h.home_point
              ) > 300) as seen_away_from_home,
              -- Calculate location jump score
              COALESCE(lj.jump_count, 0) *
                CASE WHEN COALESCE(lj.avg_jump_distance_km, 0) > 5 THEN 2.0
                     WHEN COALESCE(lj.avg_jump_distance_km, 0) > 2 THEN 1.5
                     WHEN COALESCE(lj.avg_jump_distance_km, 0) > 1 THEN 1.0
                     WHEN COALESCE(lj.avg_jump_distance_km, 0) > 0.5 THEN 0.5
                     ELSE 0.1 END as location_jump_score,
              COALESCE(lj.jump_count, 0) as location_jumps,
              COALESCE(lj.max_jump_distance_km, 0) as max_jump_km
            FROM app.networks n
            JOIN app.observations l ON n.bssid = l.bssid
            CROSS JOIN home_location h
            LEFT JOIN location_jumps lj ON n.bssid = lj.bssid
            WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
              AND EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 >= $1
              AND (l.accuracy_meters IS NULL OR l.accuracy_meters <= 100)
            GROUP BY n.bssid, n.ssid, n.type, n.encryption, lj.jump_count, lj.avg_jump_distance_km, lj.max_jump_distance_km
            HAVING COUNT(DISTINCT l.unified_id) >= 2
          )
          SELECT
            ns.bssid,
            ns.ssid,
            ns.type,
            ns.encryption,
            ns.observation_count,
            ns.unique_days,
            ns.unique_locations,
            ns.max_signal,
            ns.first_seen,
            ns.last_seen,
            ns.min_distance_from_home_km,
            ns.max_distance_from_home_km,
            (ns.max_distance_from_home_km - ns.min_distance_from_home_km) as distance_range_km,
            (ns.last_seen - ns.first_seen) as observation_timespan_ms,
            ns.seen_at_home,
            ns.seen_away_from_home,
            ns.location_jumps as companion_networks,
            ns.location_jump_score as shared_locations,
            ns.max_jump_km,
            ${threatScoreCalculation} as threat_score,
            CASE
              WHEN nt.tag_type = 'THREAT' THEN 'User Tagged Threat'
              WHEN nt.tag_type = 'INVESTIGATE' THEN 'User Tagged Investigate'
              WHEN nt.tag_type = 'FALSE_POSITIVE' THEN 'User Tagged False Positive'
              WHEN ns.seen_at_home AND ns.max_distance_from_home_km >= 5 THEN 'Long-Range Tracking Device'
              WHEN ns.seen_at_home AND ns.seen_away_from_home THEN 'Potential Tracking Device'
              WHEN ns.location_jump_score >= 2.0 THEN 'Location-to-Location Surveillance'
              WHEN ns.max_distance_from_home_km - ns.min_distance_from_home_km > 1 THEN 'Mobile Device Pattern'
              ELSE 'Movement Detected'
            END as threat_type,
            -- Include user tags and ML threat scores
            nt.tag_type as user_tag,
            nt.threat_score as user_threat_score,
            COALESCE(nt.ml_confidence, (CASE
              WHEN ns.observation_count >= 10 THEN 0.9
              WHEN ns.observation_count >= 5 THEN 0.7
              ELSE 0.4
            END)) as ml_confidence,
            nt.confidence as user_confidence,
            nt.notes as user_notes,
            nt.user_override,
            -- Add total count using window function
            COUNT(*) OVER() as total_count
          FROM network_stats ns
          LEFT JOIN app.network_tags nt ON ns.bssid = nt.bssid
          ${fullWhereClause}
          ORDER BY
            threat_score DESC,
            ns.max_distance_from_home_km DESC,
            ns.unique_days DESC,
            ns.observation_count DESC
          LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `, queryParams);

      const totalCount = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

      res.json({
        ok: true,
        page: page,
        limit: limit,
        count: rows.length,
        total: totalCount,
        total_count: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        threats: rows.map(row => ({
          bssid: row.bssid,
          ssid: row.ssid,
          type: row.type,  // Radio type: W, E, B, L, N, G
          radioType: row.type,  // Explicit field for frontend display
          encryption: row.encryption,
          totalObservations: row.observation_count,
          threatScore: Math.min(100, Math.max(0, parseInt(row.threat_score))),  // Cap at 0-100
          threatType: row.threat_type,
          confidence: (row.ml_confidence * 100).toFixed(0),
          firstSeen: row.first_seen,
          lastSeen: row.last_seen,
          timespanDays: Math.round(parseInt(row.observation_timespan_ms) / (1000 * 60 * 60 * 24)),
          patterns: {
            seenAtHome: row.seen_at_home,
            seenAwayFromHome: row.seen_away_from_home,
            maxDistanceBetweenObsKm: parseFloat(row.distance_range_km),
            uniqueDaysObserved: row.unique_days,
            maxSpeedKmh: 0,
            distancesFromHomeKm: [parseFloat(row.min_distance_from_home_km), parseFloat(row.max_distance_from_home_km)],
            locationJumps: row.companion_networks || 0,
            locationJumpScore: parseFloat(row.shared_locations) || 0,
            maxJumpDistanceKm: parseFloat(row.max_jump_km) || 0,
          },
          // User tagging data
          userTag: row.user_tag,
          userThreatScore: row.user_threat_score ? parseFloat(row.user_threat_score) : null,
          mlConfidence: row.ml_confidence ? parseFloat(row.ml_confidence) : null,
          userConfidence: row.user_confidence ? parseFloat(row.user_confidence) : null,
          userNotes: row.user_notes,
          userOverride: row.user_override || false,
          isTagged: row.user_tag ? true : false,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // ML Model Training and Prediction Endpoints
  // API endpoint to check for suspicious duplicate observations
  app.get('/api/observations/check-duplicates/:bssid', async (req, res, next) => {
    try {
      const { bssid } = req.params;
      const { time } = req.query;

      // Validate BSSID format (MAC address or cellular tower identifier)
      // MAC: AA:BB:CC:DD:EE:FF or Tower: numeric/alphanumeric identifiers
      if (!bssid || typeof bssid !== 'string' || bssid.trim() === '') {
        return res.status(400).json({ error: 'Valid BSSID or tower identifier is required' });
      }

      if (!time) {
        return res.status(400).json({ error: 'time parameter required (milliseconds)' });
      }

      const { rows } = await query(`
          WITH target_obs AS (
            SELECT time, lat, lon, accuracy
            FROM app.observations
            WHERE bssid = $1 AND time = $2
            LIMIT 1
          )
          SELECT 
            COUNT(*) as total_observations,
            COUNT(DISTINCT l.bssid) as unique_networks,
            ARRAY_AGG(DISTINCT l.bssid ORDER BY l.bssid) as bssids,
            t.lat,
            t.lon,
            t.accuracy,
            to_timestamp(t.time / 1000.0) as timestamp
          FROM app.observations l
          JOIN target_obs t ON 
            l.time = t.time 
            AND l.lat = t.lat 
            AND l.lon = t.lon
            AND l.accuracy = t.accuracy
          GROUP BY t.lat, t.lon, t.accuracy, t.time
        `, [bssid, time]);

      res.json({
        ok: true,
        data: rows[0] || null,
        isSuspicious: rows[0] && rows[0].total_observations >= 10,
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint to remove duplicate observations
  app.post('/api/admin/cleanup-duplicates', async (req, res, next) => {
    try {
      console.log('Removing duplicate observations...');

      // Count before
      const before = await query(`
          SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT (bssid, observed_at, latitude, longitude, accuracy_meters)) as unique_obs
          FROM app.observations
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        `);

      // Delete duplicates - keep first occurrence by unified_id
      const result = await query(`
          DELETE FROM app.observations
          WHERE unified_id IN (
            SELECT unified_id
            FROM (
              SELECT unified_id,
                ROW_NUMBER() OVER (
                  PARTITION BY bssid, observed_at, latitude, longitude, accuracy_meters 
                  ORDER BY unified_id
                ) as rn
              FROM app.observations
              WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            ) t
            WHERE rn > 1
          )
        `);

      // Count after
      const after = await query(`
          SELECT COUNT(*) as total
          FROM app.observations
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        `);

      console.log(`✓ Removed ${result.rowCount} duplicate observations`);

      res.json({
        ok: true,
        message: 'Duplicate observations removed',
        before: before.rows.length > 0 ? parseInt(before.rows[0].total) : 0,
        after: after.rows.length > 0 ? parseInt(after.rows[0].total) : 0,
        removed: result.rowCount,
      });
    } catch (err) {
      console.error('✗ Error removing duplicates:', err);
      next(err);
    }
  });

  // API endpoint to create/refresh co-location materialized view
  app.post('/api/admin/refresh-colocation', async (req, res, next) => {
    try {
      console.log('Creating/refreshing co-location materialized view...');

      // Drop existing view
      await query('DROP MATERIALIZED VIEW IF EXISTS app.network_colocation_scores CASCADE');

      // Create materialized view
      await query(`
          CREATE MATERIALIZED VIEW app.network_colocation_scores AS
          WITH network_locations AS (
            SELECT
              bssid,
              observed_at,
              ST_SnapToGrid(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geometry, 0.001) as location_grid,
              observed_at / 60000 as time_bucket
            FROM app.observations
            WHERE latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND (accuracy_meters IS NULL OR accuracy_meters <= 100)
              AND observed_at >= ${CONFIG.MIN_VALID_TIMESTAMP}
          ),
          colocation_pairs AS (
            SELECT 
              n1.bssid,
              COUNT(DISTINCT n2.bssid) as companion_count,
              COUNT(DISTINCT n1.location_grid) as shared_location_count
            FROM network_locations n1
            JOIN network_locations n2 ON 
              n1.location_grid = n2.location_grid
              AND n1.time_bucket = n2.time_bucket
              AND n1.bssid < n2.bssid
            GROUP BY n1.bssid
            HAVING COUNT(DISTINCT n2.bssid) >= 1 
              AND COUNT(DISTINCT n1.location_grid) >= 3
          )
          SELECT DISTINCT ON (bssid)
            bssid,
            companion_count,
            shared_location_count,
            LEAST(30, 
              CASE WHEN companion_count >= 3 THEN 30
                   WHEN companion_count >= 2 THEN 20
                   WHEN companion_count >= 1 THEN 10
                   ELSE 0 END
            ) as colocation_score,
            NOW() as computed_at
          FROM colocation_pairs
          UNION ALL
          SELECT 
            n2.bssid,
            COUNT(DISTINCT n1.bssid) as companion_count,
            COUNT(DISTINCT n1.location_grid) as shared_location_count,
            LEAST(30, 
              CASE WHEN COUNT(DISTINCT n1.bssid) >= 3 THEN 30
                   WHEN COUNT(DISTINCT n1.bssid) >= 2 THEN 20
                   WHEN COUNT(DISTINCT n1.bssid) >= 1 THEN 10
                   ELSE 0 END
            ) as colocation_score,
            NOW() as computed_at
          FROM network_locations n1
          JOIN network_locations n2 ON 
            n1.location_grid = n2.location_grid
            AND n1.time_bucket = n2.time_bucket
            AND n1.bssid < n2.bssid
          GROUP BY n2.bssid
          HAVING COUNT(DISTINCT n1.bssid) >= 1 
            AND COUNT(DISTINCT n1.location_grid) >= 3
          ORDER BY bssid, companion_count DESC
        `);

      // Create index
      await query('CREATE INDEX IF NOT EXISTS idx_colocation_bssid ON app.network_colocation_scores(bssid)');

      console.log('✓ Co-location view created successfully');

      res.json({
        ok: true,
        message: 'Co-location materialized view created/refreshed successfully',
      });
    } catch (err) {
      console.error('✗ Error creating co-location view:', err);
      next(err);
    }
  });

  // Load ML model with error handling
  let ThreatMLModel, mlModel;
  try {
    ThreatMLModel = require('./ml-trainer');
    mlModel = new ThreatMLModel();
    console.log('✓ ML model module loaded successfully');
  } catch (err) {
    console.warn('⚠️  ML model module not found or failed to load:', err.message);
    console.warn('⚠️  ML training endpoints will be disabled');
    mlModel = null;
  }

  // Train ML model on tagged networks
  app.post('/api/ml/train', requireAuth, async (req, res, next) => {
    try {
      if (!mlModel) {
        return res.status(503).json({
          ok: false,
          error: 'ML model module not available. Check server logs for details.',
        });
      }
      console.log('🤖 Training ML model on tagged networks...');

      // Fetch all tagged networks with features
      const { rows } = await query(`
          WITH home_location AS (
            SELECT location::geography as home_point
            FROM app.location_markers
            WHERE marker_type = 'home'
            LIMIT 1
          )
          SELECT
            nt.bssid,
            nt.tag_type,
            n.type,
            COUNT(DISTINCT l.unified_id) as observation_count,
            COUNT(DISTINCT DATE(to_timestamp(EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 / 1000.0))) as unique_days,
            COUNT(DISTINCT ST_SnapToGrid(ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geometry, 0.001)) as unique_locations,
            MAX(l.signal_dbm) as max_signal,
            MAX(ST_Distance(
              ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
              h.home_point
            )) / 1000.0 - MIN(ST_Distance(
              ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
              h.home_point
            )) / 1000.0 as distance_range_km,
            BOOL_OR(ST_Distance(
              ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
              h.home_point
            ) < 100) as seen_at_home,
            BOOL_OR(ST_Distance(
              ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
              h.home_point
            ) > 500) as seen_away_from_home
          FROM app.network_tags nt
          JOIN app.networks n ON nt.bssid = n.bssid
          JOIN app.observations l ON n.bssid = l.bssid
          CROSS JOIN home_location h
          WHERE nt.tag_type IN ('THREAT', 'FALSE_POSITIVE')
            AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
            AND EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 >= $1
          GROUP BY nt.bssid, nt.tag_type, n.type
        `, [CONFIG.MIN_VALID_TIMESTAMP]);

      if (rows.length < 10) {
        return res.status(400).json({
          ok: false,
          error: 'Need at least 10 tagged networks to train model',
          currentCount: rows.length,
        });
      }

      const trainingResult = await mlModel.train(rows);
      const sqlFormula = mlModel.generateSQLFormula();

      // Store model coefficients in database for persistence
      await query(`
          INSERT INTO app.ml_model_config (model_type, coefficients, intercept, feature_names, created_at)
          VALUES ('threat_logistic_regression', $1, $2, $3, NOW())
          ON CONFLICT (model_type) DO UPDATE
          SET coefficients = $1, intercept = $2, feature_names = $3, updated_at = NOW()
        `, [JSON.stringify(trainingResult.coefficients), trainingResult.intercept, JSON.stringify(trainingResult.featureNames)]);

      console.log('✓ ML model trained successfully');
      console.log('  Features:', trainingResult.featureNames.join(', '));
      console.log('  Training samples:', trainingResult.trainingSamples);
      console.log('  Threats:', trainingResult.threatCount, 'Safe:', trainingResult.safeCount);

      res.json({
        ok: true,
        message: 'Model trained successfully',
        ...trainingResult,
        sqlFormula: sqlFormula,
      });
    } catch (err) {
      console.error('✗ ML training error:', err);
      next(err);
    }
  });

  // Get ML model status
  app.get('/api/ml/status', async (req, res, next) => {
    try {
      const { rows } = await query(`
          SELECT model_type, feature_names, created_at, updated_at
          FROM app.ml_model_config
          WHERE model_type = 'threat_logistic_regression'
        `);

      const tagCount = await query(`
          SELECT tag_type, COUNT(*) as count
          FROM app.network_tags
          WHERE tag_type IN ('THREAT', 'FALSE_POSITIVE')
          GROUP BY tag_type
        `);

      res.json({
        ok: true,
        modelTrained: rows.length > 0,
        modelInfo: rows[0] || null,
        taggedNetworks: tagCount.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint for advanced threat detection
  app.get('/api/threats/detect', async (req, res, next) => {
    try {
      const { rows } = await query(`
          WITH home_location AS (
            -- Get home coordinates from location_markers
            SELECT
              ST_X(location::geometry) as home_lon,
              ST_Y(location::geometry) as home_lat,
              location::geography as home_point
            FROM app.location_markers
            WHERE marker_type = 'home'
            LIMIT 1
          ),
          network_locations AS (
            -- Get all networks with their observation locations
            SELECT
              n.bssid,
              n.ssid,
              n.type,
              n.encryption,
              l.latitude,
              l.longitude,
              EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 AS time,
              ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography as point,
              ROW_NUMBER() OVER (PARTITION BY n.bssid ORDER BY EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000) as obs_number,
              COUNT(*) OVER (PARTITION BY n.bssid) as total_observations
            FROM app.networks n
            JOIN app.observations l ON n.bssid = l.bssid
            WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
              AND EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 >= $1
              AND (l.accuracy_meters IS NULL OR l.accuracy_meters <= 100)
          ),
          threat_analysis AS (
            SELECT
              nl.bssid,
              nl.ssid,
              nl.type,
              nl.encryption,
              nl.total_observations,

              -- Distance from home for each observation (limit to 500 to prevent memory issues)
              ARRAY_AGG(
                ROUND(ST_Distance(nl.point, h.home_point)::numeric / 1000, 3)
                ORDER BY nl.time
                LIMIT 500
              ) as distances_from_home_km,

              -- Check if seen at home (within 100m)
              BOOL_OR(ST_Distance(nl.point, h.home_point) < 100) as seen_at_home,

              -- Check if seen far from home (>500m)
              BOOL_OR(ST_Distance(nl.point, h.home_point) > 500) as seen_away_from_home,

              -- Calculate max distance between ANY two observations
              MAX(ST_Distance(nl1.point, nl2.point)) / 1000 as max_distance_between_obs_km,

              -- Time span of observations
              MAX(nl.time) - MIN(nl.time) as observation_timespan_ms,

              -- Unique days observed
              COUNT(DISTINCT DATE(to_timestamp(nl.time / 1000.0))) as unique_days_observed,

              -- Average movement speed (if moved more than WiFi range)
              CASE
                WHEN MAX(nl.time) > MIN(nl.time) THEN
                  (MAX(ST_Distance(nl1.point, nl2.point)) / 1000.0) /
                  (EXTRACT(EPOCH FROM (to_timestamp(MAX(nl.time) / 1000.0) - to_timestamp(MIN(nl.time) / 1000.0))) / 3600.0)
                ELSE 0
              END as max_speed_kmh

            FROM network_locations nl
            CROSS JOIN home_location h
            LEFT JOIN network_locations nl1 ON nl.bssid = nl1.bssid
            LEFT JOIN network_locations nl2 ON nl.bssid = nl2.bssid AND nl1.obs_number < nl2.obs_number
            WHERE nl.total_observations >= 2
            GROUP BY nl.bssid, nl.ssid, nl.type, nl.encryption, nl.total_observations
          ),
          threat_classification AS (
            SELECT
              ta.*,
              nt.tag_type as user_tag,
              nt.confidence as user_confidence,
              nt.notes as user_notes,
              nt.user_override,
              -- Threat Score Calculation (0-100)
              COALESCE(nt.threat_score * 100, (
                -- High threat: Seen at home AND away (possible tracking device)
                CASE WHEN ta.seen_at_home AND ta.seen_away_from_home THEN 40 ELSE 0 END +

                -- Medium threat: Multiple distant observations beyond WiFi range (200m)
                CASE WHEN ta.max_distance_between_obs_km > 0.2 THEN 25 ELSE 0 END +

                -- High threat: Rapid movement (>50 km/h suggests vehicle tracking)
                CASE
                  WHEN ta.max_speed_kmh > 100 THEN 20  -- Very fast movement
                  WHEN ta.max_speed_kmh > 50 THEN 15   -- Highway speed
                  WHEN ta.max_speed_kmh > 20 THEN 10   -- City driving
                  ELSE 0
                END +

                -- Medium threat: Observed over multiple days (persistent tracking)
                CASE
                  WHEN ta.unique_days_observed >= 7 THEN 15
                  WHEN ta.unique_days_observed >= 3 THEN 10
                  WHEN ta.unique_days_observed >= 2 THEN 5
                  ELSE 0
                END +

                -- Low threat: Many observations (could be legitimate or surveillance)
                CASE
                  WHEN ta.total_observations >= 50 THEN 10
                  WHEN ta.total_observations >= 20 THEN 5
                  ELSE 0
                END
              )) as threat_score,

              -- Threat Type Classification
              CASE
                WHEN nt.tag_type = 'THREAT' THEN 'User Tagged Threat'
                WHEN nt.tag_type = 'INVESTIGATE' THEN 'User Tagged Investigate'
                WHEN nt.tag_type = 'FALSE_POSITIVE' THEN 'User Tagged False Positive'
                WHEN ta.seen_at_home AND ta.seen_away_from_home AND ta.max_speed_kmh > 20 THEN 'Mobile Tracking Device'
                WHEN ta.seen_at_home AND ta.seen_away_from_home THEN 'Potential Stalking Device'
                WHEN ta.max_distance_between_obs_km > 1 AND ta.unique_days_observed > 1 THEN 'Following Pattern Detected'
                WHEN ta.max_speed_kmh > 100 THEN 'High-Speed Vehicle Tracker'
                WHEN NOT ta.seen_at_home AND ta.max_distance_between_obs_km > 0.5 THEN 'Mobile Device (Non-Home)'
                ELSE 'Low Risk Movement'
              END as threat_type,

              -- Confidence Level
              COALESCE(nt.ml_confidence, (CASE
                WHEN ta.total_observations >= 10 AND ta.unique_days_observed >= 3 THEN 0.9
                WHEN ta.total_observations >= 5 THEN 0.7
                ELSE 0.4
              END)) as confidence

            FROM threat_analysis ta
            LEFT JOIN app.network_tags nt ON ta.bssid = nt.bssid
          )
          SELECT
            bssid,
            ssid,
            type,
            encryption,
            total_observations,
            threat_score,
            threat_type,
            confidence,
            seen_at_home,
            seen_away_from_home,
            max_distance_between_obs_km,
            observation_timespan_ms,
            unique_days_observed,
            ROUND(max_speed_kmh::numeric, 2) as max_speed_kmh,
            distances_from_home_km,
            user_tag,
            user_confidence,
            user_notes,
            user_override
          FROM threat_classification
          WHERE threat_score >= 30  -- Only return significant threats
            -- Filter out cellular networks (GSM, LTE, 5G) unless they have >5km distance range
            AND (
              type NOT IN ('G', 'L', 'N')
              OR max_distance_between_obs_km > 5
            )
          ORDER BY threat_score DESC, total_observations DESC
        `, [CONFIG.MIN_VALID_TIMESTAMP]);

      res.json({
        ok: true,
        threats: rows.map(row => ({
          bssid: row.bssid,
          ssid: row.ssid,
          type: row.type,
          encryption: row.encryption,
          totalObservations: row.total_observations,
          threatScore: parseInt(row.threat_score),
          threatType: row.threat_type,
          confidence: (row.confidence * 100).toFixed(0),
          patterns: {
            seenAtHome: row.seen_at_home,
            seenAwayFromHome: row.seen_away_from_home,
            maxDistanceBetweenObsKm: parseFloat(row.max_distance_between_obs_km),
            observationTimespanMs: row.observation_timespan_ms,
            uniqueDaysObserved: row.unique_days_observed,
            maxSpeedKmh: parseFloat(row.max_speed_kmh),
            distancesFromHomeKm: row.distances_from_home_km,
          },
          userTag: row.user_tag,
          userConfidence: row.user_confidence,
          userNotes: row.user_notes,
          userOverride: row.user_override,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint to get all observations for a specific network
  app.get('/api/networks/observations/:bssid', async (req, res, next) => {
    try {
      const { bssid } = req.params;

      // Get home location
      const homeResult = await query(`
          SELECT
            ST_X(location::geometry) as lon,
            ST_Y(location::geometry) as lat
          FROM app.location_markers
          WHERE marker_type = 'home'
          LIMIT 1
        `);

      const home = homeResult.rows[0] || null;

      // Get all observations for this BSSID
      const { rows } = await query(`
          SELECT
            l.unified_id as id,
            l.bssid,
            n.ssid,
            n.type,
            n.encryption,
            n.capabilities,
            l.latitude as lat,
            l.longitude as lon,
            l.signal_dbm as signal,
            EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 as time,
            l.accuracy_meters as acc,
            l.altitude_meters as alt,
            CASE
              WHEN $1::numeric IS NOT NULL AND $2::numeric IS NOT NULL THEN
                ST_Distance(
                  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
                  ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) / 1000.0
              ELSE NULL
            END as distance_from_home_km
          FROM app.observations l
          LEFT JOIN app.networks n ON l.bssid = n.bssid
          WHERE l.bssid = $3
            AND l.latitude IS NOT NULL
            AND l.longitude IS NOT NULL
            AND l.observed_at >= to_timestamp($4 / 1000.0)
            AND (l.accuracy_meters IS NULL OR l.accuracy_meters <= 100)
            -- Exclude suspicious batch imports (10+ networks at exact same observed_at/place)
            AND NOT EXISTS (
              SELECT 1 
              FROM app.observations dup
              WHERE dup.observed_at = l.observed_at 
                AND dup.latitude = l.latitude 
                AND dup.longitude = l.longitude
              GROUP BY dup.observed_at, dup.latitude, dup.longitude
              HAVING COUNT(DISTINCT dup.bssid) >= 50
            )
          ORDER BY l.observed_at ASC
        `, [home?.lon, home?.lat, bssid, CONFIG.MIN_VALID_TIMESTAMP]);

      res.json({
        ok: true,
        bssid: bssid,
        observations: rows,
        home: home,
        count: rows.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint to tag a network
  app.post('/api/tag-network', requireAuth, async (req, res, next) => {
    try {
      const { bssid, tag_type, confidence, notes } = req.body;

      // Validate and sanitize BSSID
      const cleanBSSID = sanitizeBSSID(bssid);
      if (!cleanBSSID) {
        return res.status(400).json({ error: 'Invalid BSSID format' });
      }

      // Validate tag_type
      const validTagTypes = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];
      if (!tag_type || !validTagTypes.includes(tag_type.toUpperCase())) {
        return res.status(400).json({ error: `Valid tag_type is required (one of: ${validTagTypes.join(', ')})` });
      }

      // Validate confidence
      const parsedConfidence = parseFloat(confidence);
      if (isNaN(parsedConfidence) || parsedConfidence < 0 || parsedConfidence > 100) {
        return res.status(400).json({ error: 'Confidence must be a number between 0 and 100' });
      }

      // Validate notes
      if (notes !== undefined && typeof notes !== 'string') {
        return res.status(400).json({ error: 'Notes must be a string' });
      }

      // Get SSID from networks table if available
      const networkResult = await query(`
          SELECT ssid FROM app.networks WHERE bssid = $1 LIMIT 1
        `, [cleanBSSID]);

      const ssid = networkResult.rows.length > 0 ? networkResult.rows[0].ssid : null;

      // Delete any existing tags for this BSSID (ensure only one tag per network)
      await query(`
          DELETE FROM app.network_tags WHERE bssid = $1
        `, [cleanBSSID]);

      // Insert the new tag
      const result = await query(`
          INSERT INTO app.network_tags (bssid, tag_type, confidence, notes)
          VALUES ($1, $2, $3, $4)
          RETURNING bssid, tag_type, confidence, threat_score, ml_confidence
        `, [cleanBSSID, tag_type.toUpperCase(), parsedConfidence / 100.0, notes || null]);

      res.json({
        ok: true,
        tag: result.rows[0],
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint to get tagged networks by tag type
  app.get('/api/networks/tagged', async (req, res, next) => {
    try {
      const { tag_type } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      // Validate tag_type
      const validTagTypes = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];
      if (!tag_type || !validTagTypes.includes(tag_type.toUpperCase())) {
        return res.status(400).json({ error: `Valid tag_type is required (one of: ${validTagTypes.join(', ')})` });
      }

      // Validate pagination
      if (page <= 0) {
        return res.status(400).json({ error: 'Invalid page parameter. Must be a positive integer.' });
      }
      if (limit <= 0 || limit > 1000) {
        return res.status(400).json({ error: 'Invalid limit parameter. Must be between 1 and 1000.' });
      }

      const offset = (page - 1) * limit;

      // Query networks with the specified tag with pagination
      const result = await query(`
          SELECT
            nt.bssid,
            n.ssid,
            nt.tag_type,
            nt.confidence,
            nt.notes,
            nt.tagged_at,
            nt.threat_score,
            n.type,
            n.bestlevel,
            COUNT(l.unified_id) as observation_count,
            MIN(EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000) as first_seen,
            MAX(EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000) as last_seen,
            (MAX(EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000) - MIN(EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000)) as observation_timespan_ms,
            COUNT(*) OVER() as total_count
          FROM app.network_tags nt
          LEFT JOIN app.networks n ON nt.bssid = n.bssid
          LEFT JOIN app.observations l ON nt.bssid = l.bssid
          WHERE nt.tag_type = $1
          GROUP BY nt.bssid, n.ssid, nt.tag_type, nt.confidence, nt.notes, nt.tagged_at, nt.threat_score, n.type, n.bestlevel
          ORDER BY nt.tagged_at DESC
          LIMIT $2 OFFSET $3
        `, [tag_type.toUpperCase(), limit, offset]);

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

      res.json({
        ok: true,
        networks: result.rows,
        totalCount,
        page,
        limit,
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint to delete a network tag (untag)
  app.delete('/api/tag-network/:bssid', requireAuth, async (req, res, next) => {
    try {
      const { bssid } = req.params;

      // Validate and sanitize BSSID
      const cleanBSSID = sanitizeBSSID(bssid);
      if (!cleanBSSID) {
        return res.status(400).json({ error: 'Invalid BSSID format' });
      }

      // Delete all tags for this BSSID
      const result = await query(`
          DELETE FROM app.network_tags
          WHERE bssid = $1
          RETURNING bssid, tag_type
        `, [cleanBSSID]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No tags found for this BSSID' });
      }

      res.json({
        ok: true,
        removed: result.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint to get manufacturer from BSSID
  app.get('/api/manufacturer/:bssid', async (req, res, next) => {
    try {
      const { bssid } = req.params;

      // Validate bssid (MAC address or cellular tower identifier)
      if (!bssid || typeof bssid !== 'string' || bssid.trim() === '') {
        return res.status(400).json({ error: 'Valid BSSID or tower identifier is required' });
      }


      // Query the radio_manufacturers table
      // Remove colons from BSSID for matching (e.g., "AA:BB:CC:DD:EE:FF" -> "AABBCC")
      const { rows } = await query(`
          SELECT organization_name
          FROM app.radio_manufacturers
          WHERE UPPER(REPLACE($1, ':', '')) LIKE UPPER(oui_prefix_24bit) || '%'
          LIMIT 1
        `, [bssid]);

      if (rows.length > 0) {
        res.json({
          ok: true,
          manufacturer: rows[0].organization_name,
        });
      } else {
        res.json({
          ok: true,
          manufacturer: null,
        });
      }
    } catch (err) {
      next(err);
    }
  });

  // API endpoint to get networks with location data
  app.get('/api/networks', async (req, res, next) => {
    try {
      // Pagination parameters
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);

      if (isNaN(page) || page <= 0) {
        return res.status(400).json({ error: 'Invalid page parameter. Must be a positive integer.' });
      }
      if (isNaN(limit) || limit <= 0 || limit > 5000) {
        return res.status(400).json({ error: 'Invalid limit parameter. Must be between 1 and 5000.' });
      }

      const offset = (page - 1) * limit;

      // Filter parameters
      const search = req.query.search || '';
      const type = req.query.type || '';
      const security = req.query.security || '';
      const minSignal = req.query.minSignal ? parseInt(req.query.minSignal) : null;
      const maxSignal = req.query.maxSignal ? parseInt(req.query.maxSignal) : null;

      // Validate filter parameters if they are present
      if (search && typeof search !== 'string') {
        return res.status(400).json({ error: 'Search parameter must be a string.' });
      }
      if (type && typeof type !== 'string') {
        return res.status(400).json({ error: 'Type parameter must be a string.' });
      }
      if (security && typeof security !== 'string') {
        return res.status(400).json({ error: 'Security parameter must be a string.' });
      }
      if (minSignal !== null && isNaN(minSignal)) {
        return res.status(400).json({ error: 'minSignal parameter must be a valid number.' });
      }
      if (maxSignal !== null && isNaN(maxSignal)) {
        return res.status(400).json({ error: 'maxSignal parameter must be a valid number.' });
      }

      // Sorting parameters
      const sort = req.query.sort || 'lastSeen'; // Default sort column
      const order = (req.query.order || 'DESC').toUpperCase(); // Default sort order

      // Map frontend sort columns to database fields
      const sortColumnMap = {
        type: 'n.type',
        ssid: 'n.ssid',
        bssid: 'n.bssid',
        signal: 'COALESCE(l.signal_dbm, n.bestlevel)',
        security: 'n.encryption',
        frequency: 'n.frequency',
        channel: 'n.channel',
        observations: 'COALESCE(oc.obs_count, 1)',
        latitude: 'COALESCE(l.latitude, n.bestlat, n.lastlat, n.trilaterated_lat)',
        longitude: 'COALESCE(l.longitude, n.bestlon, n.lastlon, n.trilaterated_lon)',
        distanceFromHome: 'distance_from_home', // Alias from subquery
        accuracy: 'COALESCE(l.accuracy_meters, 0)',
        lastSeen: 'lastseen',
      };

      // Validate sort column
      if (!sortColumnMap[sort]) {
        return res.status(400).json({ error: `Invalid sort column: ${sort}. Allowed: ${Object.keys(sortColumnMap).join(', ')}` });
      }

      // Validate sort order
      if (!['ASC', 'DESC'].includes(order)) {
        return res.status(400).json({ error: 'Invalid sort order. Must be ASC or DESC.' });
      }

      const orderByClause = sort === 'lastSeen' ? `${sortColumnMap[sort]} ${order} NULLS LAST` : `${sortColumnMap[sort]} ${order}`;

      // Get home location for distance calculation
      const homeResult = await query(`
          SELECT
            ST_X(location::geometry) as lon,
            ST_Y(location::geometry) as lat
          FROM app.location_markers
          WHERE marker_type = 'home'
          LIMIT 1
        `);
      const home = homeResult.rows[0] || null;

      // Base query with filtering and sorting applied before pagination
      let queryText = `
          WITH latest_locations AS (
            SELECT DISTINCT ON (bssid)
              bssid, latitude, longitude, signal_dbm, accuracy_meters, observed_at
            FROM app.observations
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND observed_at >= to_timestamp($1 / 1000.0)
            ORDER BY bssid, observed_at DESC
          ),
          latest_times AS (
            SELECT DISTINCT ON (bssid)
              bssid, observed_at as last_time
            FROM app.observations
            WHERE observed_at IS NOT NULL
            ORDER BY bssid, observed_at DESC
          ),
          observation_counts AS (
            SELECT bssid, COUNT(*) as obs_count
            FROM app.observations
            WHERE observed_at >= to_timestamp($1 / 1000.0)
            GROUP BY bssid
          )
          SELECT
            n.unified_id, n.ssid, n.bssid, n.type,
            -- Parse security from capabilities field
            CASE
              -- Bluetooth/BLE use different security models
              WHEN n.type IN ('B', 'E') THEN 'N/A'
              -- WiFi security parsing
              WHEN UPPER(n.capabilities) LIKE '%WPA3%' OR UPPER(n.capabilities) LIKE '%SAE%' THEN
                CASE WHEN UPPER(n.capabilities) LIKE '%EAP%' OR UPPER(n.capabilities) LIKE '%MGT%' THEN 'WPA3-E' ELSE 'WPA3-P' END
              WHEN UPPER(n.capabilities) LIKE '%WPA2%' OR UPPER(n.capabilities) LIKE '%RSN%' THEN
                CASE WHEN UPPER(n.capabilities) LIKE '%EAP%' OR UPPER(n.capabilities) LIKE '%MGT%' THEN 'WPA2-E' ELSE 'WPA2-P' END
              WHEN UPPER(n.capabilities) LIKE '%WPA-%' AND UPPER(n.capabilities) NOT LIKE '%WPA2%' THEN 'WPA'
              WHEN UPPER(n.capabilities) LIKE '%WEP%' OR LOWER(n.encryption) = 'wep' THEN 'WEP'
              WHEN UPPER(n.capabilities) LIKE '%WPS%' AND UPPER(n.capabilities) NOT LIKE '%WPA%' THEN 'WPS'
              WHEN LOWER(n.encryption) = 'wpa3' THEN 'WPA3-P'
              WHEN LOWER(n.encryption) = 'wpa2' THEN 'WPA2-P'
              WHEN LOWER(n.encryption) = 'wpa' THEN 'WPA'
              WHEN n.capabilities IS NOT NULL AND n.capabilities != '' AND n.capabilities != 'Misc' AND n.capabilities != 'Uncategorized;10' THEN 'Unknown'
              ELSE 'OPEN'
            END as security,
            n.frequency, n.channel,
            CASE
              WHEN COALESCE(l.signal_dbm, n.bestlevel, 0) = 0 THEN NULL
              ELSE COALESCE(l.signal_dbm, n.bestlevel)
            END as signal,
            COALESCE(l.accuracy_meters, 0) as accuracy_meters,
            COALESCE(lt.last_time, l.observed_at, to_timestamp(n.lasttime / 1000.0)) as lastseen,
            COALESCE(l.latitude, n.bestlat, n.lastlat, n.trilaterated_lat) as lat,
            COALESCE(l.longitude, n.bestlon, n.lastlon, n.trilaterated_lon) as lng,
            COALESCE(oc.obs_count, 1) as observations, n.capabilities as misc,
            rm.organization_name as manufacturer,
            CASE
              WHEN COALESCE(l.signal_dbm, n.bestlevel, -999) = 0 OR COALESCE(l.signal_dbm, n.bestlevel) IS NULL THEN 'safe'
              WHEN COALESCE(l.signal_dbm, n.bestlevel) > -50 THEN 'threat'
              WHEN COALESCE(l.signal_dbm, n.bestlevel) > -70 THEN 'warning'
              ELSE 'safe'
            END as status,
            CASE
              WHEN $2::double precision IS NOT NULL AND $3::double precision IS NOT NULL
                AND COALESCE(l.latitude, n.bestlat) IS NOT NULL AND COALESCE(l.longitude, n.bestlon) IS NOT NULL
              THEN ST_Distance(
                ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
                ST_SetSRID(ST_MakePoint(COALESCE(l.longitude, n.bestlon), COALESCE(l.latitude, n.bestlat)), 4326)::geography
              ) / 1000.0
              ELSE NULL
            END as distance_from_home,
            COUNT(*) OVER() as total_networks_count -- Total count before LIMIT/OFFSET
          FROM app.networks n
          LEFT JOIN latest_locations l ON n.bssid = l.bssid
          LEFT JOIN latest_times lt ON n.bssid = lt.bssid
          LEFT JOIN observation_counts oc ON n.bssid = oc.bssid
          LEFT JOIN app.radio_manufacturers rm ON UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', '')) = rm.oui_prefix_24bit
        `;

      // Parameters for the query
      const params = [
        CONFIG.MIN_VALID_TIMESTAMP,
        home?.latitude || null,
        home?.longitude || null,
      ];

      // WHERE clauses
      const whereClauses = [
        'n.bssid IS NOT NULL',
        '(n.lasttime IS NULL OR to_timestamp(n.lasttime / 1000.0) >= to_timestamp($1 / 1000.0))',
        'n.bestlevel != 0', // Exclude orphans (those with 0 dBm have no real observations)
      ];

      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        whereClauses.push(`(LOWER(n.ssid) LIKE $${params.length} OR LOWER(n.bssid) LIKE $${params.length})`);
      }
      if (type) {
        params.push(type);
        whereClauses.push(`n.type = $${params.length}`);
      }
      if (security) {
        params.push(`%${security.toLowerCase()}%`);
        whereClauses.push(`LOWER(n.encryption) LIKE $${params.length}`);
      }
      if (minSignal !== null) {
        params.push(minSignal);
        whereClauses.push(`COALESCE(l.signal_dbm, n.bestlevel) >= $${params.length}`);
      }
      if (maxSignal !== null) {
        params.push(maxSignal);
        whereClauses.push(`COALESCE(l.signal_dbm, n.bestlevel) <= $${params.length}`);
      }

      if (whereClauses.length > 0) {
        queryText += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      // Add ordering, pagination
      queryText += ` ORDER BY ${orderByClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      // Join networks with observations to get the latest location data
      const { rows } = await query(queryText, params);

      const totalCount = rows.length > 0 ? parseInt(rows[0].total_networks_count) : 0;

      const networks = rows.map(row => {
        return {
          id: row.unified_id,
          ssid: row.ssid,
          bssid: row.bssid,
          type: row.type || 'W',
          security: row.security,
          capabilities: row.misc,
          encryption: row.security,
          frequency: row.frequency ? parseFloat(row.frequency) / 1000 : null,
          channel: row.channel ? parseInt(row.channel) : null,
          signal: row.signal ? parseInt(row.signal) : null,
          accuracy: row.accuracy_meters ? parseFloat(row.accuracy_meters) : 0,
          observations: row.observations ? parseInt(row.observations) : 1,
          manufacturer: row.manufacturer || 'Unknown',
          lastSeen: row.lastseen ? new Date(row.lastseen).getTime() : null,
          timestamp: row.lastseen ? new Date(row.lastseen).getTime() : null,
          time: row.lastseen ? new Date(row.lastseen).getTime() : null,
          status: row.status,
          distanceFromHome: row.distance_from_home ? parseFloat(row.distance_from_home) : null,
          latitude: row.lat ? parseFloat(row.lat) : null,
          longitude: row.lng ? parseFloat(row.lng) : null,
          misc: row.misc,
          location: {
            lat: row.lat ? parseFloat(row.lat) : null,
            lng: row.lng ? parseFloat(row.lng) : null,
          },
        };
      });

      res.json({
        networks,
        total: totalCount,
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (err) {
      next(err);
    }
  });

  // API endpoint to search for networks by SSID
  app.get('/api/networks/search/:ssid', async (req, res, next) => {
    try {
      const { ssid } = req.params;

      // Validate ssid
      if (!ssid || typeof ssid !== 'string' || ssid.trim() === '') {
        return res.status(400).json({ error: 'SSID parameter is required and cannot be empty.' });
      }
      const searchPattern = `%${ssid}%`;

      const { rows } = await query(`
          SELECT
            n.unified_id,
            n.ssid,
            n.bssid,
            n.type,
            n.encryption,
            n.bestlevel as signal,
            n.lasttime,
            COUNT(DISTINCT l.unified_id) as observation_count
          FROM app.networks n
          LEFT JOIN app.observations l ON n.bssid = l.bssid
          WHERE n.ssid ILIKE $1
          GROUP BY n.unified_id, n.ssid, n.bssid, n.type, n.encryption, n.bestlevel, n.lasttime
          ORDER BY observation_count DESC
          LIMIT 50
        `, [searchPattern]);

      res.json({
        ok: true,
        query: ssid,
        count: rows.length,
        networks: rows,
      });
    } catch (err) {
      next(err);
    }
  });

  // Centralized error handling middleware
  app.use(errorHandler);

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing database pool...');
    await pool.end();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, closing database pool...');
    await pool.end();
    process.exit(0);
  });

} catch (err) {
  console.error('Server startup error:', err);
  process.exit(1);
}
