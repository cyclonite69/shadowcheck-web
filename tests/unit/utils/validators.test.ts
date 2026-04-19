const { validators } = require('../../../server/src/utils/validators');

describe('validators', () => {
  describe('json', () => {
    it('should parse valid JSON objects and arrays', () => {
      expect(validators.json('{"a": 1}')).toEqual({ a: 1 });
      expect(validators.json('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should handle malformed JSON and return null', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      expect(validators.json('{a: 1}')).toBeNull();
      expect(validators.json('{"a": 1')).toBeNull();
      expect(validators.json('plain text')).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should handle partially valid object payloads', () => {
      // In JSON, there's no such thing as "partially valid" in terms of syntax.
      // But we can test objects with missing fields if the application expects them.
      const payload = '{"id": 1}'; // Missing "name"
      expect(validators.json(payload)).toEqual({ id: 1 });
    });

    it('should handle null, undefined, and non-string input', () => {
      expect(validators.json(null)).toBeNull();
      expect(validators.json(undefined)).toBeNull();
    });
  });

  describe('limit', () => {
    it('should parse and clamp integer values', () => {
      expect(validators.limit('50', 1, 100, 10)).toBe(50);
      expect(validators.limit('0', 1, 100, 10)).toBe(1);
      expect(validators.limit('150', 1, 100, 10)).toBe(100);
      expect(validators.limit(undefined, 1, 100, 10)).toBe(10);
      expect(validators.limit('abc', 1, 100, 10)).toBe(10);
    });
  });

  describe('offset', () => {
    it('should parse and floor offset values', () => {
      expect(validators.offset('20')).toBe(20);
      expect(validators.offset('-10')).toBe(0);
      expect(validators.offset('20000000')).toBe(10000000);
      expect(validators.offset(undefined)).toBe(0);
      expect(validators.offset('abc')).toBe(0);
    });
  });

  describe('search', () => {
    it('should trim and truncate search strings', () => {
      expect(validators.search('  hello world  ')).toBe('hello world');
      expect(validators.search('a'.repeat(300), 200)).toHaveLength(200);
      expect(validators.search(undefined)).toBe('');
    });
  });

  describe('sort', () => {
    it('should validate sort column against allowlist', () => {
      const allowed = ['id', 'name', 'date'];
      expect(validators.sort('NAME', allowed)).toBe('name');
      expect(validators.sort('invalid', allowed)).toBe('id');
      expect(validators.sort(undefined, allowed)).toBe('id');
    });
  });

  describe('order', () => {
    it('should normalize order direction', () => {
      expect(validators.order('asc')).toBe('ASC');
      expect(validators.order('DESC')).toBe('DESC');
      expect(validators.order('invalid')).toBe('DESC');
      expect(validators.order(undefined)).toBe('DESC');
    });
  });

  describe('bssid', () => {
    it('should validate and uppercase BSSID', () => {
      expect(validators.bssid('00:11:22:33:44:55')).toBe('00:11:22:33:44:55');
      expect(validators.bssid('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
      expect(validators.bssid('invalid')).toBeNull();
      expect(validators.bssid(undefined)).toBeNull();
    });
  });
});
