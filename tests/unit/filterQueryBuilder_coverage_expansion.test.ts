export {};

import { SqlFragmentLibrary } from '../../server/src/services/filterQueryBuilder/SqlFragmentLibrary';
import { UniversalFilterQueryBuilder } from '../../server/src/services/filterQueryBuilder';

describe('SqlFragmentLibrary Coverage Expansion', () => {
  test('selectGeocodedFields returns expected fields', () => {
    const fields = SqlFragmentLibrary.selectGeocodedFields('ne');
    expect(fields).toContain('ne.geocoded_address');
    expect(fields).toContain('ne.geocoded_poi_name');
  });

  test('joinNetworkLocations handles different modes', () => {
    expect(SqlFragmentLibrary.joinNetworkLocations('ne', 'latest_observation')).toBe('');
    expect(SqlFragmentLibrary.joinNetworkLocations('ne', 'centroid')).toContain(
      'LEFT JOIN app.network_locations'
    );
    expect(
      SqlFragmentLibrary.joinNetworkLocations('ne', 'weighted_centroid', 'custom_loc')
    ).toContain('LEFT JOIN app.network_locations custom_loc');
  });

  test('selectLocationCoords handles different modes', () => {
    const centroid = SqlFragmentLibrary.selectLocationCoords('ne', 'centroid', 'nl');
    expect(centroid).toContain('nl.centroid_lat');

    const weighted = SqlFragmentLibrary.selectLocationCoords('ne', 'weighted_centroid', 'nl');
    expect(weighted).toContain('nl.weighted_lat');

    const defaultCoords = SqlFragmentLibrary.selectLocationCoords('ne', 'latest_observation');
    expect(defaultCoords).toBe('ne.lat, ne.lon');
  });

  test('joinExplorerMv returns expected join', () => {
    const join = SqlFragmentLibrary.joinExplorerMv('s', 'mv');
    expect(join).toContain('LEFT JOIN app.api_network_explorer_mv mv');
    expect(join).toContain('UPPER(mv.bssid) = UPPER(s.bssid)');
  });
});

describe('NetworkModule & UniversalFilterQueryBuilder Coverage Expansion', () => {
  test('no filters enabled path', () => {
    const builder = new UniversalFilterQueryBuilder({}, {});
    const listResult = builder.buildNetworkListQuery();
    const countResult = builder.buildNetworkCountQuery();

    expect(listResult.sql).toBeDefined();
    expect(countResult.sql).toBeDefined();
  });

  test('network-only fast path', () => {
    const builder = new UniversalFilterQueryBuilder(
      { ssid: 'test' },
      { ssid: true },
      { mode: 'list' }
    );
    const result = builder.buildNetworkListQuery();
    expect(result.sql).toBeDefined();
    expect(result.sql).toContain('FROM app.api_network_explorer_mv ne');
  });

  test('perfTracker path', () => {
    const perfTracker = {
      setPath: jest.fn(),
      addAppliedFilter: jest.fn(),
      addIgnoredFilter: jest.fn(),
      addWarning: jest.fn(),
    };
    const builder = new UniversalFilterQueryBuilder(
      { ssid: 'test' },
      { ssid: true },
      { trackPerformance: true }
    ) as any;

    // Inject mock perfTracker into context
    builder.ctx.perfTracker = perfTracker;

    builder.buildNetworkListQuery();
    expect(perfTracker.setPath).toHaveBeenCalledWith('fast');

    const slowBuilder = new UniversalFilterQueryBuilder(
      { observationCountMin: 5, timeframe: { type: 'relative', relativeWindow: '7d' } },
      { observationCountMin: true, timeframe: true },
      { trackPerformance: true }
    ) as any;
    slowBuilder.ctx.perfTracker = perfTracker;
    slowBuilder.buildNetworkListQuery();
    expect(perfTracker.setPath).toHaveBeenCalledWith('slow');
  });

  test('buildThreatSeverityCountsQuery and buildDashboardMetricsQuery', () => {
    const builder = new UniversalFilterQueryBuilder({}, {});
    const threatCounts = builder.buildThreatSeverityCountsQuery();
    const dashboardMetrics = builder.buildDashboardMetricsQuery();

    expect(threatCounts.sql).toBeDefined();
    expect(dashboardMetrics.sql).toBeDefined();
  });

  test('buildObservationFilters and buildFilteredObservationsCte', () => {
    const builder = new UniversalFilterQueryBuilder({}, {});
    const filters = builder.buildObservationFilters();
    const cte = builder.buildFilteredObservationsCte();

    expect(filters).toBeDefined();
    expect(cte.cte).toBeDefined();
  });

  test('geospatial count query', () => {
    const builder = new UniversalFilterQueryBuilder({}, {});
    const result = builder.buildGeospatialCountQuery();
    expect(result.sql).toBeDefined();
  });

  test('analytics queries', () => {
    const builder = new UniversalFilterQueryBuilder({}, {});
    const queries = builder.buildAnalyticsQueries();
    const mvQueries = builder.buildAnalyticsQueriesFromMV();

    expect(queries).toBeDefined();
    expect(mvQueries).toBeDefined();
  });

  test('metadata helpers', () => {
    const builder = new UniversalFilterQueryBuilder({ ssid: 'test' }, { ssid: true });
    builder.buildNetworkListQuery(); // Populate applied filters
    expect(builder.getParams()).toBeDefined();
    expect(builder.getAppliedFilters()).toBeDefined();
    expect(builder.getAppliedCount()).toBeGreaterThan(0);
    expect(builder.getValidationErrors()).toBeDefined();
    expect(builder.buildNetworkWhere()).toBeDefined();
  });
});
