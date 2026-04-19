/**
 * Authentication middleware.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';

const logger = require('../logging/logger');

// Extend Express Request to include user, request ID, and scoped logger
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
      };
      id?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger?: any;
    }
  }
}

type SessionValidationResult = {
  valid: boolean;
  error?: string;
  user?: Request['user'];
};

type AuthService = {
  validateSession: (token: string) => Promise<SessionValidationResult>;
};

function getAuthService(req: Request): AuthService | null {
  const authService = req.app?.locals?.authService as AuthService | undefined;
  if (authService) {
    return authService;
  }

  logger.error('Auth middleware error: authService not configured on app.locals');
  return null;
}

/**
 * Extract session token from request
 */
function extractToken(req: Request): string | null {
  // Try cookie first (most secure)
  if (req.cookies && req.cookies.session_token) {
    return req.cookies.session_token;
  }

  // Fallback to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Middleware to require authentication
 */
const requireAuth: RequestHandler = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'NO_TOKEN',
    });
    return;
  }

  const authService = getAuthService(req);
  if (!authService) {
    res.status(500).json({
      error: 'Authentication service unavailable',
      code: 'AUTH_UNAVAILABLE',
    });
    return;
  }

  return authService
    .validateSession(token)
    .then((result: SessionValidationResult) => {
      if (!result.valid) {
        res.status(401).json({
          error: result.error || 'Invalid session',
          code: 'INVALID_SESSION',
        });
        return;
      }

      // Add user to request object
      req.user = result.user;
      next();
    })
    .catch((error: Error) => {
      logger.error('Auth middleware error:', error);
      res.status(500).json({
        error: 'Authentication error',
        code: 'AUTH_ERROR',
      });
    });
};

/**
 * Middleware to require admin role
 */
const requireAdmin: RequestHandler = (req, res, next) => {
  // First check if user is authenticated
  return requireAuth(req, res, ((err?: unknown) => {
    if (err) {
      return;
    }

    // Check if user has admin role
    if (req.user?.role !== 'admin') {
      res.status(403).json({
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    next();
  }) as NextFunction);
};

/**
 * Optional auth middleware - adds user to request if token is valid
 */
const optionalAuth: RequestHandler = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  const authService = getAuthService(req);
  if (!authService) {
    next();
    return;
  }

  authService
    .validateSession(token)
    .then((result: SessionValidationResult) => {
      if (result.valid) {
        req.user = result.user;
      }
      next();
    })
    .catch((error: Error) => {
      logger.error('Optional auth middleware error:', error);
      next(); // Continue without user
    });
};

export { requireAuth, requireAdmin, optionalAuth, extractToken };
