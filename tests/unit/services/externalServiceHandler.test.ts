import { withRetry, delay } from '../../../server/src/services/externalServiceHandler';

describe('externalServiceHandler', () => {
  it('should return result on success', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(mockFn);
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(mockFn, { maxRetries: 1, retryDelayMs: 1 });
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('always fail'));
    await expect(withRetry(mockFn, { maxRetries: 1, retryDelayMs: 1 })).rejects.toThrow(
      'always fail'
    );
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should timeout', async () => {
    const mockFn = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('slow'), 50)));
    await expect(withRetry(mockFn, { timeoutMs: 10, retryDelayMs: 1 })).rejects.toThrow(
      'timed out'
    );
  });
});
