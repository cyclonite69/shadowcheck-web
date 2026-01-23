/**
 * Error handling initialization helpers.
 */

/**
 * Register 404 and global error handlers.
 * @param {import('express').Express} app - Express app instance
 * @param {object} logger - Logger instance
 */
function registerErrorHandlers(app, logger) {
  const { createErrorHandler, notFoundHandler } = require('../errors/errorHandler');
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
}

module.exports = {
  registerErrorHandlers,
};
