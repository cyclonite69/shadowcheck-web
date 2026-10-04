import express from 'express';
import request from 'supertest';
import { mountCommonMiddleware } from '../../../server/src/middleware/commonMiddleware';

const logger = require('../../../server/src/logging/logger');

function makeApp(allowedOrigins: string[]) {
  const app = express();
  const routeHandler = jest.fn((_req, res) => res.status(200).json({ ok: true }));
  mountCommonMiddleware(app, { allowedOrigins });
  app.all('/api/probe', routeHandler);
  return { app, routeHandler };
}

describe('commonMiddleware Origin policy', () => {
  const listedOrigin = 'http://localhost:8080';
  const unlistedOrigin = 'https://attacker.test';
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  test('reflects an explicitly listed origin with credentials and Vary', async () => {
    const { app } = makeApp([listedOrigin]);

    const response = await request(app).get('/api/probe').set('Origin', listedOrigin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(listedOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers.vary).toContain('Origin');
  });

  test('unlisted-origin GET has no CORS permission and is not a server error', async () => {
    const { app } = makeApp([listedOrigin]);

    const response = await request(app).get('/api/probe').set('Origin', unlistedOrigin);

    expect(response.status).not.toBe(500);
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers.vary).toContain('Origin');
  });

  test.each([unlistedOrigin, 'null'])(
    'blocks unsafe Origin %s before the route',
    async (origin) => {
      const { app, routeHandler } = makeApp([listedOrigin]);

      const response = await request(app)
        .post('/api/probe')
        .set('Origin', origin)
        .send({ ok: true });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ ok: false, error: { code: 'ORIGIN_NOT_ALLOWED' } });
      expect(routeHandler).not.toHaveBeenCalled();
    }
  );

  test('blocks urlencoded cross-origin form POSTs before the route', async () => {
    const { app, routeHandler } = makeApp([listedOrigin]);

    const response = await request(app)
      .post('/api/probe')
      .set('Origin', unlistedOrigin)
      .type('form')
      .send({ action: 'change-setting' });

    expect(response.status).toBe(403);
    expect(routeHandler).not.toHaveBeenCalled();
  });

  test('allows listed and no-Origin unsafe requests', async () => {
    const listed = makeApp([listedOrigin]);
    const listedResponse = await request(listed.app)
      .post('/api/probe')
      .set('Origin', listedOrigin)
      .send({ ok: true });
    expect(listedResponse.status).toBe(200);
    expect(listed.routeHandler).toHaveBeenCalledTimes(1);

    const noOrigin = makeApp([listedOrigin]);
    const noOriginResponse = await request(noOrigin.app).post('/api/probe').send({ ok: true });
    expect(noOriginResponse.status).toBe(200);
    expect(noOriginResponse.headers['access-control-allow-credentials']).toBeUndefined();
    expect(noOrigin.routeHandler).toHaveBeenCalledTimes(1);
  });

  test('returns a headerless 204 for an unlisted-origin preflight', async () => {
    const { app } = makeApp([listedOrigin]);

    const response = await request(app)
      .options('/api/probe')
      .set('Origin', unlistedOrigin)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers.vary).toContain('Origin');
  });

  test('listed-origin preflight reflects credentials, default methods, and both Vary headers', async () => {
    const { app } = makeApp([listedOrigin]);

    const response = await request(app)
      .options('/api/probe')
      .set('Origin', listedOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(listedOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toBe('GET,HEAD,PUT,PATCH,POST,DELETE');
    expect(response.headers.vary).toContain('Origin');
    expect(response.headers.vary).toContain('Access-Control-Request-Headers');
  });

  test.each([
    'http://localhost:8080/',
    'http://LOCALHOST:8080',
    'https://localhost:8080',
    'http://localhost:8081',
  ])('rejects unsafe method from exact-match variant %s', async (origin) => {
    const { app, routeHandler } = makeApp([listedOrigin]);

    const response = await request(app).post('/api/probe').set('Origin', origin).send({ ok: true });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(routeHandler).not.toHaveBeenCalled();
  });

  test('fails closed when duplicate Origin headers reach the app', async () => {
    const app = express();
    const routeHandler = jest.fn((_req, res) => res.status(200).json({ ok: true }));
    let receivedOrigin: string | undefined;
    app.use((req, _res, next) => {
      receivedOrigin = req.headers.origin;
      next();
    });
    mountCommonMiddleware(app, { allowedOrigins: [listedOrigin] });
    app.all('/api/probe', routeHandler);

    const response = await request(app)
      .post('/api/probe')
      .set('Origin', [listedOrigin, unlistedOrigin] as unknown as string)
      .send({ ok: true });

    // Node combines duplicate Origin fields into a comma-separated value; it must be rejected.
    expect(receivedOrigin).toBe(`${listedOrigin}, ${unlistedOrigin}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(routeHandler).not.toHaveBeenCalled();
  });

  test('ignores production wildcard, logs one error, and allows no-Origin POST', async () => {
    process.env.NODE_ENV = 'production';
    const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const wildcard = makeApp(['*']);

    const rejected = await request(wildcard.app)
      .post('/api/probe')
      .set('Origin', unlistedOrigin)
      .send({ ok: true });
    const noOrigin = await request(wildcard.app).post('/api/probe').send({ ok: true });

    expect(rejected.status).toBe(403);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
    expect(wildcard.routeHandler).toHaveBeenCalledTimes(1);
    expect(noOrigin.status).toBe(200);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('wildcard is ignored in production');
    expect(error.mock.calls[0][0]).toMatch(/all browser-Origin unsafe requests will be rejected/i);
    error.mockRestore();
  });

  test('production wildcard retains explicit origins and blocks all others', async () => {
    process.env.NODE_ENV = 'production';
    const { app, routeHandler } = makeApp(['*', listedOrigin]);

    const allowed = await request(app)
      .post('/api/probe')
      .set('Origin', listedOrigin)
      .send({ ok: true });
    const rejected = await request(app)
      .post('/api/probe')
      .set('Origin', unlistedOrigin)
      .send({ ok: true });

    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(listedOrigin);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(rejected.status).toBe(403);
    expect(routeHandler).toHaveBeenCalledTimes(1);
  });

  test('wildcard mode disables credentials, permits unsafe Origins, and warns once', async () => {
    process.env.NODE_ENV = 'test';
    const warning = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { app, routeHandler } = makeApp(['*']);

    const response = await request(app)
      .post('/api/probe')
      .set('Origin', unlistedOrigin)
      .send({ ok: true });

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(unlistedOrigin);
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(routeHandler).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledTimes(1);
    warning.mockRestore();
  });
});
