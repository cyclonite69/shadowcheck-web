import type { Request } from 'express';
import {
  resolvePageType,
  resolveBodyPageType,
  isIgnoredRow,
  applyEffectiveThreat,
  parseAndValidateBodyFilters,
} from '../../../../../../server/src/api/routes/v2/filtered/utils';

describe('v2/filtered/utils', () => {
  describe('resolvePageType', () => {
    it('returns "wigle" when req.query.pageType is "wigle"', () => {
      const req = { query: { pageType: 'wigle' } } as unknown as Request;
      expect(resolvePageType(req)).toBe('wigle');
    });

    it('returns "geospatial" when req.query.pageType is not "wigle"', () => {
      const req = { query: { pageType: 'something' } } as unknown as Request;
      expect(resolvePageType(req)).toBe('geospatial');
    });

    it('returns "geospatial" when req.query.pageType is undefined', () => {
      const req = { query: {} } as unknown as Request;
      expect(resolvePageType(req)).toBe('geospatial');
    });
  });

  describe('resolveBodyPageType', () => {
    it('returns "wigle" when body.pageType is "wigle"', () => {
      const result = resolveBodyPageType({ pageType: 'wigle' });
      expect(result).toBe('wigle');
    });

    it('returns "geospatial" when body.pageType is not "wigle"', () => {
      const result = resolveBodyPageType({ pageType: 'something' });
      expect(result).toBe('geospatial');
    });

    it('returns "geospatial" when body is null', () => {
      const result = resolveBodyPageType(null);
      expect(result).toBe('geospatial');
    });

    it('returns "geospatial" when body is not an object', () => {
      const result = resolveBodyPageType('string');
      expect(result).toBe('geospatial');
    });

    it('returns "geospatial" when body.pageType is undefined', () => {
      const result = resolveBodyPageType({});
      expect(result).toBe('geospatial');
    });
  });

  describe('isIgnoredRow', () => {
    it('returns true when is_ignored is boolean true', () => {
      expect(isIgnoredRow({ is_ignored: true })).toBe(true);
    });

    it('returns false when is_ignored is boolean false', () => {
      expect(isIgnoredRow({ is_ignored: false })).toBe(false);
    });

    it('returns true when is_ignored string is "true"', () => {
      expect(isIgnoredRow({ is_ignored: 'true' })).toBe(true);
    });

    it('returns true when is_ignored string is "TRUE"', () => {
      expect(isIgnoredRow({ is_ignored: 'TRUE' })).toBe(true);
    });

    it('returns true when is_ignored string is "True"', () => {
      expect(isIgnoredRow({ is_ignored: 'True' })).toBe(true);
    });

    it('returns false when is_ignored string is "false"', () => {
      expect(isIgnoredRow({ is_ignored: 'false' })).toBe(false);
    });

    it('returns false when is_ignored is undefined', () => {
      expect(isIgnoredRow({})).toBe(false);
    });

    it('returns false when is_ignored is null', () => {
      expect(isIgnoredRow({ is_ignored: null })).toBe(false);
    });

    it('returns false when is_ignored is numeric 0', () => {
      expect(isIgnoredRow({ is_ignored: 0 })).toBe(false);
    });

    it('returns false when is_ignored is numeric 1', () => {
      expect(isIgnoredRow({ is_ignored: 1 })).toBe(false);
    });

    it('does not trim string values before evaluating ignored status', () => {
      expect(isIgnoredRow({ is_ignored: ' true ' })).toBe(false);
    });
  });

  describe('applyEffectiveThreat', () => {
    it('returns row unchanged when is_ignored is false', () => {
      const row = { is_ignored: false, threat: { score: '50', level: 'HIGH' } };
      const result = applyEffectiveThreat(row);
      expect(result).toEqual(row);
    });

    it('returns row unchanged when is_ignored is undefined', () => {
      const row = { threat: { score: '50', level: 'HIGH' } };
      const result = applyEffectiveThreat(row);
      expect(result).toEqual(row);
    });

    it('overrides threat to NONE when is_ignored is true', () => {
      const row = { is_ignored: true, threat: { score: '50', level: 'HIGH' } };
      const result = applyEffectiveThreat(row);
      expect(result as any).toEqual({
        is_ignored: true,
        threat: {
          score: '0',
          level: 'NONE',
          flags: ['IGNORED'],
          signals: [],
        },
      });
    });

    it('preserves other properties when applying effective threat', () => {
      const row = {
        is_ignored: true,
        bssid: 'aa:bb:cc:dd:ee:ff',
        ssid: 'TestNetwork',
        threat: { score: '50', level: 'HIGH' },
      };
      const result = applyEffectiveThreat(row);
      expect(result.bssid).toBe('aa:bb:cc:dd:ee:ff');
      expect(result.ssid).toBe('TestNetwork');
      expect(result.threat.level).toBe('NONE');
    });

    it('handles is_ignored as string "true"', () => {
      const row = { is_ignored: 'true', threat: { score: '50', level: 'HIGH' } };
      const result = applyEffectiveThreat(row);
      expect(result.threat.level).toBe('NONE');
    });
  });

  describe('parseAndValidateBodyFilters', () => {
    const mockValidator = (filters: any, _enabled: any) => {
      if (!filters || Object.keys(filters).length === 0) {
        return { errors: [] };
      }
      if (filters.invalid) {
        return { errors: ['Invalid filter type'] };
      }
      return { errors: [] };
    };

    it('returns ok: true with filters and enabled when valid', () => {
      const body = {
        filters: { ssid: 'test' },
        enabled: { ssid: true },
      };
      const result = parseAndValidateBodyFilters(body, mockValidator);
      expect(result as any).toEqual({
        ok: true,
        filters: { ssid: 'test' },
        enabled: { ssid: true },
      });
    });

    it('returns error response when validator returns errors', () => {
      const body = {
        filters: { invalid: true },
        enabled: { invalid: true },
      };
      const result = parseAndValidateBodyFilters(body, mockValidator);
      expect(result as any).toEqual({
        ok: false,
        status: 400,
        body: { ok: false, errors: ['Invalid filter type'] },
      });
    });

    it('defaults to empty filters and enabled when body is null', () => {
      const result = parseAndValidateBodyFilters(null, mockValidator);
      expect(result as any).toEqual({
        ok: true,
        filters: {},
        enabled: {},
      });
    });

    it('defaults to empty filters and enabled when body is not an object', () => {
      const result = parseAndValidateBodyFilters('string', mockValidator);
      expect(result as any).toEqual({
        ok: true,
        filters: {},
        enabled: {},
      });
    });

    it('handles missing filters property', () => {
      const body = { enabled: { ssid: true } };
      const result = parseAndValidateBodyFilters(body, mockValidator);
      expect(result as any).toEqual({
        ok: true,
        filters: {},
        enabled: { ssid: true },
      });
    });

    it('handles missing enabled property', () => {
      const body = { filters: { ssid: 'test' } };
      const result = parseAndValidateBodyFilters(body, mockValidator);
      expect(result as any).toEqual({
        ok: true,
        filters: { ssid: 'test' },
        enabled: {},
      });
    });

    it('passes correct arguments to validator', () => {
      const mockValidatorWithAssert = jest.fn(() => ({ errors: [] }));
      const filters = { ssid: 'network' };
      const enabled = { ssid: true };
      const body = { filters, enabled };

      parseAndValidateBodyFilters(body, mockValidatorWithAssert);
      expect(mockValidatorWithAssert).toHaveBeenCalledWith(filters, enabled);
    });

    it('passes through array-shaped filters and enabled payloads exactly as supplied', () => {
      const mockValidatorWithAssert = jest.fn(() => ({ errors: [] }));
      const filters = ['ssid'];
      const enabled = ['ssid'];

      const result = parseAndValidateBodyFilters({ filters, enabled }, mockValidatorWithAssert);

      expect(result as any).toEqual({ ok: true, filters, enabled });
      expect(mockValidatorWithAssert).toHaveBeenCalledWith(filters, enabled);
    });

    it('returns 400 status with all errors', () => {
      const multiErrorValidator = () => ({
        errors: ['Error 1', 'Error 2', 'Error 3'],
      });
      const body = { filters: { test: true }, enabled: {} };
      const result = parseAndValidateBodyFilters(body, multiErrorValidator);
      expect(result.status).toBe(400);
      expect((result as any).body.errors).toHaveLength(3);
    });
  });
});
