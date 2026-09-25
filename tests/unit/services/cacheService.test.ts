const { cacheService } = require('../../../server/src/services/cacheService');
import { createClient } from 'redis';

jest.mock('redis');

describe('cacheService', () => {
  const mockClient = {
    connect: jest.fn(),
    on: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockClient);
    (cacheService as any).client = null;
    (cacheService as any).enabled = false;
  });

  test('connect() should initialize Redis client', async () => {
    await cacheService.connect();
    expect(createClient).toHaveBeenCalled();
    expect(mockClient.connect).toHaveBeenCalled();
    expect(cacheService.isEnabled()).toBe(true);
  });

  test('connect() disables cache when Redis throws', async () => {
    mockClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));
    await cacheService.connect();
    expect(cacheService.isEnabled()).toBe(false);
    expect((cacheService as any).client).toBeNull();
  });

  test('get() should return null if not enabled', async () => {
    const result = await cacheService.get('test');
    expect(result).toBeNull();
  });

  test('get() returns null when key not found in Redis', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.get.mockResolvedValue(null);
    const result = await cacheService.get('missing');
    expect(result).toBeNull();
  });

  test('get() should return parsed data if enabled', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.get.mockResolvedValue(JSON.stringify({ data: 'value' }));

    const result = await cacheService.get('test');
    expect(result).toEqual({ data: 'value' });
  });

  test('get() returns null on Redis error', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.get.mockRejectedValue(new Error('Redis error'));
    const result = await cacheService.get('key');
    expect(result).toBeNull();
  });

  test('set() should call redis setEx', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    await cacheService.set('key', { val: 1 }, 100);
    expect(mockClient.setEx).toHaveBeenCalledWith('key', 100, JSON.stringify({ val: 1 }));
  });

  test('set() is a no-op when not enabled', async () => {
    await cacheService.set('key', { val: 1 });
    expect(mockClient.setEx).not.toHaveBeenCalled();
  });

  test('set() silently ignores Redis errors', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.setEx.mockRejectedValue(new Error('Redis error'));
    await expect(cacheService.set('key', 'val')).resolves.toBeUndefined();
  });

  test('del() should call redis del', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    await cacheService.del('key');
    expect(mockClient.del).toHaveBeenCalledWith('key');
  });

  test('del() is a no-op when not enabled', async () => {
    await cacheService.del('key');
    expect(mockClient.del).not.toHaveBeenCalled();
  });

  test('del() silently ignores Redis errors', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.del.mockRejectedValue(new Error('Redis error'));
    await expect(cacheService.del('key')).resolves.toBeUndefined();
  });

  test('clear() should clear by pattern', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.keys.mockResolvedValue(['k1', 'k2']);
    await cacheService.clear('pattern*');
    expect(mockClient.del).toHaveBeenCalledWith(['k1', 'k2']);
  });

  test('clear() skips del when no keys match pattern', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.keys.mockResolvedValue([]);
    await cacheService.clear('pattern*');
    expect(mockClient.del).not.toHaveBeenCalled();
  });

  test('clear() is a no-op when not enabled', async () => {
    await cacheService.clear('*');
    expect(mockClient.keys).not.toHaveBeenCalled();
  });

  test('clear() silently ignores Redis errors', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.keys.mockRejectedValue(new Error('Redis error'));
    await expect(cacheService.clear('*')).resolves.toBeUndefined();
  });
});
