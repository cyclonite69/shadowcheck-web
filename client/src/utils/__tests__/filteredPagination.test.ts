import { getNextPageOffset, resolveFetchOffset } from '../filteredPagination';

describe('filteredPagination', () => {
  describe('resolveFetchOffset', () => {
    it('returns 0 for reset fetches', () => {
      expect(resolveFetchOffset(true, 100)).toBe(0);
      expect(resolveFetchOffset(true, 100, 200)).toBe(0);
    });

    it('uses override offset when provided for non-reset fetches', () => {
      expect(resolveFetchOffset(false, 100, 200)).toBe(200);
    });

    it('falls back to current offset for non-reset fetches', () => {
      expect(resolveFetchOffset(false, 100)).toBe(100);
    });
  });

  describe('getNextPageOffset', () => {
    it('returns null while loading', () => {
      expect(getNextPageOffset(0, 100, 500, true)).toBeNull();
    });

    it('returns null when there are no more pages', () => {
      expect(getNextPageOffset(400, 100, 500, false)).toBeNull();
      expect(getNextPageOffset(500, 100, 500, false)).toBeNull();
    });

    it('returns next offset when more pages are available', () => {
      expect(getNextPageOffset(0, 100, 500, false)).toBe(100);
      expect(getNextPageOffset(100, 100, 500, false)).toBe(200);
    });
  });
});
