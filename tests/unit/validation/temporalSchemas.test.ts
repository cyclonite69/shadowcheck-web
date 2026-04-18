/**
 * Temporal Schemas Unit Tests
 */

import {
  validateTimestamp,
  validateDateString,
  validateDateRange,
  validateRelativeRange,
  validateTimeWindow,
  validateTimezone,
  validateDateFormat,
} from '../../../server/src/validation/schemas/temporalSchemas';

describe('Temporal Validation Schemas', () => {
  describe('validateTimestamp()', () => {
    it('should validate correct ISO string', () => {
      const iso = '2026-04-13T12:00:00Z';
      const result = validateTimestamp(iso);
      expect(result.valid).toBe(true);
      expect(result.value).toBeInstanceOf(Date);
    });

    it('should validate Date object', () => {
      const date = new Date();
      expect(validateTimestamp(date).valid).toBe(true);
    });

    it('should fail for invalid date string', () => {
      expect(validateTimestamp('not-a-date').valid).toBe(false);
    });

    it('should fail for null or undefined', () => {
      expect(validateTimestamp(null as any).valid).toBe(false);
      expect(validateTimestamp(undefined as any).valid).toBe(false);
    });

    it('should fail for non-string/non-Date types', () => {
      expect(validateTimestamp(12345 as any).valid).toBe(false);
      expect(validateTimestamp({} as any).valid).toBe(false);
    });
  });

  describe('validateDateString()', () => {
    it('should validate YYYY-MM-DD', () => {
      expect(validateDateString('2026-04-13').valid).toBe(true);
    });

    it('should validate ISO format', () => {
      expect(validateDateString('2026-04-13T12:00:00Z').valid).toBe(true);
    });

    it('should fail for invalid format', () => {
      expect(validateDateString('13-04-2026').valid).toBe(false);
    });

    it('should fail for null or non-string', () => {
      expect(validateDateString(null as any).valid).toBe(false);
      expect(validateDateString(123 as any).valid).toBe(false);
    });

    it('should fail for invalid dates like 2026-02-31', () => {
      expect(validateDateString('2026-02-31').valid).toBe(false);
    });
  });

  describe('validateDateRange()', () => {
    it('should validate correct range', () => {
      const start = '2026-04-01';
      const end = '2026-04-10';
      expect(validateDateRange(start, end).valid).toBe(true);
    });

    it('should fail if start > end', () => {
      const start = '2026-04-10';
      const end = '2026-04-01';
      expect(validateDateRange(start, end).valid).toBe(false);
    });

    it('should fail if start date is invalid', () => {
      expect(validateDateRange('invalid', '2026-04-01').valid).toBe(false);
    });

    it('should fail if end date is invalid', () => {
      expect(validateDateRange('2026-04-01', 'invalid').valid).toBe(false);
    });

    it('should fail if range too long', () => {
      const start = '2025-01-01';
      const end = '2026-02-01'; // > 365 days
      expect(validateDateRange(start, end).valid).toBe(false);
    });
  });

  describe('validateRelativeRange()', () => {
    it('should validate h, d, w, m units', () => {
      expect(validateRelativeRange('24h').valid).toBe(true);
      expect(validateRelativeRange('7d').valid).toBe(true);
      expect(validateRelativeRange('4w').valid).toBe(true);
      expect(validateRelativeRange('6m').valid).toBe(true);
    });

    it('should fail for empty or non-string', () => {
      expect(validateRelativeRange('').valid).toBe(false);
      expect(validateRelativeRange(null as any).valid).toBe(false);
    });

    it('should fail for invalid unit', () => {
      expect(validateRelativeRange('10y').valid).toBe(false);
    });

    it('should fail for non-numeric value', () => {
      expect(validateRelativeRange('abc-d').valid).toBe(false);
    });

    it('should fail for zero or negative value', () => {
      expect(validateRelativeRange('0h').valid).toBe(false);
      expect(validateRelativeRange('-5d').valid).toBe(false);
    });
  });

  describe('validateTimeWindow()', () => {
    it('should validate range-based window', () => {
      const result = validateTimeWindow({ range: '7d' });
      expect(result.valid).toBe(true);
      expect(result.value?.start).toBeInstanceOf(Date);
      expect(result.value?.end).toBeInstanceOf(Date);
    });

    it('should validate absolute window', () => {
      const result = validateTimeWindow({ startDate: '2026-04-01', endDate: '2026-04-05' });
      expect(result.valid).toBe(true);
    });

    it('should fail if range value is not positive', () => {
      expect(validateTimeWindow({ range: '0h' }).valid).toBe(false);
    });

    it('should fail for unsupported range unit', () => {
      expect(validateTimeWindow({ range: '1y' }).valid).toBe(false);
    });

    it('should fail for missing window params', () => {
      expect(validateTimeWindow({}).valid).toBe(false);
    });

    it('should handle different range units', () => {
      expect(validateTimeWindow({ range: '1w' }).valid).toBe(true);
      expect(validateTimeWindow({ range: '1m' }).valid).toBe(true);
    });
  });

  describe('validateTimezone()', () => {
    it('should validate common timezones', () => {
      expect(validateTimezone('UTC').valid).toBe(true);
      expect(validateTimezone('America/New_York').valid).toBe(true);
      expect(validateTimezone('Europe/London').valid).toBe(true);
    });

    it('should fail for invalid timezone', () => {
      expect(validateTimezone('Invalid/Timezone').valid).toBe(false);
      expect(validateTimezone(null as any).valid).toBe(false);
    });
  });

  describe('validateDateFormat()', () => {
    it('should validate supported date formats', () => {
      expect(validateDateFormat('2026-04-13', 'YYYY-MM-DD').valid).toBe(true);
      expect(validateDateFormat('2026-04-13 12:00:00', 'YYYY-MM-DD HH:mm:ss').valid).toBe(true);
      expect(validateDateFormat('04/13/2026', 'MM/DD/YYYY').valid).toBe(true);
    });

    it('should fail for unsupported date format', () => {
      expect(validateDateFormat('2026-04-13', 'DD-MM-YYYY').valid).toBe(false);
    });

    it('should fail for non-matching date string', () => {
      expect(validateDateFormat('2026/04/13', 'YYYY-MM-DD').valid).toBe(false);
    });

    it('should fail for invalid date string', () => {
      expect(validateDateFormat(null as any, 'YYYY-MM-DD').valid).toBe(false);
    });
  });
});
