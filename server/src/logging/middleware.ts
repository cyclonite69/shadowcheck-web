/**
 * Logging Middleware
 * Provides request/response logging and request ID tracking
 */

import type { Request, Response, NextFunction } from 'express';

const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

export {};

/**
 * Request ID middleware
 * Adds unique ID to each request for tracing across logs
 */
function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id!);

  // Create request-scoped logger
  req.logger = logger.createRequestLogger(req.id);

  next();
}

/**
 * Request logging middleware
 * Logs incoming requests with method, path, IP, user agent
 */
function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Log the incoming request
  req.logger.http({
    message: `Incoming: ${req.method} ${req.path}`,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    query: req.query,
  });

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function (data: unknown) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    req.logger.http({
      message: `Response: ${req.method} ${req.path} ${statusCode}`,
      method: req.method,
      path: req.path,
      statusCode,
      durationMs: duration,
      ip: req.ip,
    });

    return originalJson.call(this, data);
  };

  next();
}

/**
 * Error logging middleware
 * Logs errors with full context
 * Should be registered after error handler
 */
function errorLoggingMiddleware(
  err: Error & { statusCode?: number; code?: string; detail?: string },
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;

  req.logger.error({
    message: `Error: ${err.message}`,
    code: err.code,
    statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  next(err);
}

/**
 * Security event logging
 * Logs suspicious activity
 */
function logSecurityEvent(req: Request, event: string, details: Record<string, unknown> = {}) {
  req.logger.warn({
    message: `Security: ${event}`,
    event,
    path: req.path,
    method: req.method,
    ip: req.ip,
    ...details,
  });
}

/**
 * Performance monitoring middleware
 * Tracks and logs slow requests
 */
function performanceMiddleware(slowThresholdMs = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Override res.json to check duration
    const originalJson = res.json.bind(res);
    res.json = function (data: unknown) {
      const duration = Date.now() - startTime;

      if (duration > slowThresholdMs) {
        req.logger.warn({
          message: `Slow request: ${req.method} ${req.path}`,
          path: req.path,
          method: req.method,
          durationMs: duration,
          threshold: slowThresholdMs,
          ip: req.ip,
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Database query logging
 * Call from database query wrapper
 */
function logQuery(query: string, params: unknown[] = [], durationMs: number = 0) {
  logger.debug({
    message: 'Database query',
    query: query.substring(0, 500), // Truncate long queries
    paramCount: params.length,
    durationMs,
  });
}

/**
 * Database query error logging
 */
function logQueryError(
  query: string,
  params: unknown[] = [],
  error: Error & { code?: string; detail?: string }
) {
  logger.error({
    message: `Database query error: ${error.message}`,
    code: error.code,
    query: query.substring(0, 500),
    paramCount: params.length,
    detail: error.detail,
  });
}

/**
 * HTTP status code to log level mapper
 */
function getLogLevelForStatus(statusCode: number): string {
  if (statusCode >= 500) {
    return 'error';
  }
  if (statusCode >= 400) {
    return 'warn';
  }
  if (statusCode >= 300) {
    return 'info';
  }
  return 'info';
}

/**
 * Compliance audit logging
 * Logs data access for compliance requirements
 */
function logDataAccess(req: Request, resource: string, action: string, recordCount: number = 0) {
  logger.info({
    message: `Data access: ${action} ${resource}`,
    action,
    resource,
    recordCount,
    userId: req.user?.id || 'anonymous',
    path: req.path,
    ip: req.ip,
  });
}

module.exports = {
  requestIdMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  performanceMiddleware,
  logSecurityEvent,
  logQuery,
  logQueryError,
  logDataAccess,
  getLogLevelForStatus,
};
