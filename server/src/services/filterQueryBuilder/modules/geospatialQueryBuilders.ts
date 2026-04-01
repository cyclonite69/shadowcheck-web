import type { FilteredQueryResult } from '../types';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { GeospatialQueryContext } from './geospatialQueryContext';

function buildGeospatialMetadata(ctx: FilterBuildContext) {
  return {
    params: ctx.getParams(),
    appliedFilters: ctx.state.appliedFilters(),
    ignoredFilters: ctx.state.ignoredFilters(),
    warnings: ctx.state.warnings(),
  };
}

export function buildGeospatialListQuery(
  ctx: FilterBuildContext,
  context: GeospatialQueryContext
): FilteredQueryResult {
  const { cte, networkWhere, selectClause, limitClause } = context;

  if (networkWhere.length === 0) {
    return {
      sql: `
        ${cte}
        SELECT
          ${selectClause}
        FROM filtered_obs o
        LEFT JOIN app.api_network_explorer_mv ne ON ne.bssid = o.bssid
        LEFT JOIN app.network_locations nl ON nl.bssid = o.bssid
        ORDER BY o.time DESC
        ${limitClause}
      `,
      ...buildGeospatialMetadata(ctx),
    };
  }

  return {
    sql: `
      ${cte}
      , rollup AS (
        SELECT bssid FROM filtered_obs GROUP BY bssid
      )
      SELECT
        ${selectClause}
      FROM filtered_obs o
      JOIN rollup r ON r.bssid = o.bssid
      LEFT JOIN app.api_network_explorer_mv ne ON ne.bssid = o.bssid
      LEFT JOIN app.network_locations nl ON nl.bssid = o.bssid
      WHERE ${networkWhere.join(' AND ')}
      ORDER BY o.time DESC
      ${limitClause}
    `,
    ...buildGeospatialMetadata(ctx),
  };
}

export function buildGeospatialCountQuery(
  ctx: FilterBuildContext,
  context: GeospatialQueryContext
): FilteredQueryResult {
  const { cte, networkWhere } = context;
  const predicates = [
    ...networkWhere,
    '((o.lat IS NOT NULL AND o.lon IS NOT NULL) OR o.geom IS NOT NULL)',
  ];

  return {
    sql: `
      ${cte}
      , rollup AS (
        SELECT bssid FROM filtered_obs GROUP BY bssid
      )
      SELECT COUNT(*) as total
      FROM filtered_obs o
      JOIN rollup r ON r.bssid = o.bssid
      LEFT JOIN app.api_network_explorer_mv ne ON ne.bssid = o.bssid
      WHERE ${predicates.join('\n        AND ')}
    `,
    ...buildGeospatialMetadata(ctx),
  };
}
