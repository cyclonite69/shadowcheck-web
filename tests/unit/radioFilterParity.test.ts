export {};

import express from 'express';
import net from 'net';
import request from 'supertest';
import { UniversalFilterQueryBuilder } from '../../server/src/services/filterQueryBuilder';

jest.mock('../../server/src/middleware/cacheMiddleware', () => ({
  cacheMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../server/src/config/container', () => ({
  networkService: {
    getHomeLocation: jest.fn().mockResolvedValue(null),
    getNetworkCount: jest.fn().mockResolvedValue(0),
    listNetworks: jest.fn().mockResolvedValue([]),
    explainQuery: jest.fn(),
  },
  filterQueryBuilder: {
    NETWORK_CHANNEL_EXPR: jest.fn(() => 'ne.channel'),
  },
}));

const { networkService } = require('../../server/src/config/container');
const listRoutes = require('../../server/src/api/routes/v1/networks/list');

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
  beforeEach(() => {
    jest.clearAllMocks();
    networkService.getHomeLocation.mockResolvedValue(null);
    networkService.getNetworkCount.mockResolvedValue(0);
    networkService.listNetworks.mockResolvedValue([]);
  });

  test('v1 /networks preserves mixed radioTypes (W + others) via parameterized ANY', async () => {
    if (!(await canBindLoopback())) {
      return;
    }

    const app = express();
    app.use('/api', listRoutes);

    let response;
    try {
      response = await request(app)
        .get('/api/networks')
        .query({ limit: 50, offset: 0, radioTypes: 'W,L' });
    } catch (error) {
      // Some restricted CI/sandbox environments disallow ephemeral listen sockets.
      // Skip this integration-style assertion there and keep v2 parity assertion active.
      if (isSocketPermissionError(error)) {
        return;
      }
      throw error;
    }

    expect(response.status).toBe(200);
    expect(networkService.getNetworkCount).toHaveBeenCalledTimes(1);

    const [conditions, params] = networkService.getNetworkCount.mock.calls[0];
    expect(Array.isArray(conditions)).toBe(true);
    expect(Array.isArray(params)).toBe(true);
    expect(conditions.some((c: string) => c.includes('= ANY('))).toBe(true);
    expect(conditions.some((c: string) => c.includes("= 'W'"))).toBe(false);
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
