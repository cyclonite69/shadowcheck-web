/**
 * Universal Filter Query Builder
 *
 * Facade for specialized query building modules.
 * Orchestrates filtering logic across observation, network, geospatial, and analytics domains.
 *
 * @see ./modules/ for implementation details.
 */

import { FilterBuildContext } from './FilterBuildContext';
import { ObservationModule } from './modules/ObservationModule';
import { NetworkModule } from './modules/NetworkModule';
import { GeospatialModule } from './modules/GeospatialModule';
import { AnalyticsModule } from './modules/AnalyticsModule';

import type {
  QueryResult,
  FilteredQueryResult,
  CteResult,
  ObservationFiltersResult,
  NetworkListOptions,
  GeospatialOptions,
  AnalyticsOptions,
  AnalyticsQueries,
  AppliedFilter,
} from './types';

export class UniversalFilterQueryBuilder {
  private ctx: FilterBuildContext;
  private observationModule: ObservationModule;
  private networkModule: NetworkModule;
  private geospatialModule: GeospatialModule;
  private analyticsModule: AnalyticsModule;

  constructor(
    filters: unknown,
    enabled: unknown,
    context?: {
      pageType?: 'geospatial' | 'wigle';
      mode?: 'network-only' | 'list' | 'geospatial' | 'analytics';
      alias?: string;
      trackPerformance?: boolean;
    }
  ) {
    this.ctx = new FilterBuildContext(filters, enabled, context as any);

    // Wire up modules with shared context
    this.observationModule = new ObservationModule(this.ctx);

    this.networkModule = new NetworkModule(this.ctx, () =>
      this.observationModule.buildFilteredObservationsCte()
    );

    this.geospatialModule = new GeospatialModule(this.ctx, (opts) =>
      this.observationModule.buildFilteredObservationsCte(opts)
    );

    this.analyticsModule = new AnalyticsModule(this.ctx, () =>
      this.observationModule.buildFilteredObservationsCte()
    );
  }

  // PUBLIC API - Observation Filters

  public buildObservationFilters(): ObservationFiltersResult {
    return this.observationModule.buildObservationFilters();
  }

  public buildFilteredObservationsCte(options?: { selectedBssids?: string[] }): CteResult {
    return this.observationModule.buildFilteredObservationsCte(options);
  }

  // PUBLIC API - Network Queries

  public buildNetworkListQuery(options: NetworkListOptions = {}): FilteredQueryResult {
    return this.networkModule.buildNetworkListQuery(options);
  }

  public buildNetworkCountQuery(): QueryResult {
    return this.networkModule.buildNetworkCountQuery();
  }

  public buildThreatSeverityCountsQuery(): QueryResult {
    return this.networkModule.buildThreatSeverityCountsQuery();
  }

  public buildDashboardMetricsQuery(): QueryResult {
    return this.networkModule.buildDashboardMetricsQuery();
  }

  // PUBLIC API - Geospatial Queries

  public buildGeospatialQuery(options: GeospatialOptions = {}): FilteredQueryResult {
    return this.geospatialModule.buildGeospatialQuery(options);
  }

  public buildGeospatialCountQuery(): FilteredQueryResult {
    return this.geospatialModule.buildGeospatialCountQuery();
  }

  // PUBLIC API - Analytics Queries

  public buildAnalyticsQueries(options: AnalyticsOptions = {}): AnalyticsQueries {
    return this.analyticsModule.buildAnalyticsQueries(options);
  }

  public buildAnalyticsQueriesFromMV(): AnalyticsQueries {
    return this.analyticsModule.buildAnalyticsQueriesFromMV();
  }

  // Shared Query Logic (Delegated to Context)

  public buildNetworkWhere(): string[] {
    return this.ctx.buildNetworkWhere();
  }

  // Metadata Helpers

  public getParams(): unknown[] {
    return this.ctx.getParams();
  }

  public getAppliedFilters(): AppliedFilter[] {
    return this.ctx.getAppliedFilters();
  }

  public getAppliedCount(): number {
    return this.ctx.getAppliedCount();
  }

  public getValidationErrors(): string[] {
    return this.ctx.getValidationErrors();
  }
}
