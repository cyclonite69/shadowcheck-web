import {
  assertCanRequest,
  recordRequest,
  getQuotaStatus,
  resetQuotaLedger,
  recordConsecutive429,
  getCircuitBreakerStatus,
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

      expect(() => assertCanRequest('search', 'interactive')).not.toThrow();
    });

    it('throws 429 when soft limit is reached', () => {
      for (let i = 0; i < 50; i++) {
        recordRequest('search');
      }

      try {
        assertCanRequest('search', 'interactive');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.status).toBe(429);
        expect(error.message).toContain('soft limit reached');
      }
    });

    it('denies requests beyond soft limit', () => {
      for (let i = 0; i < 100; i++) {
        recordRequest('search');
      }

      try {
        assertCanRequest('search', 'interactive');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.status).toBe(429);
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

  describe('circuit breaker', () => {
    it('opens after 5 consecutive 429s', () => {
      for (let i = 0; i < 5; i++) recordConsecutive429();
      expect(getCircuitBreakerStatus().isOpen).toBe(true);
    });

    it('does not open before 5 consecutive 429s', () => {
      for (let i = 0; i < 4; i++) recordConsecutive429();
      expect(getCircuitBreakerStatus().isOpen).toBe(false);
    });

    it('blocks background requests when open', () => {
      for (let i = 0; i < 5; i++) recordConsecutive429();

      expect(() => assertCanRequest('search', 'background')).toThrow('circuit breaker');
      expect(() => assertCanRequest('detail', 'background')).toThrow('circuit breaker');
      expect(() => assertCanRequest('stats', 'background')).toThrow('circuit breaker');
    });

    it('does not block interactive requests when open', () => {
      for (let i = 0; i < 5; i++) recordConsecutive429();

      // interactive is never blocked by the circuit breaker
      expect(() => assertCanRequest('search', 'interactive')).not.toThrow();
    });

    it('resets cleanly via resetQuotaLedger', () => {
      for (let i = 0; i < 5; i++) recordConsecutive429();
      expect(getCircuitBreakerStatus().isOpen).toBe(true);

      resetQuotaLedger();
      expect(getCircuitBreakerStatus().isOpen).toBe(false);
    });

    it('consecutive429 counter resets after the breaker opens', () => {
      // After the 5th 429 opens the breaker, the counter resets to 0.
      // Another 4 429s should NOT re-open immediately.
      for (let i = 0; i < 5; i++) recordConsecutive429();

      // Advance past breaker window so we can observe the counter state
      jest.advanceTimersByTime(601_000); // 10 min + 1s
      expect(getCircuitBreakerStatus().isOpen).toBe(false);

      for (let i = 0; i < 4; i++) recordConsecutive429();
      expect(getCircuitBreakerStatus().isOpen).toBe(false);
    });
  });
});
