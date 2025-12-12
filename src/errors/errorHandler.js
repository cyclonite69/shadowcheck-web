/**
 * Error Handler Middleware
 * Centralized error handling that safely converts errors to HTTP responses
 * Logs errors appropriately based on environment and error type
 */

const { isAppError, toAppError } = require('./AppError');

/**
 * Main error handler middleware
 * Should be registered after all other middleware and routes
 * @param {object} logger - Logger instance (winston/pino)
 * @returns {function} Express error handling middleware
 */
function createErrorHandler(logger) {
  return (err, req, res, _next) => {
    // Convert unknown errors to AppError
    const appError = isAppError(err) ? err : toAppError(err);

    // Log error appropriately
    logError(appError, req, logger);

    // Determine if we should include stack trace (development only)
    const includeStack = process.env.NODE_ENV === 'development';

    // Return error response
    const statusCode = appError.statusCode || 500;
    const errorBody = appError.toJSON(includeStack);

    res.status(statusCode).json(errorBody);
  };
}

/**
 * Logs errors appropriately based on severity and environment
 * @param {AppError} error - The app error to log
 * @param {object} req - Express request object
 * @param {object} logger - Logger instance
 */
function logError(error, req, logger) {
  const logData = {
    timestamp: new Date().toISOString(),
    code: error.code,
    statusCode: error.statusCode,
    message: error.message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    requestId: req.id || req.headers['x-request-id'] || 'no-id',
  };

  // Log based on severity
  if (error.statusCode >= 500) {
    // Server errors - log with full details
    logger.error({
      ...logData,
      stack: error.stack,
      query: error.query,
      details: error.details,
    });
  } else if (error.statusCode >= 400) {
    // Client errors - log with warning level
    logger.warn({
      ...logData,
      details: error.details,
    });
  } else {
    // Informational - debug level
    logger.debug(logData);
  }
}

/**
 * Async route wrapper to catch errors
 * Wraps route handlers to automatically catch and forward errors
 * @param {function} handler - Express route handler
 * @returns {function} Wrapped handler that catches errors
 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Should be registered after all other routes
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next
 */
function notFoundHandler(req, res, next) {
  const { NotFoundError } = require('./AppError');
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
}

/**
 * Error response formatter for specific error types
 * Allows customizing error responses for specific scenarios
 */
class ErrorResponseBuilder {
  constructor(error) {
    this.error = error;
    this.customMessage = null;
    this.additionalData = {};
  }

  /**
   * Set custom user message
   */
  withMessage(message) {
    this.customMessage = message;
    return this;
  }

  /**
   * Add additional data to response
   */
  withData(data) {
    this.additionalData = data;
    return this;
  }

  /**
   * Build final response
   */
  build(includeStack = false) {
    const response = this.error.toJSON(includeStack);

    if (this.customMessage) {
      response.error.message = this.customMessage;
    }

    if (Object.keys(this.additionalData).length > 0) {
      response.error.data = this.additionalData;
    }

    return response;
  }
}

/**
 * Validation error formatter
 * Specific handler for validation errors
 */
function handleValidationError(error, req, res) {
  return res.status(error.statusCode).json({
    ok: false,
    error: {
      message: error.message,
      code: error.code,
      details: error.details || [],
    },
  });
}

/**
 * Database error formatter
 * Specific handler for database errors
 */
function handleDatabaseError(error, req, res) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response = {
    ok: false,
    error: {
      message: error.getUserMessage(),
      code: error.code,
    },
  };

  // In development, include database details
  if (isDevelopment && error.originalError) {
    response.error.database = {
      code: error.originalError.code,
      message: error.originalError.message,
    };
  }

  return res.status(error.statusCode).json(response);
}

/**
 * Rate limit error formatter
 * Specific handler for rate limit errors
 */
function handleRateLimitError(error, req, res) {
  res.set('Retry-After', error.retryAfter.toString());
  return res.status(error.statusCode).json({
    ok: false,
    error: {
      message: error.getUserMessage(),
      code: error.code,
      retryAfter: error.retryAfter,
    },
  });
}

module.exports = {
  createErrorHandler,
  logError,
  asyncHandler,
  notFoundHandler,
  ErrorResponseBuilder,
  handleValidationError,
  handleDatabaseError,
  handleRateLimitError,
};
