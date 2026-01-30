/**
 * Middleware initialization helpers.
 */

/**
 * Register core middleware in the correct order.
 * @param {import('express').Express} app - Express app instance
 * @param {{ forceHttps: boolean, allowedOrigins: string[] }} options - Middleware options
 */
function initializeMiddleware(app, options) {
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

module.exports = {
  initializeMiddleware,
};
