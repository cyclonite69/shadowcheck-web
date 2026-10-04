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

  test('wildcard mode disables credentials, permits unsafe Origins, and warns once', async () => {
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
