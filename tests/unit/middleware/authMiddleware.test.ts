export {};

import { Request, Response, NextFunction } from 'express';
import {
  requireAuth,
  requireAdmin,
  optionalAuth,
  extractToken,
} from '../../../server/src/middleware/authMiddleware';

const logger = require('../../../server/src/logging/logger') as any;

jest.mock('../../../server/src/logging/logger');

describe('Auth Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  const authService = {
    validateSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      app: { locals: { authService } } as any,
      cookies: {},
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('extractToken', () => {
    it('should extract token from cookies if available', () => {
      req.cookies = { session_token: 'cookie-token' };
      req.headers = { authorization: 'Bearer header-token' }; // Cookie takes precedence

      const token = extractToken(req as Request);
      expect(token).toBe('cookie-token');
    });

    it('should extract token from authorization header if no cookie', () => {
      req.headers = { authorization: 'Bearer header-token' };

      const token = extractToken(req as Request);
      expect(token).toBe('header-token');
    });

    it('should return null if neither cookie nor bearer header is present', () => {
      req.headers = { authorization: 'Basic some-token' };

      const token = extractToken(req as Request);
      expect(token).toBeNull();
    });

    it('should return null if cookies object is missing entirely', () => {
      delete req.cookies;

      const token = extractToken(req as Request);
      expect(token).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('should return 401 if no token is found', () => {
      requireAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'NO_TOKEN',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      req.cookies = { session_token: 'invalid-token' };
      authService.validateSession.mockResolvedValueOnce({ valid: false, error: 'Expired' });

      await requireAuth(req as Request, res as Response, next);

      expect(authService.validateSession).toHaveBeenCalledWith('invalid-token');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Expired',
        code: 'INVALID_SESSION',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should use default error message if token is invalid but no error provided', async () => {
      req.cookies = { session_token: 'invalid-token' };
      authService.validateSession.mockResolvedValueOnce({ valid: false });

      await requireAuth(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid session',
        code: 'INVALID_SESSION',
      });
    });

    it('should attach user and call next if token is valid', async () => {
      req.cookies = { session_token: 'valid-token' };
      const mockUser = { id: '1', username: 'test', role: 'user' };
      authService.validateSession.mockResolvedValueOnce({ valid: true, user: mockUser });

      await requireAuth(req as Request, res as Response, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should return 500 and log error if authService throws', async () => {
      req.cookies = { session_token: 'valid-token' };
      const error = new Error('Database down');
      authService.validateSession.mockRejectedValueOnce(error);

      await requireAuth(req as Request, res as Response, next);

      expect(logger.error).toHaveBeenCalledWith('Auth middleware error:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication error',
        code: 'AUTH_ERROR',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should return 401 if no token is found', async () => {
      // requireAdmin calls requireAuth internally
      await requireAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user is authenticated but not admin', async () => {
      req.cookies = { session_token: 'valid-token' };
      const mockUser = { id: '1', username: 'test', role: 'user' };
      authService.validateSession.mockResolvedValueOnce({ valid: true, user: mockUser });

      await requireAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next if user is authenticated and is admin', async () => {
      req.cookies = { session_token: 'valid-admin-token' };
      const mockUser = { id: '2', username: 'admin', role: 'admin' };
      authService.validateSession.mockResolvedValueOnce({ valid: true, user: mockUser });

      await requireAdmin(req as Request, res as Response, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('optionalAuth', () => {
    it('should call next immediately if no token is found', () => {
      optionalAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
    });

    it('should call next immediately if token is invalid without setting user', async () => {
      req.cookies = { session_token: 'invalid-token' };
      authService.validateSession.mockResolvedValueOnce({ valid: false });

      await optionalAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
    });

    it('should attach user and call next if token is valid', async () => {
      req.cookies = { session_token: 'valid-token' };
      const mockUser = { id: '1', username: 'test', role: 'user' };
      authService.validateSession.mockResolvedValueOnce({ valid: true, user: mockUser });

      await optionalAuth(req as Request, res as Response, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
