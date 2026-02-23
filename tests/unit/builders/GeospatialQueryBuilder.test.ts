export {};

import { GeospatialQueryBuilder } from '../../../server/src/services/filterQueryBuilder/builders/GeospatialQueryBuilder';

describe('GeospatialQueryBuilder', () => {
  test('executes delegate when mode is geospatial or undefined', () => {
    const result = new GeospatialQueryBuilder(undefined, () => ({
      sql: 'SELECT 1',
      params: [],
      appliedFilters: [],
      ignoredFilters: [],
      warnings: [],
    })).build();

    expect(result.sql).toBe('SELECT 1');
  });

  test('throws on mismatched mode', () => {
    const builder = new GeospatialQueryBuilder(
      { mode: 'network-only', alias: 'o' },
      () => ({
        sql: 'SELECT 1',
        params: [],
        appliedFilters: [],
        ignoredFilters: [],
        warnings: [],
      })
    );

    expect(() => builder.build()).toThrow('expects mode=geospatial');
  });
});
