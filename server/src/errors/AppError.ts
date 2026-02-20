/**
 * Application Error Classes
 * Defines typed errors for different scenarios with appropriate HTTP status codes
 * and safe error messages that don't expose sensitive information
 */

interface ErrorJSON {
  ok: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    stack?: string;
    name?: string;
    details?: unknown;
    retryAfter?: number;
    database?: {
      query: string | null;
      detail: string | null;
      code: string;
    };
    originalError?: {
      message: string;
      code: string;
    };
  };
}

interface DatabaseErrorLike {
  query?: string;
  detail?: string;
  code?: string;
  message: string;
}

/**
 * Base Application Error
 * All custom errors should extend this class
 */
class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly timestamp: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
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
  toJSON(includeStack: boolean = false): ErrorJSON {
    const json: ErrorJSON = {
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
  getUserMessage(): string {
    return this.message;
  }
}

/**
 * Validation Error (400)
 * Thrown when input validation fails
 */
class ValidationError extends AppError {
  public readonly details: unknown;

  constructor(message: string, details: unknown = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }

  toJSON(includeStack: boolean = false): ErrorJSON {
    const json = super.toJSON(includeStack);
    if (this.details) {
      json.error.details = this.details;
    }
    return json;
  }

  getUserMessage(): string {
    return 'Request validation failed. Please check your input and try again.';
  }
}

/**
 * Not Found Error (404)
 * Thrown when requested resource doesn't exist
 */
class NotFoundError extends AppError {
  public readonly resource: string;

  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.resource = resource;
  }

  getUserMessage(): string {
    return `The requested ${this.resource.toLowerCase()} could not be found.`;
  }
}

/**
 * Unauthorized Error (401)
 * Thrown when authentication fails
 */
class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }

  getUserMessage(): string {
    return 'You must be authenticated to access this resource.';
  }
}

/**
 * Forbidden Error (403)
 * Thrown when user lacks permissions
 */
class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }

  getUserMessage(): string {
    return 'You do not have permission to access this resource.';
  }
}

/**
 * Conflict Error (409)
 * Thrown when request conflicts with current state
 */
class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }

  getUserMessage(): string {
    return 'The requested action conflicts with current data. Please try again.';
  }
}

/**
 * Rate Limit Error (429)
 * Thrown when rate limits are exceeded
 */
class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }

  toJSON(includeStack: boolean = false): ErrorJSON {
    const json = super.toJSON(includeStack);
    json.error.retryAfter = this.retryAfter;
    return json;
  }

  getUserMessage(): string {
    return `Too many requests. Please try again after ${this.retryAfter} seconds.`;
  }
}

/**
 * Database Error (500)
 * Thrown when database operations fail
 * Never exposes database details to users
 */
class DatabaseError extends AppError {
  public readonly originalError: DatabaseErrorLike;
  public readonly query: string | null;
  public readonly detail: string | null;

  constructor(originalError: DatabaseErrorLike, userMessage: string = 'Database operation failed') {
    super(userMessage, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
    this.query = originalError.query || null;
    this.detail = originalError.detail || null;
  }

  toJSON(includeStack: boolean = false): ErrorJSON {
    const json = super.toJSON(includeStack);
    // Only include database details in development
    if (process.env.NODE_ENV === 'development') {
      json.error.database = {
        query: this.query,
        detail: this.detail,
        code: this.originalError.code || '',
      };
    }
    return json;
  }

  getUserMessage(): string {
    return 'A database error occurred. Please try again later.';
  }
}

/**
 * External Service Error (502/503)
 * Thrown when external APIs or services fail
 */
class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly originalError: Error | null;

  constructor(service: string, statusCode: number = 502, originalError: Error | null = null) {
    super(`${service} service error`, statusCode, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
    this.originalError = originalError;
  }

  getUserMessage(): string {
    return `External service (${this.service}) is temporarily unavailable. Please try again later.`;
  }
}

/**
 * Operation Timeout Error (504)
 * Thrown when operations take too long
 */
class TimeoutError extends AppError {
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms`, 504, 'TIMEOUT');
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }

  getUserMessage(): string {
    return 'The operation took too long to complete. Please try again.';
  }
}

/**
 * Duplicate Entry Error (409)
 * Thrown when attempting to create duplicate resource
 */
class DuplicateError extends AppError {
  public readonly resource: string;
  public readonly identifier: string;

  constructor(resource: string, identifier: string) {
    super(`${resource} with identifier '${identifier}' already exists`, 409, 'DUPLICATE_ENTRY');
    this.resource = resource;
    this.identifier = identifier;
  }

  getUserMessage(): string {
    return `A ${this.resource.toLowerCase()} with this identifier already exists.`;
  }
}

/**
 * Invalid State Error (409)
 * Thrown when operation cannot be performed in current state
 */
class InvalidStateError extends AppError {
  public readonly currentState: unknown;

  constructor(message: string, currentState: unknown = null) {
    super(message, 409, 'INVALID_STATE');
    this.currentState = currentState;
  }

  getUserMessage(): string {
    return 'The requested operation cannot be performed in the current state.';
  }
}

/**
 * Business Logic Error (422)
 * Thrown when business logic constraints are violated
 */
class BusinessLogicError extends AppError {
  constructor(message: string) {
    super(message, 422, 'BUSINESS_LOGIC_ERROR');
  }

  getUserMessage(): string {
    return 'The requested operation violates business rules.';
  }
}

/**
 * Query Error (500)
 * Thrown when SQL query construction or execution fails
 */
class QueryError extends AppError {
  public readonly originalError: Error | null;

  constructor(message: string, originalError: Error | null = null) {
    super(message, 500, 'QUERY_ERROR');
    this.originalError = originalError;
  }

  toJSON(includeStack: boolean = false): ErrorJSON {
    const json = super.toJSON(includeStack);
    if (process.env.NODE_ENV === 'development' && this.originalError) {
      json.error.originalError = {
        message: this.originalError.message,
        code: (this.originalError as any).code || '',
      };
    }
    return json;
  }

  getUserMessage(): string {
    return 'A query execution error occurred. Please try again later.';
  }
}

/**
 * Helper function to check if error is AppError
 */
function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Helper function to convert unknown errors to AppError
 */
function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  // Handle specific error types
  const err = error as any; // Escape hatch for unknown error shapes
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return new ExternalServiceError('Database', 503, err);
  }

  if (err.code && err.code.startsWith('POSTGRES')) {
    return new DatabaseError(err);
  }

  if (err.message && err.message.includes('timeout')) {
    return new TimeoutError('Operation', 5000);
  }

  // Generic fallback
  const message = err.message || 'An unexpected error occurred';
  if (process.env.NODE_ENV !== 'development') {
    console.error('[Production Error]:', err);
  }

  return new AppError(
    process.env.NODE_ENV === 'development' ? message : 'An unexpected error occurred',
    500,
    'INTERNAL_ERROR'
  );
}

export {
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
