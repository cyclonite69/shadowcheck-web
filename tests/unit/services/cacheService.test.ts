import { cacheService } from '../../../server/src/services/cacheService';
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

  test('get() should return null if not enabled', async () => {
    const result = await cacheService.get('test');
    expect(result).toBeNull();
  });

  test('get() should return parsed data if enabled', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.get.mockResolvedValue(JSON.stringify({ data: 'value' }));

    const result = await cacheService.get('test');
    expect(result).toEqual({ data: 'value' });
  });

  test('set() should call redis setEx', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    await cacheService.set('key', { val: 1 }, 100);
    expect(mockClient.setEx).toHaveBeenCalledWith('key', 100, JSON.stringify({ val: 1 }));
  });

  test('del() should call redis del', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    await cacheService.del('key');
    expect(mockClient.del).toHaveBeenCalledWith('key');
  });

  test('clear() should clear by pattern', async () => {
    (cacheService as any).enabled = true;
    (cacheService as any).client = mockClient;
    mockClient.keys.mockResolvedValue(['k1', 'k2']);
    await cacheService.clear('pattern*');
    expect(mockClient.del).toHaveBeenCalledWith(['k1', 'k2']);
  });
});
