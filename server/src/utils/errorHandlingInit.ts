/**
 * Error handling initialization helpers.
 */
import type { Express } from 'express';

interface Logger {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
  debug: (message: string, meta?: unknown) => void;
}

/**
 * Register 404 and global error handlers.
 */
function registerErrorHandlers(app: Express, logger: Logger): void {
  const { createErrorHandler, notFoundHandler } = require('../errors/errorHandler');
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
}

export { registerErrorHandlers };
