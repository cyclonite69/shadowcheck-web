/**
 * Structured Logging Configuration
 * Uses Winston for enterprise-grade logging with:
 * - Multiple transports (console, file)
 * - Log levels (debug, info, warn, error)
 * - Structured JSON output
 * - Automatic log rotation
 * - Request/response logging
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../data/logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Define log levels
 * Ordered by severity (most to least severe)
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * Define log colors for console output
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

/**
 * Format function for structured JSON logging
 */
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }), // Capture stack traces
  winston.format.splat(), // String interpolation
  winston.format.json() // JSON format
);

/**
 * Console transport - pretty output for development
 */
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
});

/**
 * File transports - persistent logging
 */
const errorFileTransport = new winston.transports.File({
  filename: path.join(logsDir, 'error.log'),
  level: 'error',
  format,
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

const combinedFileTransport = new winston.transports.File({
  filename: path.join(logsDir, 'combined.log'),
  format,
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

const debugFileTransport = new winston.transports.File({
  filename: path.join(logsDir, 'debug.log'),
  level: 'debug',
  format,
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports: [consoleTransport, errorFileTransport, combinedFileTransport, debugFileTransport],
});

/**
 * Stream interface for Morgan HTTP logging
 */
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

/**
 * Helper: Log API request
 */
logger.logRequest = function (req) {
  this.http({
    message: `${req.method} ${req.path}`,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
};

/**
 * Helper: Log API response
 */
logger.logResponse = function (req, statusCode, duration) {
  const level = statusCode >= 400 ? 'warn' : 'info';
  this[level]({
    message: `${req.method} ${req.path} ${statusCode}`,
    method: req.method,
    path: req.path,
    statusCode,
    durationMs: duration,
    ip: req.ip,
  });
};

/**
 * Helper: Log database query
 */
logger.logQuery = function (query, params, duration) {
  this.debug({
    message: 'Database query',
    query: query.substring(0, 200), // Truncate for logs
    paramCount: params?.length || 0,
    durationMs: duration,
  });
};

/**
 * Helper: Log security event
 */
logger.logSecurityEvent = function (event, details) {
  this.warn({
    message: `Security: ${event}`,
    event,
    ...details,
  });
};

/**
 * Helper: Log performance metric
 */
logger.logPerformance = function (metric, value, unit = 'ms') {
  this.info({
    message: `Performance: ${metric}`,
    metric,
    value,
    unit,
  });
};

/**
 * Helper: Create request-scoped logger
 * Automatically includes request ID in all logs from this logger
 */
logger.createRequestLogger = function (requestId) {
  return {
    debug: (msg, meta) => this.debug(msg, { ...meta, requestId }),
    info: (msg, meta) => this.info(msg, { ...meta, requestId }),
    warn: (msg, meta) => this.warn(msg, { ...meta, requestId }),
    error: (msg, meta) => this.error(msg, { ...meta, requestId }),
    http: (msg, meta) => this.http(msg, { ...meta, requestId }),
  };
};

module.exports = logger;
