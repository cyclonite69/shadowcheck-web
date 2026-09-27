import request from 'supertest';
import express from 'express';

import { pool } from '../../../../server/src/config/database';

jest.mock('../../../../server/src/config/database', () => {
  const query = jest.fn();
  return {
    __esModule: true,
    pool: {
      query,
    },
    query,
  };
});

// Mock secretsManager
jest.mock('../../../../server/src/services/secretsManager', () => {
  const has = jest.fn().mockReturnValue(true);
  const m = {
    has,
    smReachable: true,
    smLastError: null,
  };
  return {
    __esModule: true,
    default: m,
    has: m.has,
    smReachable: m.smReachable,
    smLastError: m.smLastError,
  };
});

import healthRouter from '../../../../server/src/api/routes/v1/health';

beforeAll(() => {
  const mockMemory = {
    rss: 1024,
    heapTotal: 1000 * 1024 * 1024, // 1GB
    heapUsed: 1 * 1024 * 1024, // 1MB (~0.1% usage)
    external: 0,
    arrayBuffers: 0,
  };
  jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemory as any);
});

const app = express();
app.use('/api', healthRouter);

describe('GET /api/health', () => {
  it('should return 200 and healthy status', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{ db_name: 'shadowcheck_test' }] });
    const res = await request(app).get('/api/health');
    expect(pool.query).toHaveBeenCalledWith('SELECT current_database() AS db_name');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});
