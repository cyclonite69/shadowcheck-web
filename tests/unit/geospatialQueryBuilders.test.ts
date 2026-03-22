export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { buildGeospatialQueryContext } from '../../server/src/services/filterQueryBuilder/modules/geospatialQueryContext';
import {
  buildGeospatialCountQuery,
  buildGeospatialListQuery,
} from '../../server/src/services/filterQueryBuilder/modules/geospatialQueryBuilders';

describe('geospatial query builders', () => {
  test('context builder carries network filters and pagination params', () => {
    const ctx = new FilterBuildContext(
      { threatCategories: ['high'] },
      { threatCategories: true }
    );

    const context = buildGeospatialQueryContext(
      ctx,
      { cte: 'WITH filtered_obs AS (SELECT * FROM app.observations o)', params: [] },
      { limit: 25, offset: 10 }
    );

    expect(context.networkWhere).toHaveLength(1);
    expect(context.networkWhere[0]).toContain('ne.threat_level = ANY(');
    expect(context.limitClause).toBe('LIMIT $2 OFFSET $3');
    expect(context.params).toEqual([['HIGH'], 25, 10]);
  });

  test('list builder uses rollup path when network filters exist', () => {
    const ctx = new FilterBuildContext(
      { threatCategories: ['high'] },
      { threatCategories: true }
    );
    const context = buildGeospatialQueryContext(
      ctx,
      { cte: 'WITH filtered_obs AS (SELECT * FROM app.observations o)', params: [] }
    );

    const result = buildGeospatialListQuery(ctx, context);

    expect(result.sql).toContain('JOIN rollup r');
    expect(result.sql).toContain('WHERE ne.threat_level = ANY(');
    expect(result.params).toEqual([['HIGH']]);
  });

  test('count builder combines geospatial validity and network predicates in one WHERE clause', () => {
    const ctx = new FilterBuildContext(
      { threatCategories: ['critical'] },
      { threatCategories: true }
    );
    const context = buildGeospatialQueryContext(
      ctx,
      { cte: 'WITH filtered_obs AS (SELECT * FROM app.observations o)', params: [] }
    );

    const result = buildGeospatialCountQuery(ctx, context);

    expect((result.sql.match(/\bWHERE\b/g) || []).length).toBe(1);
    expect(result.sql).toContain('ne.threat_level = ANY(');
    expect(result.sql).toContain('AND ((o.lat IS NOT NULL AND o.lon IS NOT NULL) OR o.geom IS NOT NULL)');
  });
});
