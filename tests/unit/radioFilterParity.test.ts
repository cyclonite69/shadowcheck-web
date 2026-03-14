export {};

import express from 'express';
import net from 'net';
import request from 'supertest';
import { UniversalFilterQueryBuilder } from '../../server/src/services/filterQueryBuilder';

const isSocketPermissionError = (error: unknown): boolean => {
  const message = String(error ?? '');
  return message.includes('EPERM') || message.includes('operation not permitted');
};

const canBindLoopback = async (): Promise<boolean> =>
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPERM' || err.code === 'EACCES') {
        resolve(false);
        return;
      }
      reject(err);
    });
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });

describe('Radio filter parity checks', () => {
  test('v1 /networks preserves mixed radioTypes (W + others) via parameterized ANY', async () => {
    if (!(await canBindLoopback())) {
      return;
    }

    const mockGetNetworkCount = jest.fn().mockResolvedValue(0);
    const mockGetFilteredNetworks = jest.fn().mockImplementation(async (opts) => {
      await mockGetNetworkCount(['ne.type = ANY($1::text[])'], [['W', 'L']], []);
      return { networks: [], total: 0 };
    });

    jest.resetModules();
    jest.doMock('../../server/src/middleware/cacheMiddleware', () => ({
      cacheMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    }));
    jest.doMock('../../server/src/config/container', () => ({
      networkService: {
        getHomeLocation: jest.fn().mockResolvedValue(null),
        getNetworkCount: mockGetNetworkCount,
        listNetworks: jest.fn().mockResolvedValue([]),
        getFilteredNetworks: mockGetFilteredNetworks,
        explainQuery: jest.fn(),
      },
      filterQueryBuilder: {
        NETWORK_CHANNEL_EXPR: jest.fn(() => 'ne.channel'),
      },
    }));

    const listRoutes = require('../../server/src/api/routes/v1/networks/list');
    const app = express();
    app.use('/api', listRoutes);

    const response = await request(app)
      .get('/api/networks')
      .query({ limit: 50, offset: 0, radioTypes: 'W,L' });

    expect(response.status).toBe(200);
    expect(mockGetFilteredNetworks).toHaveBeenCalledTimes(1);
    expect(mockGetNetworkCount).toHaveBeenCalledTimes(1);

    const [conditions, params] = mockGetNetworkCount.mock.calls[0];
    expect(conditions.some((c: string) => c.includes('= ANY('))).toBe(true);
    expect(params.some((p: unknown) => Array.isArray(p) && p.join(',') === 'W,L')).toBe(true);
  });

  test('v2 builder uses the same mixed radioTypes semantics', () => {
    const result = new UniversalFilterQueryBuilder(
      { radioTypes: ['W', 'L'] },
      { radioTypes: true }
    ).buildNetworkListQuery();

    expect(result.appliedFilters.some((f: { field: string }) => f.field === 'radioTypes')).toBe(
      true
    );
    expect(result.sql).toContain('= ANY(');
    expect(result.params.some((p: unknown) => Array.isArray(p) && p.join(',') === 'W,L')).toBe(
      true
    );
  });
});
