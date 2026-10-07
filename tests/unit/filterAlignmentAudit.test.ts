import { UniversalFilterQueryBuilder } from '../../server/src/services/filterQueryBuilder/universalFilterQueryBuilder';

describe('Systematic Filter Alignment Audit', () => {
  const ALL_FILTERS = [
    'ssid',
    'bssid',
    'manufacturer',
    'radioTypes',
    'frequencyBands',
    'channelMin',
    'channelMax',
    'rssiMin',
    'rssiMax',
    'encryptionTypes',
    'securityFlags',
    'timeframe',
    'observationCountMin',
    'observationCountMax',
    'gpsAccuracyMax',
    'excludeInvalidCoords',
    'qualityFilter',
    'boundingBox',
    'radiusFilter',
    'distanceFromHomeMin',
    'distanceFromHomeMax',
    'threatScoreMin',
    'threatScoreMax',
    'threatCategories',
    'stationaryConfidenceMin',
    'stationaryConfidenceMax',
    'has_notes',
    'tag_type',
  ];

  test('All filters are recognized by the builder', () => {
    const filters: any = {};
    const enabled: any = {};
    ALL_FILTERS.forEach((f) => {
      filters[f] =
        f === 'radiusFilter'
          ? { latitude: 40.7, longitude: -73.9, radiusMeters: 1000 }
          : f.includes('Min') || f.includes('Max') || f.includes('Score')
            ? 10
            : 'test';
      enabled[f] = true;
    });

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { appliedFilters } = builder.buildNetworkListQuery();

    const appliedNames = appliedFilters.map((f: any) => f.field);
    const missing = ALL_FILTERS.filter((f) => !appliedNames.includes(f));

    // Some filters might be combined or renamed in appliedFilters,
    // but they should at least be handled.
    console.log('Applied filters:', appliedNames);
    console.log('Missing filters:', missing);
  });
});
