export {};

const {
  toNumber,
  escapeHtml,
  formatTimestamp,
  buildGoogleMapsUrl,
  buildStreetViewUrl,
} = require('../../server/src/services/reports/threatReportUtils');

describe('threatReportUtils', () => {
  test('toNumber parses numeric strings and rejects invalid values', () => {
    expect(toNumber('42.5')).toBeCloseTo(42.5, 6);
    expect(toNumber(10)).toBe(10);
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });

  test('escapeHtml escapes dangerous characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toContain('&lt;script&gt;');
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  test('formatTimestamp formats UTC timestamp and handles null', () => {
    expect(formatTimestamp(null)).toBe('N/A');
    expect(formatTimestamp(0)).toBe('N/A');
    expect(formatTimestamp(Date.UTC(2026, 2, 4, 12, 34, 56))).toBe('2026-03-04 12:34:56 UTC');
  });

  test('map links build when coordinates are present', () => {
    expect(buildGoogleMapsUrl(43.0, -83.7)).toBe('https://www.google.com/maps?q=43,-83.7');
    expect(buildStreetViewUrl(43.0, -83.7)).toBe(
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=43,-83.7'
    );
    expect(buildGoogleMapsUrl(null, -83.7)).toBeNull();
    expect(buildStreetViewUrl(43.0, null)).toBeNull();
  });
});
