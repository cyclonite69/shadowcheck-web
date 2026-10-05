import { parseByteRange } from '../../server/src/utils/httpRangeUtils';

describe('httpRangeUtils - parseByteRange', () => {
  const totalSize = 100; // valid byte offsets 0..99

  describe('valid single ranges', () => {
    it('parses closed byte range bytes=start-end', () => {
      const result = parseByteRange('bytes=0-3', totalSize);
      expect(result).toEqual({ status: 'range', start: 0, end: 3 });
    });

    it('parses middle closed byte range', () => {
      const result = parseByteRange('bytes=10-25', totalSize);
      expect(result).toEqual({ status: 'range', start: 10, end: 25 });
    });

    it('parses single byte range bytes=0-0', () => {
      const result = parseByteRange('bytes=0-0', totalSize);
      expect(result).toEqual({ status: 'range', start: 0, end: 0 });
    });

    it('parses open-ended byte range bytes=start-', () => {
      const result = parseByteRange('bytes=4-', totalSize);
      expect(result).toEqual({ status: 'range', start: 4, end: 99 });
    });

    it('parses full open-ended range bytes=0-', () => {
      const result = parseByteRange('bytes=0-', totalSize);
      expect(result).toEqual({ status: 'range', start: 0, end: 99 });
    });

    it('clamps oversized end offset to totalSize - 1', () => {
      const result = parseByteRange('bytes=50-200', totalSize);
      expect(result).toEqual({ status: 'range', start: 50, end: 99 });
    });

    it('parses suffix range bytes=-suffix', () => {
      const result = parseByteRange('bytes=-20', totalSize);
      expect(result).toEqual({ status: 'range', start: 80, end: 99 });
    });

    it('handles suffix range larger than totalSize by starting at 0', () => {
      const result = parseByteRange('bytes=-150', totalSize);
      expect(result).toEqual({ status: 'range', start: 0, end: 99 });
    });
  });

  describe('unsatisfiable ranges (HTTP 416)', () => {
    it('returns unsatisfiable when start >= totalSize', () => {
      const result = parseByteRange('bytes=100-', totalSize);
      expect(result).toEqual({ status: 'unsatisfiable' });
    });

    it('returns unsatisfiable when start > end', () => {
      const result = parseByteRange('bytes=50-40', totalSize);
      expect(result).toEqual({ status: 'unsatisfiable' });
    });

    it('returns unsatisfiable when totalSize is 0', () => {
      const result = parseByteRange('bytes=0-10', 0);
      expect(result).toEqual({ status: 'unsatisfiable' });
    });

    it('returns unsatisfiable when suffix is 0', () => {
      const result = parseByteRange('bytes=-0', totalSize);
      expect(result).toEqual({ status: 'unsatisfiable' });
    });
  });

  describe('unsupported or malformed ranges (HTTP 200 fallback)', () => {
    it('returns ignore when rangeHeader is undefined or empty', () => {
      expect(parseByteRange(undefined, totalSize)).toEqual({ status: 'ignore' });
      expect(parseByteRange('', totalSize)).toEqual({ status: 'ignore' });
    });

    it('returns ignore when header does not specify bytes unit', () => {
      expect(parseByteRange('items=0-10', totalSize)).toEqual({ status: 'ignore' });
    });

    it('returns ignore for multiple comma-separated ranges', () => {
      const result = parseByteRange('bytes=0-10, 20-30', totalSize);
      expect(result).toEqual({ status: 'ignore' });
    });

    it('returns ignore for malformed syntax bytes=-', () => {
      expect(parseByteRange('bytes=-', totalSize)).toEqual({ status: 'ignore' });
    });

    it('returns ignore for malformed non-numeric values', () => {
      expect(parseByteRange('bytes=abc-def', totalSize)).toEqual({ status: 'ignore' });
      expect(parseByteRange('bytes=invalid', totalSize)).toEqual({ status: 'ignore' });
    });
  });
});
