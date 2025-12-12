/**
 * Application Error Classes
 * Defines typed errors for different scenarios with appropriate HTTP status codes
 * and safe error messages that don't expose sensitive information
 */

/**
 * Base Application Error
 * All custom errors should extend this class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();

    // Capture stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to safe JSON response
   * Never includes stack trace or sensitive information in production
   */
  toJSON(includeStack = false) {
    const json = {
      ok: false,
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
      },
    };

    // Only include stack trace in development or if explicitly requested
    if (includeStack && process.env.NODE_ENV === 'development') {
      json.error.stack = this.stack;
      json.error.name = this.name;
    }

    return json;
  }

  /**
   * Get safe user-facing message
   * Different from internal message to avoid exposing system details
   */
  getUserMessage() {
    return this.message;
  }
}

/**
 * Validation Error (400)
 * Thrown when input validation fails
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }

  toJSON(includeStack = false) {
    const json = super.toJSON(includeStack);
    if (this.details) {
      json.error.details = this.details;
    }
    return json;
  }

  getUserMessage() {
    return 'Request validation failed. Please check your input and try again.';
  }
}

/**
 * Not Found Error (404)
 * Thrown when requested resource doesn't exist
 */
class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.resource = resource;
  }

  getUserMessage() {
    return `The requested ${this.resource.toLowerCase()} could not be found.`;
  }
}

/**
 * Unauthorized Error (401)
 * Thrown when authentication fails
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }

  getUserMessage() {
    return 'You must be authenticated to access this resource.';
  }
}

/**
 * Forbidden Error (403)
 * Thrown when user lacks permissions
 */
class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }

  getUserMessage() {
    return 'You do not have permission to access this resource.';
  }
}

/**
 * Conflict Error (409)
 * Thrown when request conflicts with current state
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }

  getUserMessage() {
    return 'The requested action conflicts with current data. Please try again.';
  }
}

/**
 * Rate Limit Error (429)
 * Thrown when rate limits are exceeded
 */
class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }

  toJSON(includeStack = false) {
    const json = super.toJSON(includeStack);
    json.error.retryAfter = this.retryAfter;
    return json;
  }

  getUserMessage() {
    return `Too many requests. Please try again after ${this.retryAfter} seconds.`;
  }
}

/**
 * Database Error (500)
 * Thrown when database operations fail
 * Never exposes database details to users
 */
class DatabaseError extends AppError {
  constructor(originalError, userMessage = 'Database operation failed') {
    super(userMessage, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
    this.query = originalError.query || null;
    this.detail = originalError.detail || null;
  }

  toJSON(includeStack = false) {
    const json = super.toJSON(includeStack);
    // Only include database details in development
    if (process.env.NODE_ENV === 'development') {
      json.error.database = {
        query: this.query,
        detail: this.detail,
        code: this.originalError.code,
      };
    }
    return json;
  }

  getUserMessage() {
    return 'A database error occurred. Please try again later.';
  }
}

/**
 * External Service Error (502/503)
 * Thrown when external APIs or services fail
 */
class ExternalServiceError extends AppError {
  constructor(service, statusCode = 502, originalError = null) {
    super(`${service} service error`, statusCode, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
    this.originalError = originalError;
  }

  getUserMessage() {
    return `External service (${this.service}) is temporarily unavailable. Please try again later.`;
  }
}

/**
 * Operation Timeout Error (504)
 * Thrown when operations take too long
 */
class TimeoutError extends AppError {
  constructor(operation, timeoutMs) {
    super(`${operation} timed out after ${timeoutMs}ms`, 504, 'TIMEOUT');
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }

  getUserMessage() {
    return 'The operation took too long to complete. Please try again.';
  }
}

/**
 * Duplicate Entry Error (409)
 * Thrown when attempting to create duplicate resource
 */
class DuplicateError extends AppError {
  constructor(resource, identifier) {
    super(`${resource} with identifier '${identifier}' already exists`, 409, 'DUPLICATE_ENTRY');
    this.resource = resource;
    this.identifier = identifier;
  }

  getUserMessage() {
    return `A ${this.resource.toLowerCase()} with this identifier already exists.`;
  }
}

/**
 * Invalid State Error (409)
 * Thrown when operation cannot be performed in current state
 */
class InvalidStateError extends AppError {
  constructor(message, currentState = null) {
    super(message, 409, 'INVALID_STATE');
    this.currentState = currentState;
  }

  getUserMessage() {
    return 'The requested operation cannot be performed in the current state.';
  }
}

/**
 * Business Logic Error (422)
 * Thrown when business logic constraints are violated
 */
class BusinessLogicError extends AppError {
  constructor(message) {
    super(message, 422, 'BUSINESS_LOGIC_ERROR');
  }

  getUserMessage() {
    return 'The requested operation violates business rules.';
  }
}

/**
 * Query Error (500)
 * Thrown when SQL query construction or execution fails
 */
class QueryError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, 'QUERY_ERROR');
    this.originalError = originalError;
  }

  toJSON(includeStack = false) {
    const json = super.toJSON(includeStack);
    if (process.env.NODE_ENV === 'development' && this.originalError) {
      json.error.originalError = {
        message: this.originalError.message,
        code: this.originalError.code,
      };
    }
    return json;
  }

  getUserMessage() {
    return 'A query execution error occurred. Please try again later.';
  }
}

/**
 * Helper function to check if error is AppError
 */
function isAppError(error) {
  return error instanceof AppError;
}

/**
 * Helper function to convert unknown errors to AppError
 */
function toAppError(error) {
  if (isAppError(error)) {
    return error;
  }

  // Handle specific error types
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new ExternalServiceError('Database', 503, error);
  }

  if (error.code && error.code.startsWith('POSTGRES')) {
    return new DatabaseError(error);
  }

  if (error.message && error.message.includes('timeout')) {
    return new TimeoutError('Operation', 5000);
  }

  // Generic fallback
  return new AppError(
    process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
    500,
    'INTERNAL_ERROR'
  );
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  TimeoutError,
  DuplicateError,
  InvalidStateError,
  BusinessLogicError,
  QueryError,
  isAppError,
  toAppError,
};
