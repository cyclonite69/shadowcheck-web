const filters = require('../../../server/src/services/dataQualityFilters');

describe('DATA_QUALITY_FILTERS', () => {
  test('should have defined filter strings', () => {
    expect(filters.DATA_QUALITY_FILTERS.temporal_clusters).toBeDefined();
    expect(filters.DATA_QUALITY_FILTERS.extreme_signals).toBeDefined();
    expect(filters.DATA_QUALITY_FILTERS.duplicate_coords).toBeDefined();
  });

  test('all() should return combined filters', () => {
    const allFilters = filters.DATA_QUALITY_FILTERS.all();
    expect(allFilters).toContain(filters.DATA_QUALITY_FILTERS.temporal_clusters);
    expect(allFilters).toContain(filters.DATA_QUALITY_FILTERS.extreme_signals);
    expect(allFilters).toContain(filters.DATA_QUALITY_FILTERS.duplicate_coords);
  });
});
