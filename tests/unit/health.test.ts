export {};

import v8 from 'v8';
const request = require('supertest');
const express = require('express');
import type { Express } from 'express';

const resolveDefault = (m: any) => m?.default || m;

// Mock database pool
const mockPoolQuery = jest.fn();
jest.mock('../../server/src/config/database', () => ({
  pool: {
    query: mockPoolQuery,
  },
  query: (...args: any[]) => mockPoolQuery(...args),
}));

// Mock secretsManager module with ES module interop
const mockSecretsManager = {
  has: jest.fn(),
  smReachable: true,
  smLastError: null as string | null,
};

jest.mock('../../server/src/services/secretsManager', () => {
  return {
    __esModule: true,
    default: mockSecretsManager,
    has: (key: string) => mockSecretsManager.has(key),
  };
});

describe('Health Check Endpoint', () => {
  let app: Express;
  let healthRoutes: any;
  let pool: any;
  let memoryUsageSpy: any;
  let heapStatsSpy: any;
  let previousNodeEnv: string | undefined;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Reset mocked secretsManager values
    mockSecretsManager.has.mockReset();
    mockSecretsManager.smReachable = true;
    mockSecretsManager.smLastError = null;

    heapStatsSpy = jest.spyOn(v8, 'getHeapStatistics').mockReturnValue({
      heap_size_limit: 4192 * 1024 * 1024,
    } as any);

    memoryUsageSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 140 * 1024 * 1024,
      heapTotal: 88 * 1024 * 1024,
      heapUsed: 80 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    } as any);

    pool = require('../../server/src/config/database').pool;
    healthRoutes = resolveDefault(require('../../server/src/api/routes/v1/health'));

    app = express();
    app.use(healthRoutes);
  });

  afterEach(() => {
    memoryUsageSpy?.mockRestore?.();
    heapStatsSpy?.mockRestore?.();
    process.env.NODE_ENV = previousNodeEnv;
  });

  test('should return healthy status when all checks pass', async () => {
    pool.query.mockResolvedValue({ rows: [{ db_name: 'shadowcheck_db' }] });
    mockSecretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body.database).toBe('shadowcheck_db');
    expect(response.body.checks.database.status).toBe('ok');
    expect(response.body.checks.database.database).toBe('shadowcheck_db');
    expect(response.body.checks.database.latency_ms).toEqual(expect.any(Number));
    expect(response.body.checks.secrets.status).toBe('ok');
    expect(response.body.checks.secrets.sm_reachable).toBe(true);
    expect(response.body.checks.memory.status).toBe('ok');
    expect(response.body.checks.memory.heap_used_mb).toBe(80);
    expect(response.body.checks.memory.heap_total_mb).toBe(88);
    expect(response.body.checks.memory.heap_max_mb).toBe(4192);
    expect(response.body.checks.memory.rss_mb).toBe(140);
    expect(response.body.checks.memory.percent).toBe(2);
  });

  test('should fallback database name to unknown if missing in rows', async () => {
    pool.query.mockResolvedValue({ rows: [{}] });
    mockSecretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('unknown');
    expect(response.body.checks.database.database).toBe('unknown');
  });

  test('should return unhealthy status when database fails', async () => {
    pool.query.mockRejectedValue(new Error('Connection refused'));
    mockSecretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.database.status).toBe('error');
    expect(response.body.checks.database.error).toBe('Connection refused');
  });

  test('should return unhealthy status when critical secrets are missing', async () => {
    pool.query.mockResolvedValue({ rows: [{ db_name: 'shadowcheck_db' }] });
    mockSecretsManager.has.mockReturnValue(false); // both db_password and mapbox_token missing

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.secrets.status).toBe('error');
    expect(response.body.checks.secrets.loaded_count).toBe(0);
  });

  test('should return degraded status when mapbox_token is missing but db_password is loaded', async () => {
    pool.query.mockResolvedValue({ rows: [{ db_name: 'shadowcheck_db' }] });
    mockSecretsManager.has.mockImplementation((key: string) => {
      return key === 'db_password';
    });

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.secrets.status).toBe('degraded');
    expect(response.body.checks.secrets.loaded_count).toBe(1);
  });

  test('should include sm_error in secretsCheck if secretsManager has smLastError', async () => {
    pool.query.mockResolvedValue({ rows: [{ db_name: 'shadowcheck_db' }] });
    mockSecretsManager.has.mockReturnValue(true);
    mockSecretsManager.smLastError = 'AWS Secrets Manager client failure';

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.body.checks.secrets.sm_error).toBe('AWS Secrets Manager client failure');
  });

  test('should return healthy status when in test environment without verifying mock secrets', async () => {
    process.env.NODE_ENV = 'test';
    pool.query.mockResolvedValue({ rows: [{ db_name: 'shadowcheck_db' }] });
    mockSecretsManager.has.mockReturnValue(false);

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.checks.secrets.status).toBe('ok');
    expect(response.body.checks.secrets.loaded_count).toBe(2); // critical (1) + important (1)
  });

  test('should return ok memory status at 80MB used / 88MB committed that would have false-flagged under heapTotal', async () => {
    // Under old logic (heapUsed / heapTotal), 80/88 was 91% -> false 'degraded'.
    // Under new logic (heapUsed / heap_size_limit), 80/4192 is 2% -> 'ok' and 'healthy'.
    memoryUsageSpy.mockReturnValue({
      rss: 140 * 1024 * 1024,
      heapTotal: 88 * 1024 * 1024,
      heapUsed: 80 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    } as any);

    pool.query.mockResolvedValue({ rows: [{ db_name: 'shadowcheck_db' }] });
    mockSecretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.checks.memory.status).toBe('ok');
    expect(response.body.checks.memory.percent).toBe(2);
    expect(response.body.checks.memory.heap_used_mb).toBe(80);
    expect(response.body.checks.memory.heap_total_mb).toBe(88);
    expect(response.body.checks.memory.heap_max_mb).toBe(4192);
    expect(response.body.checks.memory.rss_mb).toBe(140);
  });

  test('should return warning memory status when RSS is above 2800 MB threshold', async () => {
    memoryUsageSpy.mockReturnValue({
      rss: 2900 * 1024 * 1024,
      heapTotal: 88 * 1024 * 1024,
      heapUsed: 80 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    } as any);

    pool.query.mockResolvedValue({ rows: [{ db_name: 'shadowcheck_db' }] });
    mockSecretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.memory.status).toBe('warning');
    expect(response.body.checks.memory.rss_mb).toBe(2900);
  });

  test('should return warning memory status when heap percent is above 70% of heap limit', async () => {
    // 3000 MB / 4192 MB = 71.56% (~72%)
    memoryUsageSpy.mockReturnValue({
      rss: 3100 * 1024 * 1024,
      heapTotal: 3100 * 1024 * 1024,
      heapUsed: 3000 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    } as any);

    pool.query.mockResolvedValue({ rows: [{ db_name: 'shadowcheck_db' }] });
    mockSecretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.memory.status).toBe('warning');
    expect(response.body.checks.memory.percent).toBe(72);
  });

  test('should not degrade overall status when memory warning is triggered but env is test', async () => {
    process.env.NODE_ENV = 'test';
    memoryUsageSpy.mockReturnValue({
      rss: 2900 * 1024 * 1024,
      heapTotal: 88 * 1024 * 1024,
      heapUsed: 80 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    } as any);

    pool.query.mockResolvedValue({ rows: [{ db_name: 'shadowcheck_db' }] });
    mockSecretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.checks.memory.status).toBe('warning');
  });

  test('should keep overallStatus as unhealthy when memory warning is triggered but DB check failed', async () => {
    memoryUsageSpy.mockReturnValue({
      rss: 2900 * 1024 * 1024,
      heapTotal: 88 * 1024 * 1024,
      heapUsed: 80 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    } as any);

    pool.query.mockRejectedValue(new Error('Connection refused'));
    mockSecretsManager.has.mockReturnValue(true);

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.memory.status).toBe('warning');
  });

  test('should keep overallStatus as unhealthy when mapbox_token is missing but DB check failed', async () => {
    pool.query.mockRejectedValue(new Error('Connection refused'));
    mockSecretsManager.has.mockImplementation((key: string) => {
      return key === 'db_password';
    });

    const response = await request(app).get('/health');

    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.secrets.status).toBe('degraded');
  });
});
