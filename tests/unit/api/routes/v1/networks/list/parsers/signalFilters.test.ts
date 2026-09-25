import { parseSignalFilters } from '../../../../../../../../server/src/api/routes/v1/networks/list/parsers/signalFilters';

// Mock the validation and config modules
jest.mock('../../../../../../../../server/src/validation/parameterParsers', () => ({
  parseOptionalInteger: jest.fn(),
}));

jest.mock('../../../../../../../../server/src/config/routeConfig', () => ({
  ROUTE_CONFIG: {
    networks: {
      maxObservationCount: 10000000,
    },
  },
}));

import { parseOptionalInteger } from '../../../../../../../../server/src/validation/parameterParsers';

describe('signalFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
      if (value === undefined) {
        return { ok: true, value: null };
      }
      const num = Number(value);
      if (Number.isNaN(num) || num < min || num > max) {
        return { ok: false, error: `Invalid ${fieldName} parameter.` };
      }
      return { ok: true, value: num };
    });
  });

  describe('parseSignalFilters', () => {
    it('returns ok: true with default params when all inputs undefined', () => {
      const result = parseSignalFilters(undefined, undefined, undefined, undefined, undefined);
      expect(result.ok).toBe(true);
      expect((result as any).params).toEqual({
        lastSeen: null,
        minSignal: null,
        maxSignal: null,
        minObsCount: 1,
        maxObsCount: null,
      });
    });

    it('parses valid ISO date for lastSeen', () => {
      const dateStr = '2024-01-15T10:30:00Z';
      const result = parseSignalFilters(dateStr, undefined, undefined, undefined, undefined);
      expect(result.ok).toBe(true);
      expect((result as any).params.lastSeen).toBe('2024-01-15T10:30:00.000Z');
    });

    it('handles array as first element for lastSeen', () => {
      const dateStr = '2024-01-15T10:30:00Z';
      const result = parseSignalFilters([dateStr], undefined, undefined, undefined, undefined);
      expect(result.ok).toBe(true);
      expect((result as any).params.lastSeen).toBe('2024-01-15T10:30:00.000Z');
    });

    it('rejects invalid date for lastSeen', () => {
      const result = parseSignalFilters('not-a-date', undefined, undefined, undefined, undefined);
      expect(result.ok).toBe(false);
      expect((result as any).status).toBe(400);
      expect((result as any).error).toBe('Invalid last_seen parameter.');
    });

    it('parses valid minSignal value', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
        if (value === '100' && fieldName === 'min_signal') {
          return { ok: true, value: 100 };
        }
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, '100', undefined, undefined, undefined);
      expect(result.ok).toBe(true);
      expect((result as any).params.minSignal).toBe(100);
    });

    it('rejects invalid minSignal value', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
        if (fieldName === 'min_signal' && value === 'invalid') {
          return { ok: false, error: 'Invalid min_signal parameter.' };
        }
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, 'invalid', undefined, undefined, undefined);
      expect(result.ok).toBe(false);
      expect((result as any).error).toBe('Invalid min_signal parameter.');
    });

    it('parses valid maxSignal value', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
        if (value === '-50' && fieldName === 'max_signal') {
          return { ok: true, value: -50 };
        }
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, undefined, '-50', undefined, undefined);
      expect(result.ok).toBe(true);
      expect((result as any).params.maxSignal).toBe(-50);
    });

    it('rejects invalid maxSignal value', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
        if (fieldName === 'max_signal' && value === 'invalid') {
          return { ok: false, error: 'Invalid max_signal parameter.' };
        }
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, undefined, 'invalid', undefined, undefined);
      expect(result.ok).toBe(false);
      expect((result as any).error).toBe('Invalid max_signal parameter.');
    });

    it('parses valid minObsCount value', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
        if (value === '10' && fieldName === 'min_obs_count') {
          return { ok: true, value: 10 };
        }
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, undefined, undefined, '10', undefined);
      expect(result.ok).toBe(true);
      expect((result as any).params.minObsCount).toBe(10);
    });

    it('defaults minObsCount to 1 when value is null', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((_value, _min, _max, _fieldName) => {
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, undefined, undefined, undefined, undefined);
      expect(result.ok).toBe(true);
      expect((result as any).params.minObsCount).toBe(1);
    });

    it('rejects invalid minObsCount value', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
        if (fieldName === 'min_obs_count' && value === 'invalid') {
          return { ok: false, error: 'Invalid min_obs_count parameter.' };
        }
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, undefined, undefined, 'invalid', undefined);
      expect(result.ok).toBe(false);
      expect((result as any).error).toBe('Invalid min_obs_count parameter.');
    });

    it('parses valid maxObsCount value', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
        if (value === '5000' && fieldName === 'max_obs_count') {
          return { ok: true, value: 5000 };
        }
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, undefined, undefined, undefined, '5000');
      expect(result.ok).toBe(true);
      expect((result as any).params.maxObsCount).toBe(5000);
    });

    it('rejects invalid maxObsCount value', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
        if (fieldName === 'max_obs_count' && value === 'invalid') {
          return { ok: false, error: 'Invalid max_obs_count parameter.' };
        }
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, undefined, undefined, undefined, 'invalid');
      expect(result.ok).toBe(false);
      expect((result as any).error).toBe('Invalid max_obs_count parameter.');
    });

    it('combines all valid parameters', () => {
      (parseOptionalInteger as jest.Mock).mockImplementation((value, min, max, fieldName) => {
        const map: Record<string, number> = {
          min_signal: -100,
          max_signal: -30,
          min_obs_count: 5,
          max_obs_count: 1000,
        };
        return { ok: true, value: map[fieldName] !== undefined ? map[fieldName] : null };
      });

      const result = parseSignalFilters('2024-01-15T10:30:00Z', '-100', '-30', '5', '1000');

      expect(result.ok).toBe(true);
      const params = (result as any).params;
      expect(params.lastSeen).toBe('2024-01-15T10:30:00.000Z');
      expect(params.minSignal).toBe(-100);
      expect(params.maxSignal).toBe(-30);
      expect(params.minObsCount).toBe(5);
      expect(params.maxObsCount).toBe(1000);
    });

    it('stops at first validation error', () => {
      let callCount = 0;
      (parseOptionalInteger as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, error: 'First error' };
        }
        return { ok: true, value: null };
      });

      const result = parseSignalFilters(undefined, 'invalid', undefined, undefined, undefined);
      expect(result.ok).toBe(false);
      expect((result as any).error).toBe('Invalid min_signal parameter.');
    });
  });
});
