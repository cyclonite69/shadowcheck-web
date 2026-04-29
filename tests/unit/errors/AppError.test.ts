import {
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  isAppError,
  toAppError,
} from '../../../server/src/errors/AppError';

describe('AppError classes and utilities', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('AppError', () => {
    it('should create an error with default values', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.name).toBe('AppError');
      expect(error.timestamp).toBeDefined();
    });

    it('should format JSON without stack by default', () => {
      process.env.NODE_ENV = 'development';
      const error = new AppError('Test error');
      const json = error.toJSON();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe('Test error');
      expect(json.error.stack).toBeUndefined();
    });

    it('should format JSON with stack in development when requested', () => {
      process.env.NODE_ENV = 'development';
      const error = new AppError('Test error');
      const json = error.toJSON(true);
      expect(json.error.stack).toBeDefined();
      expect(json.error.name).toBe('AppError');
    });

    it('should not include stack in production even if requested', () => {
      process.env.NODE_ENV = 'production';
      const error = new AppError('Test error');
      const json = error.toJSON(true);
      expect(json.error.stack).toBeUndefined();
    });

    it('should return safe user message', () => {
      const error = new AppError('Internal system failure');
      expect(error.getUserMessage()).toBe('Internal system failure');
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with details', () => {
      const details = { field: 'email', message: 'Invalid' };
      const error = new ValidationError('Bad request', details);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toBe(details);

      const json = error.toJSON();
      expect(json.error.details).toBe(details);
    });

    it('should have a specific user message', () => {
      const error = new ValidationError('Bad request');
      expect(error.getUserMessage()).toBe(
        'Request validation failed. Please check your input and try again.'
      );
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error', () => {
      const error = new NotFoundError('User');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
      expect(error.getUserMessage()).toBe('The requested user could not be found.');
    });
  });

  describe('DatabaseError', () => {
    it('should create a database error', () => {
      const originalError = {
        message: 'db fail',
        query: 'SELECT *',
        detail: 'syntax',
        code: '42601',
      };
      const error = new DatabaseError(originalError);

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.query).toBe('SELECT *');
      expect(error.detail).toBe('syntax');
      expect(error.getUserMessage()).toBe('A database error occurred. Please try again later.');
    });

    it('should include db details in JSON only in development', () => {
      const originalError = {
        message: 'db fail',
        query: 'SELECT *',
        detail: 'syntax',
        code: '42601',
      };
      const error = new DatabaseError(originalError);

      process.env.NODE_ENV = 'development';
      let json = error.toJSON();
      expect(json.error.database).toBeDefined();
      expect(json.error.database?.query).toBe('SELECT *');

      process.env.NODE_ENV = 'production';
      json = error.toJSON();
      expect(json.error.database).toBeUndefined();
    });
  });

  describe('isAppError', () => {
    it('should identify AppError instances', () => {
      expect(isAppError(new AppError('test'))).toBe(true);
      expect(isAppError(new NotFoundError('test'))).toBe(true);
      expect(isAppError(new Error('test'))).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError({})).toBe(false);
    });
  });

  describe('toAppError', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return the same AppError if passed one', () => {
      const err = new NotFoundError('test');
      expect(toAppError(err)).toBe(err);
    });

    it('should convert ECONNREFUSED to AppError with 503', () => {
      const err = new Error('conn refused');
      (err as any).code = 'ECONNREFUSED';
      const result = toAppError(err);
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(503);
      expect(result.code).toBe('EXTERNAL_SERVICE_ERROR');
    });

    it('should convert ENOTFOUND to AppError with 503', () => {
      const err = new Error('not found');
      (err as any).code = 'ENOTFOUND';
      const result = toAppError(err);
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(503);
      expect(result.code).toBe('EXTERNAL_SERVICE_ERROR');
    });

    it('should convert POSTGRES error to DatabaseError', () => {
      const err = new Error('pg error');
      (err as any).code = 'POSTGRES_XYZ';
      const result = toAppError(err);
      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('should convert timeout message to AppError with 504', () => {
      const err = new Error('request timeout occurred');
      const result = toAppError(err);
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(504);
      expect(result.code).toBe('TIMEOUT');
    });

    it('should convert unpopulated db message to special AppError', () => {
      const err = new Error('db has not been populated yet');
      const result = toAppError(err);
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(503);
      expect(result.code).toBe('DB_INITIALIZING');
      expect(result.getUserMessage()).toContain('synchronizing');
    });

    it('should fallback to 500 INTERNAL_ERROR for generic errors in development', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('weird error');
      const result = toAppError(err);
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(500);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.message).toBe('weird error');
    });

    it('should fallback to 500 INTERNAL_ERROR generic message in production', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('weird error');
      const result = toAppError(err);
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(500);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.message).toBe('An unexpected error occurred');
      expect(console.error).toHaveBeenCalled();
    });
  });
});
