/**
 * Common middleware setup.
 */
import type { Express } from 'express';

const compression = require('compression');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');

interface CommonMiddlewareOptions {
  allowedOrigins: string[];
}

/**
 * Mount common app middleware (compression, CORS, rate limiting, body parsing).
 */
function mountCommonMiddleware(app: Express, options: CommonMiddlewareOptions): void {
  const allowedOrigins = Array.isArray(options.allowedOrigins) ? options.allowedOrigins : [];

  // Compression
  app.use(compression());

  // CORS
  app.use(
    cors({
      origin: function (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
      ) {
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    })
  );

  // Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  });
  app.use('/api/', apiLimiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
}

export { mountCommonMiddleware, CommonMiddlewareOptions };
