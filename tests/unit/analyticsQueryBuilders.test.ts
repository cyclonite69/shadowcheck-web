export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { buildAnalyticsQueryContext } from '../../server/src/services/filterQueryBuilder/modules/analyticsQueryContext';
import {
  buildAnalyticsQueriesFromContext,
  buildAnalyticsQueriesFromMaterializedView,
} from '../../server/src/services/filterQueryBuilder/modules/analyticsQueryBuilders';

describe('analytics query builders', () => {
  test('context builder switches source table and carries network filters into base CTEs', () => {
    const ctx = new FilterBuildContext(
      { threatCategories: ['critical'] },
      { threatCategories: true }
    );

    const context = buildAnalyticsQueryContext(
      ctx,
      {
        cte: 'WITH filtered_obs AS (SELECT * FROM app.observations o)',
        params: [],
      },
      { useLatestPerBssid: true }
    );

    expect(context.sourceTable).toBe('network_set');
    expect(context.baseCtes).toContain('network_set AS');
    expect(context.baseCtes).toContain('ne.threat_level = ANY(');
    expect(context.typeExpr).toContain('network_set');
    expect(context.params).toEqual([['CRITICAL']]);
  });

  test('query builder uses filtered_obs CTE for temporal queries and network_set for rollups', () => {
    const queries = buildAnalyticsQueriesFromContext({
      baseCtes: 'WITH filtered_obs AS (SELECT 1), network_set AS (SELECT 1 AS bssid, 1 AS observation_count, NOW() AS observed_at, NULL AS ssid)',
      filteredObsCte: 'WITH filtered_obs AS (SELECT * FROM app.observations o)',
      params: ['p1'],
      sourceTable: 'network_set',
      typeExpr: 'network_set.radio_type',
      securityExpr: 'network_set.security',
    });

    expect(queries.networkTypes.sql).toContain('FROM network_set');
    expect(queries.temporalActivity.sql).toContain('FROM filtered_obs');
    expect(queries.radioTypeOverTime.sql).toContain('FROM filtered_obs o');
    expect(queries.networkTypes.params).toEqual(['p1']);
  });

  test('materialized view builder keeps zero-value placeholder analytics queries', () => {
    const queries = buildAnalyticsQueriesFromMaterializedView();

    expect(queries.networkTypes.sql).toContain('app.analytics_summary_mv');
    expect(queries.temporalActivity.sql).toBe('SELECT NOW() as period, 0 as count');
    expect(queries.topNetworks.sql).toContain('app.api_network_explorer_mv');
  });
});
