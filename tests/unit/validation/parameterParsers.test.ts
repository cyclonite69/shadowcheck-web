import {
  parseRequiredInteger,
  parseOptionalNumber,
  parseOptionalInteger,
  parseCommaList,
  parseBoundingBoxParams,
  parseRadiusParams,
} from '../../../server/src/validation/parameterParsers';

// Mock the schemas module since it's required in the source
jest.mock('../../../server/src/validation/schemas', () => ({
  validateIntegerRange: jest.fn(),
  validateNumberRange: jest.fn(),
}));

const schemas = require('../../../server/src/validation/schemas');

describe('Parameter Parsers', () => {
  describe('parseRequiredInteger', () => {
    it('returns error if value is undefined', () => {
      const result = parseRequiredInteger(undefined, 0, 100, 'test', 'Missing', 'Invalid');
      expect(result).toEqual({ ok: false, error: 'Missing' });
    });

    it('returns error if validation fails', () => {
      schemas.validateIntegerRange.mockReturnValue({ valid: false, error: 'Internal Error' });
      const result = parseRequiredInteger('abc', 0, 100, 'test', 'Missing', 'Invalid');
      expect(result).toEqual({ ok: false, error: 'Invalid' });
    });

    it('returns custom invalid message if validation fails and message provided', () => {
      schemas.validateIntegerRange.mockReturnValue({ valid: false, error: 'Some error' });
      const result = parseRequiredInteger('abc', 0, 100, 'test', 'Missing', 'Custom Invalid');
      expect(result).toEqual({ ok: false, error: 'Custom Invalid' });
    });

    it('returns validation error if no invalidMessage provided', () => {
      schemas.validateIntegerRange.mockReturnValue({ valid: false, error: 'Validation Error' });
      const result = parseRequiredInteger('abc', 0, 100, 'test', 'Missing', '');
      expect(result).toEqual({ ok: false, error: 'Validation Error' });
    });

    it('returns value if validation succeeds', () => {
      schemas.validateIntegerRange.mockReturnValue({ valid: true, value: 42 });
      const result = parseRequiredInteger('42', 0, 100, 'test', 'Missing', 'Invalid');
      expect(result).toEqual({ ok: true, value: 42 });
    });
  });

  describe('parseOptionalNumber', () => {
    it('returns ok with null if value is undefined', () => {
      const result = parseOptionalNumber(undefined, 0, 100, 'test');
      expect(result).toEqual({ ok: true, value: null });
    });

    it('returns error if value is empty string', () => {
      const result = parseOptionalNumber('', 0, 100, 'test');
      expect(result).toEqual({ ok: false, error: 'Invalid test parameter.' });
    });

    it('returns error if validation fails', () => {
      schemas.validateNumberRange.mockReturnValue({ valid: false, error: 'Range error' });
      const result = parseOptionalNumber('150', 0, 100, 'test');
      expect(result).toEqual({ ok: false, error: 'Range error' });
    });

    it('returns value if validation succeeds', () => {
      schemas.validateNumberRange.mockReturnValue({ valid: true, value: 50.5 });
      const result = parseOptionalNumber('50.5', 0, 100, 'test');
      expect(result).toEqual({ ok: true, value: 50.5 });
    });
  });

  describe('parseOptionalInteger', () => {
    it('returns ok with null if value is undefined', () => {
      const result = parseOptionalInteger(undefined, 0, 100, 'test');
      expect(result).toEqual({ ok: true, value: null });
    });

    it('returns error if value is empty string', () => {
      const result = parseOptionalInteger('', 0, 100, 'test');
      expect(result).toEqual({ ok: false, error: 'Invalid test parameter.' });
    });

    it('returns error if validation fails', () => {
      schemas.validateIntegerRange.mockReturnValue({ valid: false, error: 'Integer range error' });
      const result = parseOptionalInteger('150', 0, 100, 'test');
      expect(result).toEqual({ ok: false, error: 'Integer range error' });
    });

    it('returns value if validation succeeds', () => {
      schemas.validateIntegerRange.mockReturnValue({ valid: true, value: 50 });
      const result = parseOptionalInteger('50', 0, 100, 'test');
      expect(result).toEqual({ ok: true, value: 50 });
    });
  });

  describe('parseCommaList', () => {
    it('returns null if value is undefined', () => {
      expect(parseCommaList(undefined)).toBeNull();
    });

    it('parses comma-separated values and trims them', () => {
      expect(parseCommaList('a, b,  c ')).toEqual(['a', 'b', 'c']);
    });

    it('filters out empty values', () => {
      expect(parseCommaList('a,,b')).toEqual(['a', 'b']);
    });

    it('returns null if list is empty after filtering', () => {
      expect(parseCommaList(',,')).toBeNull();
    });

    it('respects maxItems', () => {
      expect(parseCommaList('a,b,c,d', 2)).toEqual(['a', 'b']);
    });
  });

  describe('parseBoundingBoxParams', () => {
    it('returns null value if any parameter is missing', () => {
      expect(parseBoundingBoxParams(1, 2, 3, undefined)).toEqual({ ok: true, value: null });
    });

    it('returns null value if any parameter is NaN', () => {
      expect(parseBoundingBoxParams('abc', 2, 3, 4)).toEqual({ ok: true, value: null });
    });

    it('returns null value if coordinates are out of bounds', () => {
      // Latitude out of bounds
      expect(parseBoundingBoxParams(-91, 2, 3, 4)).toEqual({ ok: true, value: null });
      expect(parseBoundingBoxParams(1, 91, 3, 4)).toEqual({ ok: true, value: null });
      // Longitude out of bounds
      expect(parseBoundingBoxParams(1, 2, -181, 4)).toEqual({ ok: true, value: null });
      expect(parseBoundingBoxParams(1, 2, 3, 181)).toEqual({ ok: true, value: null });
      // Min > Max
      expect(parseBoundingBoxParams(10, 5, 3, 4)).toEqual({ ok: true, value: null });
      expect(parseBoundingBoxParams(1, 2, 10, 5)).toEqual({ ok: true, value: null });
    });

    it('returns parsed values if valid', () => {
      const result = parseBoundingBoxParams('10.5', '20.5', '-30.5', '40.5');
      expect(result).toEqual({
        ok: true,
        value: {
          minLat: 10.5,
          maxLat: 20.5,
          minLng: -30.5,
          maxLng: 40.5,
        },
      });
    });
  });

  describe('parseRadiusParams', () => {
    it('returns null value if any parameter is missing', () => {
      expect(parseRadiusParams(1, 2, undefined)).toEqual({ ok: true, value: null });
    });

    it('returns null value if any parameter is NaN', () => {
      expect(parseRadiusParams('abc', 2, 3)).toEqual({ ok: true, value: null });
    });

    it('returns null value if coordinates or radius are invalid', () => {
      // Latitude out of bounds
      expect(parseRadiusParams(91, 0, 100)).toEqual({ ok: true, value: null });
      // Longitude out of bounds
      expect(parseRadiusParams(0, 181, 100)).toEqual({ ok: true, value: null });
      // Radius <= 0
      expect(parseRadiusParams(0, 0, 0)).toEqual({ ok: true, value: null });
      expect(parseRadiusParams(0, 0, -10)).toEqual({ ok: true, value: null });
    });

    it('returns parsed values if valid', () => {
      const result = parseRadiusParams('10.5', '-20.5', '1000');
      expect(result).toEqual({
        ok: true,
        value: {
          centerLat: 10.5,
          centerLng: -20.5,
          radius: 1000,
        },
      });
    });
  });
});
