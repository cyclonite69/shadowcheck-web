import {
  assertCanRequest,
  recordRequest,
  getQuotaStatus,
  resetQuotaLedger,
} from '../../../server/src/services/wigleRequestLedger';
import { adminQuery } from '../../../server/src/services/adminDbService';
import logger from '../../../server/src/logging/logger';

// Mock dependencies
jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/logging/logger');

describe('wigleRequestLedger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetQuotaLedger();
    jest.useFakeTimers();
    // Default mock for adminQuery
    (adminQuery as jest.Mock).mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('limit enforcement', () => {
    it('allows requests within soft limit', () => {
      // search soft limit is 50
      for (let i = 0; i < 49; i++) {
        recordRequest('search');
      }

      expect(() => assertCanRequest('search', 'test')).not.toThrow();
    });

    it('throws 429 when soft limit is reached', () => {
      for (let i = 0; i < 50; i++) {
        recordRequest('search');
      }

      try {
        assertCanRequest('search', 'test');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.status).toBe(429);
        expect(error.code).toBe('WIGLE_SOFT_LIMIT');
        expect(error.message).toContain('soft limit reached');
      }
    });

    it('identifies hard limit when count >= 2 * soft limit', () => {
      // We need to bypass assertCanRequest to fill up to hard limit
      // Or just recordRequest multiple times
      for (let i = 0; i < 100; i++) {
        recordRequest('search');
      }

      try {
        assertCanRequest('search', 'test');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe('WIGLE_HARD_LIMIT');
      }
    });
  });

  describe('rolling window pruning', () => {
    it('prunes old requests outside the 24h window', () => {
      const now = Date.now();

      recordRequest('search'); // at T=0

      jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000); // T = 24h + 1s

      // Should be back to 0
      expect(getQuotaStatus().counts.search).toBe(0);
    });

    it('retains requests within the 24h window', () => {
      recordRequest('search'); // at T=0

      jest.advanceTimersByTime(12 * 60 * 60 * 1000); // T = 12h

      expect(getQuotaStatus().counts.search).toBe(1);
    });
  });

  describe('DB integration', () => {
    it('attempts to persist events to the DB', () => {
      recordRequest('stats');
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.wigle_ledger_events'),
        ['stats']
      );
    });

    it('handles DB failures gracefully without affecting in-memory state', () => {
      (adminQuery as jest.Mock).mockRejectedValueOnce(new Error('DB Down'));

      recordRequest('search');

      expect(getQuotaStatus().counts.search).toBe(1);
    });
  });

  describe('independent kind tracking', () => {
    it('tracks different kinds separately', () => {
      recordRequest('search');
      recordRequest('search');
      recordRequest('detail');

      const status = getQuotaStatus();
      expect(status.counts.search).toBe(2);
      expect(status.counts.detail).toBe(1);
      expect(status.counts.stats).toBe(0);
    });
  });
});
