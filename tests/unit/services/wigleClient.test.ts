import { fetchWigle, resetWigleClientState } from '../../../server/src/services/wigleClient';
import { logWigleAuditEvent } from '../../../server/src/services/wigleAuditLogger';
import { assertCanRequest, recordRequest } from '../../../server/src/services/wigleRequestLedger';

// Mock dependencies
jest.mock('../../../server/src/logging/logger');
jest.mock('../../../server/src/services/wigleAuditLogger');
jest.mock('../../../server/src/services/wigleRequestLedger');
jest.mock('../../../server/src/services/wigleRequestUtils', () => ({
  hashRecord: jest.fn(() => 'test-hash'),
}));

// Mock global fetch
global.fetch = jest.fn();

describe('wigleClient (Simplified)', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    resetWigleClientState();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('retry logic', () => {
    it('does not retry on 429 status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 429,
        ok: false,
        text: async () => 'Rate Limited',
      });

      const res = await fetchWigle({ kind: 'search', url: 'http://test', maxRetries: 3 });
      expect(res.status).toBe(429);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry on 403 status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 403,
        ok: false,
        text: async () => 'Forbidden',
      });

      const res = await fetchWigle({ kind: 'search', url: 'http://test', maxRetries: 3 });
      expect(res.status).toBe(403);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 5xx status up to maxRetries', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 500,
        ok: false,
        text: async () => 'Error',
      });

      const res = await fetchWigle({ kind: 'search', url: 'http://test', maxRetries: 2 });
      expect(res.status).toBe(500);
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('request tracking', () => {
    it('calls assertCanRequest and recordRequest', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        ok: true,
        text: async () => 'ok',
      });

      await fetchWigle({ kind: 'search', url: 'http://test', entrypoint: 'test-entry' });

      expect(assertCanRequest).toHaveBeenCalledWith('search', 'test-entry');
      expect(recordRequest).toHaveBeenCalledWith('search');
    });

    it('logs audit events', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        ok: true,
        text: async () => 'ok',
      });

      await fetchWigle({ kind: 'search', url: 'http://test', entrypoint: 'test-entry' });

      expect(logWigleAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'search',
          status: 200,
        })
      );
    });
  });
});
