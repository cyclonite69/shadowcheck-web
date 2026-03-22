export {};

import { mapThreatCategoriesToDbLevels } from '../../server/src/services/filterQueryBuilder/threatCategoryLevels';

describe('mapThreatCategoriesToDbLevels', () => {
  test('maps canonical labels and preserves MED alias expansion', () => {
    expect(mapThreatCategoriesToDbLevels(['critical', 'medium', 'med', 'none'])).toEqual([
      'CRITICAL',
      'MEDIUM',
      'MED',
      'NONE',
    ]);
  });

  test('deduplicates repeated categories after normalization', () => {
    expect(mapThreatCategoriesToDbLevels(['high', 'HIGH', 'high'])).toEqual(['HIGH']);
  });
});
