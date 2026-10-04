import { mountCommonMiddleware } from '../../../server/src/middleware/commonMiddleware';
import express from 'express';

jest.mock('compression', () => jest.fn(() => (req: any, res: any, next: any) => next()));
jest.mock('cors', () => jest.fn(() => (req: any, res: any, next: any) => next()));
jest.mock('express-rate-limit', () => jest.fn(() => (req: any, res: any, next: any) => next()));
jest.mock('../../../server/src/logging/logger', () => ({ warn: jest.fn(), error: jest.fn() }));

const corsMock = require('cors');
const rateLimitMock = require('express-rate-limit');

describe('commonMiddleware', () => {
  let app: express.Express;
  let previousNodeEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    previousNodeEnv = process.env.NODE_ENV;
    app = {
      use: jest.fn(),
    } as unknown as express.Express;
  });

  afterEach(() => {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('should mount all expected middlewares', () => {
    mountCommonMiddleware(app, { allowedOrigins: ['http://localhost:3000'] });
    expect(app.use).toHaveBeenCalled();
  });

  describe('CORS origin validation', () => {
    it('allows undefined origin (no origin)', () => {
      mountCommonMiddleware(app, { allowedOrigins: ['http://localhost:3000'] });
      const corsOptionsDelegate = corsMock.mock.calls[0][0];
      const callback = jest.fn();

      corsOptionsDelegate({ headers: {} }, callback);
      expect(callback).toHaveBeenCalledWith(null, { origin: false, credentials: false });
    });

    it('allows origin explicitly listed in allowedOrigins', () => {
      mountCommonMiddleware(app, {
        allowedOrigins: ['http://localhost:3000', 'https://example.com'],
      });
      const corsOptionsDelegate = corsMock.mock.calls[0][0];
      const callback = jest.fn();

      corsOptionsDelegate({ headers: { origin: 'https://example.com' } }, callback);
      expect(callback).toHaveBeenCalledWith(null, { origin: true, credentials: true });
    });

    it('allows any origin without credentials when wildcard * is inside allowedOrigins', () => {
      mountCommonMiddleware(app, { allowedOrigins: ['*'] });
      const corsOptionsDelegate = corsMock.mock.calls[0][0];
      const callback = jest.fn();

      corsOptionsDelegate({ headers: { origin: 'https://untrusted.com' } }, callback);
      expect(callback).toHaveBeenCalledWith(null, { origin: true, credentials: false });
    });

    it('reads production policy at mount time and ignores wildcard', () => {
      process.env.NODE_ENV = 'production';
      mountCommonMiddleware(app, { allowedOrigins: ['*'] });
      const corsOptionsDelegate = corsMock.mock.calls[0][0];
      const callback = jest.fn();

      corsOptionsDelegate({ headers: { origin: 'https://untrusted.com' } }, callback);
      expect(callback).toHaveBeenCalledWith(null, { origin: false, credentials: false });
      expect(require('../../../server/src/logging/logger').error).toHaveBeenCalledTimes(1);
    });

    it('denies an unauthorized origin without passing an error', () => {
      mountCommonMiddleware(app, { allowedOrigins: ['http://localhost:3000'] });
      const corsOptionsDelegate = corsMock.mock.calls[0][0];
      const callback = jest.fn();

      corsOptionsDelegate({ headers: { origin: 'https://untrusted.com' } }, callback);
      expect(callback).toHaveBeenCalledWith(null, { origin: false, credentials: false });
    });

    it('handles non-array allowedOrigins safely', () => {
      mountCommonMiddleware(app, { allowedOrigins: null as any });
      const corsOptionsDelegate = corsMock.mock.calls[0][0];
      const callback = jest.fn();

      corsOptionsDelegate({ headers: { origin: 'https://localhost:3000' } }, callback);
      expect(callback).toHaveBeenCalledWith(null, { origin: false, credentials: false });
    });
  });

  describe('Rate limit skip predicate', () => {
    it('skips local IP 127.0.0.1', () => {
      mountCommonMiddleware(app, { allowedOrigins: [] });
      const rateLimitOptions = rateLimitMock.mock.calls[0][0];
      const req = { ip: '127.0.0.1' };

      expect(rateLimitOptions.skip(req)).toBe(true);
    });

    it('skips local IPv6 ::1', () => {
      mountCommonMiddleware(app, { allowedOrigins: [] });
      const rateLimitOptions = rateLimitMock.mock.calls[0][0];
      const req = { ip: '::1' };

      expect(rateLimitOptions.skip(req)).toBe(true);
    });

    it('skips private/VPC IP prefix 172.31.', () => {
      mountCommonMiddleware(app, { allowedOrigins: [] });
      const rateLimitOptions = rateLimitMock.mock.calls[0][0];
      const req = { ip: '172.31.42.100' };

      expect(rateLimitOptions.skip(req)).toBe(true);
    });

    it('skips private/VPC IP prefix 10.', () => {
      mountCommonMiddleware(app, { allowedOrigins: [] });
      const rateLimitOptions = rateLimitMock.mock.calls[0][0];
      const req = { ip: '10.0.1.50' };

      expect(rateLimitOptions.skip(req)).toBe(true);
    });

    it('uses socket remoteAddress fallback when req.ip is absent', () => {
      mountCommonMiddleware(app, { allowedOrigins: [] });
      const rateLimitOptions = rateLimitMock.mock.calls[0][0];
      const req = {
        socket: { remoteAddress: '127.0.0.1' },
      };

      expect(rateLimitOptions.skip(req)).toBe(true);
    });

    it('does not skip public IPs', () => {
      mountCommonMiddleware(app, { allowedOrigins: [] });
      const rateLimitOptions = rateLimitMock.mock.calls[0][0];
      const req = { ip: '8.8.8.8' };

      expect(rateLimitOptions.skip(req)).toBe(false);
    });

    it('does not skip empty or unknown request contexts', () => {
      mountCommonMiddleware(app, { allowedOrigins: [] });
      const rateLimitOptions = rateLimitMock.mock.calls[0][0];

      expect(rateLimitOptions.skip({ socket: {} })).toBe(false);
    });
  });
});
