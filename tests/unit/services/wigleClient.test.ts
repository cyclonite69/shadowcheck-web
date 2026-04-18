import { fetchWigle } from '../../../server/src/services/wigleClient';
import * as auditLogger from '../../../server/src/services/wigleAuditLogger';
import * as requestLedger from '../../../server/src/services/wigleRequestLedger';

jest.mock('../../../server/src/services/wigleAuditLogger');
jest.mock('../../../server/src/services/wigleRequestLedger');
jest.mock('../../../server/src/logging/logger');

// Mock global fetch
global.fetch = jest.fn();

describe('wigleClient', () => {
  const mockOptions: any = {
    kind: 'search',
    url: 'https://api.wigle.net/test',
    entrypoint: 'test-unit',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue('{"success": true}'),
    });
  });

  it('should fetch successfully', async () => {
    const response = await fetchWigle(mockOptions);
    expect(response.status).toBe(200);
    expect(requestLedger.recordRequest).toHaveBeenCalledWith('search');
    expect(auditLogger.logWigleAuditEvent).toHaveBeenCalled();
  });

  it('should retry on 500 errors', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        status: 500,
        text: jest.fn().mockResolvedValue('Server Error'),
      })
      .mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValue('Success'),
      });

    const response = await fetchWigle({ ...mockOptions, maxRetries: 1 });
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should not retry on 403 or 429 errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 403,
      text: jest.fn().mockResolvedValue('Forbidden'),
    });

    const response = await fetchWigle({ ...mockOptions, maxRetries: 1 });
    expect(response.status).toBe(403);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch timeouts', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), 100))
    );

    await expect(fetchWigle({ ...mockOptions, timeoutMs: 10, maxRetries: 0 })).rejects.toThrow(
      'AbortError'
    );
  });

  it('should handle network failures and retry', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValue('Success'),
      });

    const response = await fetchWigle({ ...mockOptions, maxRetries: 1 });
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Persistent failure'));

    await expect(fetchWigle({ ...mockOptions, maxRetries: 1 })).rejects.toThrow(
      'Persistent failure'
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle safeReadBody failure', async () => {
    // Return a 500 response where text() itself fails (e.g. body stream error)
    // Use mockImplementation to ensure every retry gets a fresh failing body
    (global.fetch as jest.Mock).mockImplementation(() => {
      const resp = {
        status: 500,
        text: jest.fn().mockReturnValue(Promise.reject(new Error('Read error'))),
      };
      return Promise.resolve(resp);
    });

    // It should retry and eventually throw after max retries
    await expect(fetchWigle({ ...mockOptions, maxRetries: 1 })).rejects.toThrow(
      'WiGLE request failed'
    );
  });
});
