/**
 * Middleware initialization helpers.
 */
import type { Express } from 'express';

interface MiddlewareOptions {
  forceHttps: boolean;
  allowedOrigins: string[];
}

/**
 * Register core middleware in the correct order.
 */
function initializeMiddleware(app: Express, options: MiddlewareOptions): void {
  const { forceHttps, allowedOrigins } = options;

  // Request ID middleware (first, so all requests have IDs)
  const requestIdMiddleware = require('../middleware/requestId').default;
  app.use(requestIdMiddleware);

  // HTTPS redirect (if enabled)
  if (forceHttps) {
    const { createHttpsRedirect } = require('../middleware/httpsRedirect');
    app.use(createHttpsRedirect());
  }

  const { createSecurityHeaders } = require('../middleware/securityHeaders');
  app.use(createSecurityHeaders(forceHttps));

  const { mountCommonMiddleware } = require('../middleware/commonMiddleware');
  mountCommonMiddleware(app, { allowedOrigins });

  // Cookie parser for session management
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());
}

export { initializeMiddleware, MiddlewareOptions };
