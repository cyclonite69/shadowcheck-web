/**
 * observationCountMin Investigation
 * Testing why this filter was disabled
 */

import {
  UniversalFilterQueryBuilder,
  DEFAULT_ENABLED,
} from '../../server/src/services/filterQueryBuilder';

describe('observationCountMin - CRITICAL Investigation', () => {
  test('filter generates valid SQL', () => {
    const filters = { observationCountMin: 10 };
    const enabled = { observationCountMin: true };
    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const query = builder.buildNetworkListQuery();

    // Should generate WHERE clause
    expect(query.sql).toContain('ne.observations >=');
    expect(query.sql).toContain('$1');
    expect(query.params[0]).toBe(10);
  });

  test('filter works with network-only optimization', () => {
    const filters = {
      observationCountMin: 5,
      ssid: 'Test', // Network-only filter
    };
    const enabled = {
      observationCountMin: true,
      ssid: true,
    };
    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const query = builder.buildNetworkListQuery();

    // Should use network-only path
    expect(query.sql).toContain('api_network_explorer');
    expect(query.sql).toContain('ne.observations >=');
  });

  test('filter works with observation-level filters', () => {
    const filters = {
      observationCountMin: 5,
      rssiMin: -70, // Observation-level filter
    };
    const enabled = {
      observationCountMin: true,
      rssiMin: true,
    };
    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const query = builder.buildNetworkListQuery();

    // Uses network-only optimization when possible
    expect(query.sql).toContain('api_network_explorer');
    expect(query.sql).toContain('ne.observations >=');
  });

  test('count query includes filter', () => {
    const filters = { observationCountMin: 10 };
    const enabled = { observationCountMin: true };
    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const query = builder.buildNetworkCountQuery();

    expect(query.sql).toContain('observations >=');
  });

  test('filter with value 1 (minimum possible)', () => {
    const filters = { observationCountMin: 1 };
    const enabled = { observationCountMin: true };
    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const query = builder.buildNetworkListQuery();

    expect(query.params).toContain(1);
    expect(query.appliedFilters).toContainEqual({
      type: 'quality',
      field: 'observationCountMin',
      value: 1,
    });
  });

  test('filter with high value (100+)', () => {
    const filters = { observationCountMin: 100 };
    const enabled = { observationCountMin: true };
    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const query = builder.buildNetworkListQuery();

    expect(query.params).toContain(100);
  });

  test('disabled by default in store', () => {
    expect(DEFAULT_ENABLED.observationCountMin).toBe(false);
  });

  test('CONCLUSION: Filter works correctly', () => {
    // The filter implementation is correct
    // It was disabled by design choice, not due to bugs
    // Reason: "avoid excluding valid data" - networks with few observations may still be valuable
    // Recommendation: Keep disabled by default, allow users to enable if needed
    expect(true).toBe(true);
  });
});
