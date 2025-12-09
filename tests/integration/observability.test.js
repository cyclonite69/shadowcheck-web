/**
 * Observability Integration Tests
 * Tests health check endpoint and request ID middleware working together
 */

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

describe('Observability Integration', () => {
  let app;
  let pool;
  let secretsManager;
  let keyringService;

  beforeEach(() => {
    jest.clearAllMocks();

    pool = require('../../src/config/database').pool;
    secretsManager = require('../../src/services/secretsManager');
    keyringService = require('../../src/services/keyringService');

    // Setup mocks for healthy state
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    secretsManager.has.mockReturnValue(true);
    keyringService.getCredential.mockResolvedValue(null);

    // Create app with both features
    app = express();

    // Request ID middleware (must be first)
    const requestIdMiddleware = require('../../src/middleware/requestId');
    app.use(requestIdMiddleware);

    // Health check route
    const healthRoutes = require('../../src/api/routes/v1/health');
    app.use(healthRoutes);

    // Test route to verify request ID
    app.get('/test', (req, res) => {
      res.json({
        requestId: req.requestId,
        hasStartTime: Boolean(req.startTime),
      });
    });
  });

  describe('Health Check with Request ID', () => {
    test('health endpoint includes request ID in response headers', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.status).toBe('healthy');
    });

    test('health endpoint accepts custom request ID', async () => {
      const customId = 'test-request-123';

      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', customId);

      expect(response.headers['x-request-id']).toBe(customId);
    });

    test('health check measures latency correctly', async () => {
      const response = await request(app).get('/health');

      expect(response.body.checks.database).toHaveProperty('latency_ms');
      expect(response.body.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Request ID Consistency', () => {
    test('same request ID used throughout request lifecycle', async () => {
      const response = await request(app).get('/test');

      const headerRequestId = response.headers['x-request-id'];
      const bodyRequestId = response.body.requestId;

      expect(headerRequestId).toBeDefined();
      expect(bodyRequestId).toBeDefined();
      expect(headerRequestId).toBe(bodyRequestId);
    });

    test('different requests get different IDs', async () => {
      const response1 = await request(app).get('/test');
      const response2 = await request(app).get('/test');

      const id1 = response1.headers['x-request-id'];
      const id2 = response2.headers['x-request-id'];

      expect(id1).not.toBe(id2);
    });

    test('startTime is attached to request', async () => {
      const response = await request(app).get('/test');

      expect(response.body.hasStartTime).toBe(true);
    });
  });

  describe('Health Status Scenarios', () => {
    test('returns healthy when all systems operational', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.checks.database.status).toBe('ok');
      expect(response.body.checks.secrets.status).toBe('ok');
    });

    test('returns unhealthy when database fails', async () => {
      pool.query.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.database.status).toBe('error');
      expect(response.headers['x-request-id']).toBeDefined();
    });

    test('returns degraded when optional checks fail', async () => {
      keyringService.getCredential.mockRejectedValue(new Error('Keyring unavailable'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.checks.keyring.status).toBe('degraded');
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Uptime Tracking', () => {
    test('health check includes uptime', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    test('health check includes timestamp', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date');
    });
  });
});
