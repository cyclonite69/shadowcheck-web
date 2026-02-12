/**
 * Filter Query Builder Index
 *
 * Modular query builders organized by domain responsibility:
 *
 * ## Module Structure
 *
 * The UniversalFilterQueryBuilder class contains logically separated concerns:
 *
 * ### Observation Filters (buildObservationFilters, buildFilteredObservationsCte)
 * - Constructs WHERE clauses for filtering observations
 * - Handles identity, radio, security, temporal, and spatial filters
 * - Returns observation-level filtering results
 *
 * ### Network Queries (buildNetworkListQuery, buildNetworkWhere, buildNetworkCountQuery)
 * - Builds complete network data retrieval queries
 * - Network-only queries for simple filters
 * - Full CTE queries with observation rollup
 *
 * ### Geospatial Queries (buildGeospatialQuery, buildGeospatialCountQuery)
 * - Constructs geospatial filter predicates using PostGIS
 * - Bounding box, radius, and distance filters
 * - Optimized queries for visualization endpoints
 *
 * ### Analytics Queries (buildAnalyticsQueries, buildAnalyticsQueriesFromMV)
 * - Constructs analytics and aggregation queries
 * - Time series, threat distribution, network type counts
 * - Materialized view fast path for simple queries
 *
 * ## Usage
 *
 * ```typescript
 * import { UniversalFilterQueryBuilder } from './filterQueryBuilder';
 *
 * const builder = new UniversalFilterQueryBuilder(filters, enabled);
 * const result = builder.buildNetworkListQuery({ limit: 100 });
 * ```
 */

import { UniversalFilterQueryBuilder } from './universalFilterQueryBuilder';
import { validateFilterPayload } from './validators';
import { DEFAULT_ENABLED } from './constants';

// Main class export
export { UniversalFilterQueryBuilder, validateFilterPayload, DEFAULT_ENABLED };

// Re-export types for consumers
export type {
  Filters,
  EnabledFlags,
  AppliedFilter,
  IgnoredFilter,
  QueryResult,
  FilteredQueryResult,
  ValidationResult,
  BoundingBox,
  RadiusFilter,
  Timeframe,
  AnalyticsQueries,
  NetworkListOptions,
  GeospatialOptions,
  AnalyticsOptions,
  CteResult,
  ObservationFiltersResult,
} from './types';

export type { FilterKey } from './constants';

// Re-export utilities
export { isOui, coerceOui } from './normalizers';
export * from './sqlExpressions';
