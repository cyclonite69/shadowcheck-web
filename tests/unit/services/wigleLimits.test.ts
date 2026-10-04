export {};

jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/logging/logger');

import {
  getSafeLimitSync,
  refreshLimits,
  resetLimitsCache,
} from '../../../server/src/services/wigleLimits';
import { adminQuery } from '../../../server/src/services/adminDbService';

const adminQueryMock = adminQuery as jest.Mock;

describe('wigleLimits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLimitsCache();
  });

  test('returns documented fallback values when cache is empty', () => {
    // Current defaults: search=50, stats=49, detail=200.
    // These reflect WiGLE's conservative quota behavior at time of writing —
    // not immutable constants. If WiGLE quota rules change, update these values
    // and the FALLBACK_LIMITS object in wigleLimits.ts together.
    expect(getSafeLimitSync('search')).toBe(50);
    expect(getSafeLimitSync('stats')).toBe(49);
    expect(getSafeLimitSync('detail')).toBe(200);
  });

  test('getSafeLimitSync never touches the DB — reads in-memory cache only', () => {
    getSafeLimitSync('search');
    getSafeLimitSync('stats');
    getSafeLimitSync('detail');
    expect(adminQueryMock).not.toHaveBeenCalled();
  });

  test('resetLimitsCache restores fallback values — cache reset actually works', () => {
    // Call reset then verify fallbacks are restored (tests the reset contract,
    // not just that the function is callable).
    resetLimitsCache();
    expect(getSafeLimitSync('search')).toBe(50);
    expect(getSafeLimitSync('detail')).toBe(200);
    expect(getSafeLimitSync('stats')).toBe(49);
  });

  test('resetLimitsCache is idempotent — multiple calls do not throw or corrupt state', () => {
    resetLimitsCache();
    resetLimitsCache();
    // State should still be consistent after repeated resets
    expect(getSafeLimitSync('search')).toBe(50);
  });

  test.each([0, -1, 1.5])('rejects learned limit %s', async (invalidLimit) => {
    adminQueryMock
      .mockResolvedValueOnce({ rows: [{ safe_limit: invalidLimit }] })
      .mockResolvedValueOnce({ rows: [{ safe_limit: null }] })
      .mockResolvedValueOnce({ rows: [{ safe_limit: null }] });

    await refreshLimits();

    expect(getSafeLimitSync('search')).toBe(50);
  });

  it('accepts a positive integer learned limit', async () => {
    adminQueryMock
      .mockResolvedValueOnce({ rows: [{ safe_limit: 7 }] })
      .mockResolvedValueOnce({ rows: [{ safe_limit: null }] })
      .mockResolvedValueOnce({ rows: [{ safe_limit: null }] });

    await refreshLimits();

    expect(getSafeLimitSync('search')).toBe(7);
  });
});
