export {};

import { NetworkListQueryBuilder } from '../../../server/src/services/filterQueryBuilder/builders/NetworkListQueryBuilder';

describe('NetworkListQueryBuilder', () => {
  test('executes delegate when mode is list or undefined', () => {
    const result = new NetworkListQueryBuilder(undefined, () => ({
      sql: 'SELECT 1',
      params: [],
      appliedFilters: [],
      ignoredFilters: [],
      warnings: [],
    })).build();

    expect(result.sql).toBe('SELECT 1');
  });

  test('throws on mismatched mode', () => {
    const builder = new NetworkListQueryBuilder(
      { mode: 'geospatial', alias: 'ne' },
      () => ({
        sql: 'SELECT 1',
        params: [],
        appliedFilters: [],
        ignoredFilters: [],
        warnings: [],
      })
    );

    expect(() => builder.build()).toThrow('expects mode=list');
  });
});
