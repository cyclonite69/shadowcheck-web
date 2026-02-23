export {};

import { NetworkOnlyQueryBuilder } from '../../../server/src/services/filterQueryBuilder/builders/NetworkOnlyQueryBuilder';

describe('NetworkOnlyQueryBuilder', () => {
  test('executes delegate when mode is network-only or undefined', () => {
    const result = new NetworkOnlyQueryBuilder(undefined, () => ({
      sql: 'SELECT 1',
      params: [],
      appliedFilters: [],
      ignoredFilters: [],
      warnings: [],
    })).build();

    expect(result.sql).toBe('SELECT 1');
  });

  test('throws on mismatched mode', () => {
    const builder = new NetworkOnlyQueryBuilder(
      { mode: 'list', alias: 'ne' },
      () => ({
        sql: 'SELECT 1',
        params: [],
        appliedFilters: [],
        ignoredFilters: [],
        warnings: [],
      })
    );

    expect(() => builder.build()).toThrow('expects mode=network-only');
  });
});
