import {
  assertCanRequest,
  getQuotaStatus,
  recordRequest,
  resetQuotaLedger,
} from '../../../server/src/services/wigleRequestLedger';

describe('wigleRequestLedger', () => {
  beforeEach(() => {
    resetQuotaLedger();
    delete process.env.WIGLE_SOFT_LIMIT_SEARCH;
  });

  it('should record and count requests', () => {
    recordRequest('search');
    recordRequest('search');
    const status = getQuotaStatus();
    expect(status.counts.search).toBe(2);
  });

  it('should respect soft limits from environment variables', () => {
    process.env.WIGLE_SOFT_LIMIT_SEARCH = '10';
    const status = getQuotaStatus();
    expect(status.softLimits.search).toBe(10);
    expect(status.hardLimits.search).toBe(20);
  });

  it('should use default limits if environment variable is invalid', () => {
    process.env.WIGLE_SOFT_LIMIT_SEARCH = 'invalid';
    const status = getQuotaStatus();
    expect(status.softLimits.search).toBe(50);
  });

  it('should throw error when soft limit is reached', () => {
    process.env.WIGLE_SOFT_LIMIT_SEARCH = '1';
    recordRequest('search');

    expect(() => assertCanRequest('search', 'test')).toThrow('WiGLE search soft limit reached');
    try {
      assertCanRequest('search', 'test');
    } catch (e: any) {
      expect(e.status).toBe(429);
      expect(e.code).toBe('WIGLE_SOFT_LIMIT');
    }
  });

  it('should throw hard limit error when hard limit is reached', () => {
    process.env.WIGLE_SOFT_LIMIT_SEARCH = '1'; // hard limit will be 2
    recordRequest('search');
    recordRequest('search');

    try {
      assertCanRequest('search', 'test');
    } catch (e: any) {
      expect(e.code).toBe('WIGLE_HARD_LIMIT');
    }
  });

  it('should prune old requests', () => {
    const now = Date.now();
    const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;

    // We can't easily inject time into the current implementation without mocking Date.now()
    // Let's mock Date.now()
    const realDateNow = Date.now;
    Date.now = jest.fn(() => twentyFiveHoursAgo);
    recordRequest('search');

    Date.now = jest.fn(() => now);
    const status = getQuotaStatus();
    expect(status.counts.search).toBe(0);

    Date.now = realDateNow;
  });
});
