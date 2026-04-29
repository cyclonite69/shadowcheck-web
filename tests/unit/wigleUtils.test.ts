import {
  parseIncludeTotalFlag,
  stripNullBytes,
  stripNullBytesKeepEmpty,
  stripNullBytesDeep,
} from '../../server/src/services/wigleDetailTransforms';

describe('wigleUtils', () => {
  describe('parseIncludeTotalFlag', () => {
    it('should parse various true/false formats', () => {
      expect(parseIncludeTotalFlag('1').value).toBe(true);
      expect(parseIncludeTotalFlag('true').value).toBe(true);
      expect(parseIncludeTotalFlag('0').value).toBe(false);
      expect(parseIncludeTotalFlag('false').value).toBe(false);
      expect(parseIncludeTotalFlag('').value).toBe(false);
    });

    it('should return error for invalid formats', () => {
      expect(parseIncludeTotalFlag('abc').valid).toBe(false);
    });
  });

  describe('stripNullBytes', () => {
    it('should remove null bytes and return null if empty', () => {
      expect(stripNullBytes('abc\u0000def')).toBe('abcdef');
      expect(stripNullBytes('\u0000')).toBeNull();
      expect(stripNullBytes(null)).toBeNull();
    });
  });

  describe('stripNullBytesKeepEmpty', () => {
    it('should remove null bytes but keep empty string', () => {
      expect(stripNullBytesKeepEmpty('\u0000')).toBe('');
    });
  });

  describe('stripNullBytesDeep', () => {
    it('should recursively strip null bytes', () => {
      const input = { a: 'b\u0000', c: ['d\u0000', { e: 'f\u0000' }] };
      const expected = { a: 'b', c: ['d', { e: 'f' }] };
      expect(stripNullBytesDeep(input)).toEqual(expected);
    });
  });
});
