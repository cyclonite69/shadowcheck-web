import { safeJsonParse } from '../../../server/src/utils/safeJsonParse';

describe('safeJsonParse', () => {
  let originalConsoleWarn: any;
  let originalConsoleError: any;
  let originalJsonParse: any;

  beforeEach(() => {
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    console.warn = jest.fn();
    console.error = jest.fn();
    originalJsonParse = JSON.parse;
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    JSON.parse = originalJsonParse;
  });

  it('should return null for non-string input', () => {
    expect(safeJsonParse(null)).toBeNull();
    expect(safeJsonParse(undefined)).toBeNull();
  });

  it('should parse valid JSON objects', () => {
    expect(safeJsonParse('{"a": 1}')).toEqual({ a: 1 });
  });

  it('should parse valid JSON arrays', () => {
    expect(safeJsonParse('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('should handle strings that do not start with [ or {', () => {
    expect(safeJsonParse('   true   ')).toBeNull();
    expect(safeJsonParse('123')).toBeNull();
  });

  it('should handle generic JSON parse errors and return null', () => {
    expect(safeJsonParse('{a: 1}')).toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('JSON parse error:'));
  });

  it('should fix incomplete \\u sequences and parse successfully', () => {
    // Mock JSON.parse to throw the specific error message expected by the catch block on first try
    JSON.parse = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('Unicode escape sequence error');
      })
      .mockImplementationOnce(originalJsonParse);

    // The string has a malformed \u that safeJsonParse fixes to \\u
    const result = safeJsonParse('{"a": "\\u"}');
    expect(result).toEqual({ a: '\\u' });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unicode escape error in JSON')
    );
  });

  it('should fix unescaped backslashes and parse successfully', () => {
    JSON.parse = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('escape sequence error');
      })
      .mockImplementationOnce(originalJsonParse);

    // The string has a malformed \x that safeJsonParse fixes to \\x
    const result = safeJsonParse('{"a": "\\x"}');
    expect(result).toEqual({ a: '\\x' });
  });

  it('should return null if fixing the JSON fails', () => {
    JSON.parse = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('escape sequence error');
      })
      .mockImplementationOnce(() => {
        throw new Error('second parse error');
      });

    const result = safeJsonParse('{"a": "\\x"}');
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith('Failed to fix JSON: second parse error');
  });
});
