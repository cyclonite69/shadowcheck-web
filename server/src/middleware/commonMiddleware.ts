/**
 * Common middleware setup.
 */
import type { Express } from 'express';
import { isOriginAllowed, isUnsafeMethod, normalizeOrigins } from './originPolicy';

const compression = require('compression');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../logging/logger');

let wildcardWarningLogged = false;

interface CommonMiddlewareOptions {
  allowedOrigins: string[];
}

/**
 * Mount common app middleware (compression, CORS, rate limiting, body parsing).
 */
function mountCommonMiddleware(app: Express, options: CommonMiddlewareOptions): void {
  const allowedOrigins = normalizeOrigins(
    Array.isArray(options.allowedOrigins) ? options.allowedOrigins : []
  );
  const wildcardMode = allowedOrigins.includes('*');

  if (wildcardMode && !wildcardWarningLogged) {
    logger.warn('[CORS] CORS_ORIGINS includes *; wildcard mode disables Origin enforcement.');
    wildcardWarningLogged = true;
  }

  // Compression
  app.use(compression());

  // CORS
  app.use(
    cors((req: any, callback: (err: Error | null, options?: Record<string, unknown>) => void) => {
      const origin = req.headers.origin as string | undefined;
      if (origin === undefined) {
        return callback(null, { origin: false, credentials: false });
      }
      if (wildcardMode) {
        return callback(null, { origin: true, credentials: false });
      }
      if (isOriginAllowed(origin, allowedOrigins)) {
        return callback(null, { origin: true, credentials: true });
      }
      return callback(null, { origin: false, credentials: false });
    })
  );

  // Keep cross-origin cache variants distinct and enforce CSRF protection for unsafe methods.
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin as string | undefined;
    if (origin !== undefined) {
      res.vary('Origin');
    }

    if (origin !== undefined && !wildcardMode && !isOriginAllowed(origin, allowedOrigins)) {
      if (req.method.toUpperCase() === 'OPTIONS') {
        return res.status(204).end();
      }

      if (isUnsafeMethod(req.method)) {
        logger.warn('[CORS] Rejected unsafe request from disallowed Origin', {
          origin,
          path: req.path,
        });
        return res.status(403).json({ ok: false, error: { code: 'ORIGIN_NOT_ALLOWED' } });
      }
    }

    return next();
  });

  // Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50000,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    skip: (req: any) => {
      const ip = req.ip || req.socket.remoteAddress || '';
      return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('172.31.') || ip.startsWith('10.');
    },
  });
  app.use('/api/', apiLimiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
}

export { mountCommonMiddleware, CommonMiddlewareOptions };
