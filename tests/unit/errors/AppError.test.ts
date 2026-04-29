export {};

const {
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  isAppError,
  toAppError,
} = require('../../../server/src/errors/AppError');

describe('AppError', () => {
  test('sets message, statusCode, code, and name', () => {
    const err = new AppError('something failed', 503, 'SERVICE_DOWN');
    expect(err.message).toBe('something failed');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('SERVICE_DOWN');
    expect(err.name).toBe('AppError');
    expect(err.timestamp).toBeTruthy();
  });

  test('defaults to 500 / INTERNAL_ERROR', () => {
    const err = new AppError('oops');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  test('toJSON returns safe structure', () => {
    const err = new AppError('bad', 400, 'BAD');
    const json = err.toJSON();
    expect(json.ok).toBe(false);
    expect(json.error.message).toBe('bad');
    expect(json.error.statusCode).toBe(400);
    expect(json.error.stack).toBeUndefined();
  });

  test('toJSON includes stack in development', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = new AppError('dev error');
    const json = err.toJSON(true);
    expect(json.error.stack).toBeDefined();
    process.env.NODE_ENV = orig;
  });

  test('getUserMessage returns message', () => {
    expect(new AppError('msg').getUserMessage()).toBe('msg');
  });

  test('instanceof Error', () => {
    expect(new AppError('x')).toBeInstanceOf(Error);
  });
});

describe('ValidationError', () => {
  test('sets 400 and VALIDATION_ERROR code', () => {
    const err = new ValidationError('invalid input', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'email' });
  });

  test('toJSON includes details', () => {
    const err = new ValidationError('bad', { x: 1 });
    expect(err.toJSON().error.details).toEqual({ x: 1 });
  });

  test('getUserMessage returns generic message', () => {
    expect(new ValidationError('x').getUserMessage()).toContain('validation failed');
  });
});

describe('NotFoundError', () => {
  test('sets 404 and NOT_FOUND code', () => {
    const err = new NotFoundError('Network');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Network not found');
  });

  test('getUserMessage includes resource name', () => {
    expect(new NotFoundError('Network').getUserMessage()).toContain('network');
  });
});

describe('DatabaseError', () => {
  test('sets 500 and DATABASE_ERROR code', () => {
    const err = new DatabaseError({ message: 'conn failed', code: 'POSTGRES_ERR' });
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('DATABASE_ERROR');
  });

  test('toJSON includes database details in development', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = new DatabaseError({
      message: 'fail',
      query: 'SELECT 1',
      detail: 'detail',
      code: 'P0001',
    });
    const json = err.toJSON();
    expect(json.error.database).toMatchObject({
      query: 'SELECT 1',
      detail: 'detail',
      code: 'P0001',
    });
    process.env.NODE_ENV = orig;
  });

  test('toJSON omits database details in production', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const err = new DatabaseError({ message: 'fail' });
    expect(err.toJSON().error.database).toBeUndefined();
    process.env.NODE_ENV = orig;
  });
});

describe('isAppError', () => {
  test('returns true for AppError instances', () => {
    expect(isAppError(new AppError('x'))).toBe(true);
    expect(isAppError(new ValidationError('x'))).toBe(true);
  });

  test('returns false for plain errors', () => {
    expect(isAppError(new Error('x'))).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe('toAppError', () => {
  test('returns AppError unchanged', () => {
    const err = new AppError('x', 400, 'X');
    expect(toAppError(err)).toBe(err);
  });

  test('converts ECONNREFUSED to 503', () => {
    const result = toAppError({ code: 'ECONNREFUSED', message: 'refused' });
    expect(result.statusCode).toBe(503);
    expect(result.code).toBe('EXTERNAL_SERVICE_ERROR');
  });

  test('converts POSTGRES* code to DatabaseError', () => {
    const result = toAppError({ code: 'POSTGRES_ERR', message: 'db fail' });
    expect(result).toBeInstanceOf(DatabaseError);
  });

  test('converts timeout message to 504', () => {
    const result = toAppError({ message: 'operation timeout exceeded' });
    expect(result.statusCode).toBe(504);
    expect(result.code).toBe('TIMEOUT');
  });

  test('converts "has not been populated" to 503 DB_INITIALIZING', () => {
    const result = toAppError({ message: 'View has not been populated' });
    expect(result.statusCode).toBe(503);
    expect(result.code).toBe('DB_INITIALIZING');
  });

  test('wraps unknown error as generic AppError', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const result = toAppError({ message: 'something weird' });
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('something weird');
    process.env.NODE_ENV = orig;
  });

  test('hides message in production', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const result = toAppError({ message: 'internal detail' });
    expect(result.message).toBe('An unexpected error occurred');
    process.env.NODE_ENV = orig;
  });
});
