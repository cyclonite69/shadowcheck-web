export {};

const { validators } = require('../../server/src/utils/validators');

describe('validators', () => {
  describe('json', () => {
    test('parses valid JSON', () => {
      expect(validators.json('{"key":"value"}')).toEqual({ key: 'value' });
    });

    test('returns null for invalid JSON', () => {
      expect(validators.json('{invalid}')).toBeNull();
    });

    test('returns null for undefined', () => {
      expect(validators.json(undefined)).toBeNull();
    });
  });

  describe('limit', () => {
    test('parses valid integer', () => {
      expect(validators.limit('50', 1, 100, 10)).toBe(50);
    });

    test('clamps to min', () => {
      expect(validators.limit('0', 1, 100, 10)).toBe(1);
    });

    test('clamps to max', () => {
      expect(validators.limit('200', 1, 100, 10)).toBe(100);
    });

    test('returns default for invalid input', () => {
      expect(validators.limit('invalid', 1, 100, 10)).toBe(10);
    });

    test('returns default for undefined', () => {
      expect(validators.limit(undefined, 1, 100, 10)).toBe(10);
    });
  });

  describe('offset', () => {
    test('parses valid integer', () => {
      expect(validators.offset('100')).toBe(100);
    });

    test('clamps to min 0', () => {
      expect(validators.offset('-10')).toBe(0);
    });

    test('clamps to max', () => {
      expect(validators.offset('20000000', 1000)).toBe(1000);
    });

    test('returns 0 for invalid input', () => {
      expect(validators.offset('invalid')).toBe(0);
    });

    test('returns 0 for undefined', () => {
      expect(validators.offset(undefined)).toBe(0);
    });
  });

  describe('search', () => {
    test('trims and returns string', () => {
      expect(validators.search('  test  ')).toBe('test');
    });

    test('truncates to maxLen', () => {
      expect(validators.search('a'.repeat(300), 10)).toBe('a'.repeat(10));
    });

    test('returns empty string for undefined', () => {
      expect(validators.search(undefined)).toBe('');
    });
  });

  describe('sort', () => {
    test('returns valid column from allowlist', () => {
      expect(validators.sort('name', ['name', 'date'])).toBe('name');
    });

    test('returns first allowed column for invalid input', () => {
      expect(validators.sort('invalid', ['name', 'date'])).toBe('name');
    });

    test('returns first allowed column for undefined', () => {
      expect(validators.sort(undefined, ['name', 'date'])).toBe('name');
    });

    test('is case-insensitive', () => {
      expect(validators.sort('NAME', ['name', 'date'])).toBe('name');
    });
  });

  describe('order', () => {
    test('returns ASC for "asc"', () => {
      expect(validators.order('asc')).toBe('ASC');
    });

    test('returns ASC for "ASC"', () => {
      expect(validators.order('ASC')).toBe('ASC');
    });

    test('returns DESC for anything else', () => {
      expect(validators.order('desc')).toBe('DESC');
      expect(validators.order('invalid')).toBe('DESC');
      expect(validators.order(undefined)).toBe('DESC');
    });
  });

  describe('bssid', () => {
    test('validates and uppercases valid BSSID', () => {
      expect(validators.bssid('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
    });

    test('returns null for invalid BSSID', () => {
      expect(validators.bssid('invalid')).toBeNull();
      expect(validators.bssid('AA:BB:CC:DD:EE')).toBeNull();
      expect(validators.bssid('AA-BB-CC-DD-EE-FF')).toBeNull();
    });

    test('returns null for undefined', () => {
      expect(validators.bssid(undefined)).toBeNull();
    });
  });
});
