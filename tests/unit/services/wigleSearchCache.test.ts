import {
  getCachedSearchResponse,
  resetSearchCache,
  setCachedSearchResponse,
} from '../../../server/src/services/wigleSearchCache';

describe('wigleSearchCache', () => {
  beforeEach(() => {
    resetSearchCache();
    jest.resetModules();
    delete process.env.WIGLE_SEARCH_CACHE_TTL_MS;
    delete process.env.WIGLE_SEARCH_NEGATIVE_CACHE_TTL_MS;
  });

  it('should return null for missing cache entry', () => {
    expect(getCachedSearchResponse('none')).toBeNull();
  });

  it('should return cached data for valid entry', () => {
    const data = { results: [1, 2, 3] };
    setCachedSearchResponse('hash1', data);
    expect(getCachedSearchResponse('hash1')).toEqual(data);
  });

  it('should return null and delete for expired entry', () => {
    const data = { results: [1, 2, 3] };
    const realDateNow = Date.now;
    Date.now = jest.fn(() => 1000);
    setCachedSearchResponse('hash1', data);

    // Fast forward time
    Date.now = jest.fn(() => 1000 + 60 * 60 * 1000 + 1);

    expect(getCachedSearchResponse('hash1')).toBeNull();
    // Verify it's gone
    Date.now = jest.fn(() => 1000);
    expect(getCachedSearchResponse('hash1')).toBeNull();

    Date.now = realDateNow;
  });

  it('should use positive TTL for results', () => {
    const realDateNow = Date.now;
    Date.now = jest.fn(() => 1000);
    const data = { results: [1] };
    setCachedSearchResponse('hash1', data);

    // Default TTL is 1 hour
    Date.now = jest.fn(() => 1000 + 60 * 60 * 1000 - 1);
    expect(getCachedSearchResponse('hash1')).toEqual(data);

    Date.now = realDateNow;
  });

  it('should use negative TTL for empty results', () => {
    const realDateNow = Date.now;
    Date.now = jest.fn(() => 1000);
    const data = { results: [] };
    setCachedSearchResponse('hash1', data);

    // Default negative TTL is 15 minutes
    Date.now = jest.fn(() => 1000 + 15 * 60 * 1000 - 1);
    expect(getCachedSearchResponse('hash1')).toEqual(data);

    Date.now = jest.fn(() => 1000 + 15 * 60 * 1000 + 1);
    expect(getCachedSearchResponse('hash1')).toBeNull();

    Date.now = realDateNow;
  });

  it('should respect environment variables for TTL', () => {
    process.env.WIGLE_SEARCH_CACHE_TTL_MS = '1000';
    process.env.WIGLE_SEARCH_NEGATIVE_CACHE_TTL_MS = '500';

    const realDateNow = Date.now;
    Date.now = jest.fn(() => 1000);

    setCachedSearchResponse('pos', { results: [1] });
    setCachedSearchResponse('neg', { results: [] });

    Date.now = jest.fn(() => 1000 + 600);
    expect(getCachedSearchResponse('neg')).toBeNull();
    expect(getCachedSearchResponse('pos')).not.toBeNull();

    Date.now = jest.fn(() => 1000 + 1100);
    expect(getCachedSearchResponse('pos')).toBeNull();

    Date.now = realDateNow;
  });

  it('should handle non-finite or non-positive environment variables', () => {
    process.env.WIGLE_SEARCH_CACHE_TTL_MS = 'invalid';
    process.env.WIGLE_SEARCH_NEGATIVE_CACHE_TTL_MS = '0';

    const realDateNow = Date.now;
    Date.now = jest.fn(() => 1000);

    setCachedSearchResponse('pos', { results: [1] });
    setCachedSearchResponse('neg', { results: [] });

    // Should fallback to 1 hour and 15 mins
    Date.now = jest.fn(() => 1000 + 15 * 60 * 1000 - 1);
    expect(getCachedSearchResponse('neg')).not.toBeNull();

    Date.now = jest.fn(() => 1000 + 60 * 60 * 1000 - 1);
    expect(getCachedSearchResponse('pos')).not.toBeNull();

    Date.now = realDateNow;
  });
});
