/**
 * Error Handler Middleware
 * Centralized error handling that safely converts errors to HTTP responses
 * Logs errors appropriately based on environment and error type
 */
import type { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';
import { isAppError, toAppError, AppError, NotFoundError } from './AppError';

interface Logger {
  info: (data: unknown) => void;
  warn: (data: unknown) => void;
  error: (data: unknown) => void;
  debug: (data: unknown) => void;
}

interface ErrorLogData {
  timestamp: string;
  code: string;
  statusCode: number;
  message: string;
  path: string;
  method: string;
  ip: string | undefined;
  userId: string;
  requestId: string | undefined;
  stack?: string;
  query?: string | null;
  details?: unknown;
}

interface ErrorWithExtras extends AppError {
  query?: string | null;
  details?: unknown;
  originalError?: { code?: string; message: string };
  retryAfter?: number;
}

/**
 * Main error handler middleware
 * Should be registered after all other middleware and routes
 */
function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    // Convert unknown errors to AppError
    const appError = isAppError(err) ? err : toAppError(err);

    // Log error appropriately
    logError(appError as ErrorWithExtras, req, logger);

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
 */
function logError(error: ErrorWithExtras, req: Request, logger: Logger): void {
  const logData: ErrorLogData = {
    timestamp: new Date().toISOString(),
    code: error.code,
    statusCode: error.statusCode,
    message: error.message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    requestId: req.requestId || (req.headers['x-request-id'] as string | undefined),
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
 */
function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Should be registered after all other routes
 */
const notFoundHandler: RequestHandler = (req, _res, next) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
};

/**
 * Error response formatter for specific error types
 * Allows customizing error responses for specific scenarios
 */
class ErrorResponseBuilder {
  private error: AppError;
  private customMessage: string | null = null;
  private additionalData: Record<string, unknown> = {};

  constructor(error: AppError) {
    this.error = error;
  }

  /**
   * Set custom user message
   */
  withMessage(message: string): this {
    this.customMessage = message;
    return this;
  }

  /**
   * Add additional data to response
   */
  withData(data: Record<string, unknown>): this {
    this.additionalData = data;
    return this;
  }

  /**
   * Build final response
   */
  build(
    includeStack = false
  ): ReturnType<AppError['toJSON']> & { error: { data?: Record<string, unknown> } } {
    const response = this.error.toJSON(includeStack) as ReturnType<AppError['toJSON']> & {
      error: { data?: Record<string, unknown> };
    };

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
function handleValidationError(error: ErrorWithExtras, _req: Request, res: Response): Response {
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
function handleDatabaseError(error: ErrorWithExtras, _req: Request, res: Response): Response {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response: {
    ok: false;
    error: {
      message: string;
      code: string;
      database?: { code: string | undefined; message: string };
    };
  } = {
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
function handleRateLimitError(error: ErrorWithExtras, _req: Request, res: Response): Response {
  res.set('Retry-After', String(error.retryAfter || 60));
  return res.status(error.statusCode).json({
    ok: false,
    error: {
      message: error.getUserMessage(),
      code: error.code,
      retryAfter: error.retryAfter,
    },
  });
}

export {
  createErrorHandler,
  logError,
  asyncHandler,
  notFoundHandler,
  ErrorResponseBuilder,
  handleValidationError,
  handleDatabaseError,
  handleRateLimitError,
};
