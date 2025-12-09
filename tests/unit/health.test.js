const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/services/secretsManager', () => ({
  has: jest.fn(),
}));

jest.mock('../../src/services/keyringService', () => ({
  getCredential: jest.fn(),
}));

describe('Health Check Endpoint', () => {
  let app;
  let healthRoutes;
  let pool;
  let secretsManager;
  let keyringService;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    pool = require('../../src/config/database').pool;
    secretsManager = require('../../src/services/secretsManager');
    keyringService = require('../../src/services/keyringService');
    healthRoutes = require('../../src/api/routes/v1/health');

    app = express();
    app.use(healthRoutes);
  });

  test('should return healthy status when all checks pass', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(true);
    keyringService.getCredential.mockResolvedValue(null);

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
    keyringService.getCredential.mockResolvedValue(null);

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.database.status).toBe('error');
  });

  test('should return unhealthy status when secrets missing', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(false);
    keyringService.getCredential.mockResolvedValue(null);

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.secrets.status).toBe('error');
    expect(response.body.checks.secrets.loaded_count).toBe(0);
  });

  test('should return degraded status when keyring fails', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(true);
    keyringService.getCredential.mockRejectedValue(new Error('Keyring unavailable'));

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.keyring.status).toBe('degraded');
  });

  test('should include database latency', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(true);
    keyringService.getCredential.mockResolvedValue(null);

    const response = await request(app).get('/health');

    expect(response.body.checks.database).toHaveProperty('latency_ms');
    expect(typeof response.body.checks.database.latency_ms).toBe('number');
  });

  test('should include memory usage', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(true);
    keyringService.getCredential.mockResolvedValue(null);

    const response = await request(app).get('/health');

    expect(response.body.checks.memory).toHaveProperty('heap_used_mb');
    expect(response.body.checks.memory).toHaveProperty('heap_max_mb');
  });
});
