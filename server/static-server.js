/**
 * Production Static Server for ShadowCheck
 *
 * Serves the built React app from dist/ with proper security headers.
 * Proxies /api/* requests to the backend API server.
 * Use this for Lighthouse audits and production-like testing.
 *
 * Usage:
 *   npm run build && npm run serve:dist
 *
 * Then run Lighthouse against http://localhost:4000
 */

const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');

const PORT = process.env.STATIC_PORT || 4000;
const API_TARGET = process.env.API_TARGET || 'http://localhost:3001';
const DIST_DIR = path.join(__dirname, '..', 'dist');

// Parse API target URL
const apiUrl = new URL(API_TARGET);

const app = express();

// =============================================================================
// API PROXY (must be BEFORE security headers and static files)
// =============================================================================
app.use('/api', (req, res) => {
  const proxyPath = `/api${req.url}`; // req.url includes query string

  // Determine protocol and select appropriate HTTP module
  const isHttps = apiUrl.protocol === 'https:';
  const httpModule = isHttps ? https : http;
  const defaultPort = isHttps ? 443 : 80;

  const options = {
    hostname: apiUrl.hostname,
    port: apiUrl.port || defaultPort,
    path: proxyPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: apiUrl.host, // Set correct host header for upstream
    },
  };

  const proxyReq = httpModule.request(options, (proxyRes) => {
    // Forward status and headers from upstream (don't add security headers to API responses)
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    // Stream response body
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy Error] ${req.method} ${proxyPath}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({
        ok: false,
        error: 'api_proxy_error',
        message: `Failed to reach API at ${API_TARGET}`,
      });
    }
  });

  // Stream request body to upstream (for POST/PUT/PATCH)
  req.pipe(proxyReq);
});

// =============================================================================
// SECURITY HEADERS MIDDLEWARE (for static files only, after proxy)
// =============================================================================
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable unnecessary browser features
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Cross-Origin-Opener-Policy
  // NOTE: 'same-origin' can break Mapbox popups and OAuth flows.
  // Using 'same-origin-allow-popups' as a safer alternative.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // Cross-Origin-Resource-Policy
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  // Content-Security-Policy
  // Allows: self, Mapbox CDN (tiles, sprites, glyphs, API), inline styles (Mapbox requires this)
  const csp = [
    // Default: only self
    "default-src 'self'",

    // Scripts: self + Mapbox CDN + DeckGL (for KeplerTestPage)
    // 'unsafe-eval' is required by Mapbox GL JS for WebGL shader compilation
    "script-src 'self' https://api.mapbox.com https://cdn.jsdelivr.net 'unsafe-eval'",

    // Styles: self + Mapbox + Google Fonts + inline (Mapbox injects styles dynamically)
    "style-src 'self' https://api.mapbox.com https://fonts.googleapis.com 'unsafe-inline'",

    // Images: self + Mapbox tiles + data URIs (for inline SVGs)
    "img-src 'self' https://*.mapbox.com https://api.mapbox.com data: blob:",

    // Fonts: self + Mapbox glyphs + Google Fonts
    "font-src 'self' https://api.mapbox.com https://fonts.gstatic.com",

    // Connect: self + API + Mapbox services + tiles
    "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com",

    // Workers: self + blob (Mapbox uses web workers)
    "worker-src 'self' blob:",

    // Child/frame: none (we don't use iframes)
    "frame-src 'none'",

    // Object: none (no plugins)
    "object-src 'none'",

    // Base URI: self
    "base-uri 'self'",

    // Form action: self
    "form-action 'self'",

    // Frame ancestors: none (prevent embedding)
    "frame-ancestors 'none'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);

  next();
});

// =============================================================================
// STATIC FILE SERVING WITH CACHING
// =============================================================================

// Hashed assets: long cache (1 year, immutable)
app.use(
  '/assets',
  express.static(path.join(DIST_DIR, 'assets'), {
    maxAge: '1y',
    immutable: true,
    etag: false,
  })
);

// Other static files: short cache with validation
app.use(
  express.static(DIST_DIR, {
    maxAge: 0,
    etag: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// =============================================================================
// SPA FALLBACK
// =============================================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// =============================================================================
// START SERVER
// =============================================================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  ShadowCheck Static Server                                     ║
║  Serving dist/ with security headers                           ║
╠════════════════════════════════════════════════════════════════╣
║  URL:     http://localhost:${PORT}                               ║
║  Proxy:   /api -> ${API_TARGET.padEnd(43)}║
║  Headers: CSP, X-Frame-Options, COOP, Permissions-Policy       ║
╠════════════════════════════════════════════════════════════════╣
║  Run Lighthouse against this server for accurate audits.       ║
╚════════════════════════════════════════════════════════════════╝
  `);
});
