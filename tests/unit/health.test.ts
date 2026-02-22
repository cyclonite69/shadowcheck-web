export {};

import { runIntegration } from '../helpers/integrationEnv';
const describeIfIntegration = runIntegration ? describe : describe.skip;

import request from 'supertest';
import express from 'express';

// Mock dependencies
jest.mock('../../server/src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../server/src/services/secretsManager', () => ({
  has: jest.fn(),
}));

describeIfIntegration('Health Check Endpoint', () => {
  if (!runIntegration) {
    test.skip('requires RUN_INTEGRATION_TESTS', () => {});
    return;
  }
  let app: express.Application;
  let healthRoutes: any;
  let pool: any;
  let secretsManager: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    pool = require('../../server/src/config/database').pool;
    secretsManager = require('../../server/src/services/secretsManager');
    healthRoutes = require('../../server/src/api/routes/v1/health');

    app = express();
    app.use(healthRoutes);
  });

  test('should return healthy status when all checks pass', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body.checks.database.status).toBe('ok');
    expect(response.body.checks.secrets.status).toBe('ok');
    expect(response.body.checks.memory.status).toBe('ok');
  });

  test('should return unhealthy status when database fails', async () => {
    pool.query.mockRejectedValue(new Error('Connection refused'));
    secretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.database.status).toBe('error');
  });

  test('should return unhealthy status when secrets missing', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(false);

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.secrets.status).toBe('error');
    expect(response.body.checks.secrets.loaded_count).toBe(0);
  });

  test('should include database latency', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(response.body.checks.database).toHaveProperty('latency_ms');
    expect(typeof response.body.checks.database.latency_ms).toBe('number');
  });

  test('should include memory usage', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(response.body.checks.memory).toHaveProperty('heap_used_mb');
    expect(response.body.checks.memory).toHaveProperty('heap_max_mb');
  });
});
