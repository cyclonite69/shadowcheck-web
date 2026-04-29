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
    database?: {
      query: string | null;
      detail: string | null;
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
    return new AppError('External service temporarily unavailable', 503, 'EXTERNAL_SERVICE_ERROR');
  }

  if (err.code && err.code.startsWith('POSTGRES')) {
    return new DatabaseError(err);
  }

  if (err.message && err.message.includes('timeout')) {
    return new AppError('Operation timed out', 504, 'TIMEOUT');
  }

  if (err.message && err.message.includes('has not been populated')) {
    const error = new AppError(
      'The database is currently synchronizing. Please wait a few moments and try again.',
      503,
      'DB_INITIALIZING'
    );
    // Override the user message
    error.getUserMessage = () =>
      'The database is currently synchronizing. Please wait a few moments and try again (or run the refresh script).';
    return error;
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

export { AppError, ValidationError, NotFoundError, DatabaseError, isAppError, toAppError };
