import { Request, Response, NextFunction } from 'express';
import {
  createErrorHandler,
  logError,
  asyncHandler,
  notFoundHandler,
  ErrorResponseBuilder,
  handleValidationError,
  handleDatabaseError,
  handleRateLimitError,
} from '../../../server/src/errors/errorHandler';
import { AppError, ValidationError, DatabaseError } from '../../../server/src/errors/AppError';

describe('errorHandler middleware and utilities', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('createErrorHandler', () => {
    it('should handle AppError and log according to status code', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const handler = createErrorHandler(mockLogger as any);
      const req = {
        path: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        user: { id: 'u1' },
        headers: { 'x-request-id': 'req-id' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const next = jest.fn() as NextFunction;

      // 500 error
      const error500 = new AppError('Server boom');
      handler(error500, req, res, next);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();

      // 400 error
      mockLogger.error.mockClear();
      const error400 = new AppError('Bad req', 400);
      handler(error400, req, res, next);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);

      // 300 error (unlikely, but tests debug)
      mockLogger.warn.mockClear();
      const error300 = new AppError('Redirect', 300);
      handler(error300, req, res, next);
      expect(mockLogger.debug).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(300);
    });

    it('should convert unknown error and log', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const handler = createErrorHandler(mockLogger);
      const req = { headers: {} } as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      handler(new Error('Unknown native error'), req, res, next);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('logError', () => {
    it('should log properly with fallback values', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const req = {
        headers: { 'x-request-id': 'req-123' },
      } as unknown as Request;
      const error = new AppError('test');

      logError(error as any, req, mockLogger);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous',
          requestId: 'req-123',
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('should catch rejected promises and pass to next', async () => {
      const error = new Error('Async boom');
      const handler = jest.fn().mockRejectedValue(error);
      const wrapped = asyncHandler(handler);

      const req = { headers: {} } as Request;
      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      await wrapped(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should pass if no error', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      const wrapped = asyncHandler(handler);

      const req = { headers: {} } as Request;
      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      await wrapped(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('notFoundHandler', () => {
    it('should create NotFoundError and pass to next', () => {
      const req = { method: 'POST', path: '/unknown' } as Request;
      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      notFoundHandler(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Route POST /unknown not found',
        })
      );
    });
  });

  describe('ErrorResponseBuilder', () => {
    it('should build response with custom message and data', () => {
      const error = new AppError('Original msg');
      const builder = new ErrorResponseBuilder(error);

      const result = builder.withMessage('Custom msg').withData({ foo: 'bar' }).build();

      expect(result.error.message).toBe('Custom msg');
      expect(result.error.data).toEqual({ foo: 'bar' });
    });
  });

  describe('handleValidationError', () => {
    it('should format validation error', () => {
      const error = new ValidationError('Bad input', ['field1']);
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      handleValidationError(error as any, {} as Request, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({
            details: ['field1'],
          }),
        })
      );
    });
  });

  describe('handleDatabaseError', () => {
    it('should format database error in development', () => {
      process.env.NODE_ENV = 'development';
      const originalError = { code: '123', message: 'db msg' };
      const error = new DatabaseError(originalError);

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      handleDatabaseError(error as any, {} as Request, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            database: { code: '123', message: 'db msg' },
          }),
        })
      );
    });

    it('should format database error in production', () => {
      process.env.NODE_ENV = 'production';
      const originalError = { code: '123', message: 'db msg' };
      const error = new DatabaseError(originalError);

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      handleDatabaseError(error as any, {} as Request, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.not.objectContaining({
            database: expect.anything(),
          }),
        })
      );
    });
  });

  describe('handleRateLimitError', () => {
    it('should format rate limit error and set header', () => {
      const error = Object.assign(new AppError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED'), {
        retryAfter: 30,
      });
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      handleRateLimitError(error as any, {} as Request, res);
      expect(res.set).toHaveBeenCalledWith('Retry-After', '30');
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            retryAfter: 30,
          }),
        })
      );
    });
  });
});
