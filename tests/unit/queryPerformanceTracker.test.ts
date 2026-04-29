export {};

jest.mock('../../server/src/logging/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
}));

import { QueryPerformanceTracker } from '../../server/src/utils/queryPerformanceTracker';
const logger = require('../../server/src/logging/logger');

describe('QueryPerformanceTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('finish returns correct queryType and defaults', () => {
    const tracker = new QueryPerformanceTracker('test-query');
    const result = tracker.finish();
    expect(result.queryType).toBe('test-query');
    expect(result.pathTaken).toBe('unfiltered');
    expect(result.filterCount).toBe(0);
    expect(result.appliedFilters).toEqual([]);
    expect(result.ignoredFilters).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
  });

  test('setPath sets the path', () => {
    const tracker = new QueryPerformanceTracker('q');
    tracker.setPath('fast');
    expect(tracker.finish().pathTaken).toBe('fast');
  });

  test('addAppliedFilter tracks filters', () => {
    const tracker = new QueryPerformanceTracker('q');
    tracker.addAppliedFilter('ssid', true);
    tracker.addAppliedFilter('bssid', false);
    const result = tracker.finish();
    expect(result.filterCount).toBe(2);
    expect(result.appliedFilters[0]).toMatchObject({
      filterType: 'ssid',
      enabled: true,
      applied: true,
    });
    expect(result.appliedFilters[1]).toMatchObject({
      filterType: 'bssid',
      enabled: false,
      applied: true,
    });
  });

  test('addIgnoredFilter tracks ignored filters', () => {
    const tracker = new QueryPerformanceTracker('q');
    tracker.addIgnoredFilter('channel');
    expect(tracker.finish().ignoredFilters).toEqual(['channel']);
  });

  test('addWarning tracks warnings and triggers logger.warn', () => {
    const tracker = new QueryPerformanceTracker('q');
    tracker.addWarning('something slow');
    const result = tracker.finish();
    expect(result.warnings).toEqual(['something slow']);
    expect(logger.warn).toHaveBeenCalledWith(
      '[QueryPerformance] Slow or problematic query',
      expect.objectContaining({ warnings: ['something slow'] })
    );
  });

  test('setResultCount sets resultCount', () => {
    const tracker = new QueryPerformanceTracker('q');
    tracker.setResultCount(42);
    expect(tracker.finish().resultCount).toBe(42);
  });

  test('logs info when DEBUG_QUERY_PERFORMANCE is true', () => {
    process.env.DEBUG_QUERY_PERFORMANCE = 'true';
    const tracker = new QueryPerformanceTracker('q');
    tracker.finish();
    expect(logger.info).toHaveBeenCalledWith('[QueryPerformance]', expect.any(Object));
    delete process.env.DEBUG_QUERY_PERFORMANCE;
  });
});
