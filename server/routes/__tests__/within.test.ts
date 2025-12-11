import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const withinRouter = (await import('../within.ts')).default;

const app = express();
app.use('/api/v1/within', withinRouter);

async function request(path: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const { port } = server.address() as any;
      try {
        const res = await fetch(`http://127.0.0.1:${port}${path}`);
        resolve(res);
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

test('missing lat returns 400', async () => {
  const res = await request('/api/v1/within?lon=0&radius_m=100');
  assert.equal(res.status, 400);
});

test('missing lon returns 400', async () => {
  const res = await request('/api/v1/within?lat=0&radius_m=100');
  assert.equal(res.status, 400);
});

test('missing radius returns 400', async () => {
  const res = await request('/api/v1/within?lat=0&lon=0');
  assert.equal(res.status, 400);
});

test('latitude above 90 returns 400', async () => {
  const res = await request('/api/v1/within?lat=91&lon=0&radius_m=100');
  assert.equal(res.status, 400);
});

test('longitude above 180 returns 400', async () => {
  const res = await request('/api/v1/within?lat=0&lon=181&radius_m=100');
  assert.equal(res.status, 400);
});

test('radius above 50000 returns 400', async () => {
  const res = await request('/api/v1/within?lat=0&lon=0&radius_m=50001');
  assert.equal(res.status, 400);
});
