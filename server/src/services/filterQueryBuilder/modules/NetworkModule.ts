import { NetworkListQueryBuilder } from '../builders/NetworkListQueryBuilder';
import { NetworkOnlyQueryBuilder } from '../builders/NetworkOnlyQueryBuilder';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { QueryResult, FilteredQueryResult, CteResult, NetworkListOptions } from '../types';
import { buildNetworkOnlyCountQuery, buildNetworkOnlyQueryImpl } from './networkFastPathBuilder';
import {
  buildNetworkSlowPathCountQuery,
  buildNetworkSlowPathListQuery,
} from './networkSlowPathBuilder';
import {
  buildNetworkDashboardMetricsQuery,
  buildThreatSeverityCountsQuery,
} from './networkMetricsBuilder';
import {
  buildNetworkNoFilterCountQuery,
  buildNetworkNoFilterListQuery,
} from './networkNoFilterBuilder';

export class NetworkModule {
  constructor(
    private ctx: FilterBuildContext,
    private getFilteredObservationsCte: () => CteResult
  ) {}

  public buildNetworkListQuery(options: NetworkListOptions = {}): FilteredQueryResult {
    const builder = new NetworkListQueryBuilder(this.ctx.context as any, () =>
      this.buildNetworkListQueryImpl(options)
    );
    return builder.build();
  }

  private buildNetworkListQueryImpl(options: NetworkListOptions = {}): FilteredQueryResult {
    const { limit = undefined, offset = 0, orderBy = 'last_observed_at DESC' } = options;

    this.ctx.requiresHome = true;

    const noFiltersEnabled = Object.values(this.ctx.enabled).every((value) => !value);
    if (noFiltersEnabled) {
      return buildNetworkNoFilterListQuery(this.ctx, options);
    }

    const enabledKeys = Object.entries(this.ctx.enabled)
      .filter(([, value]) => value)
      .map(([key]) => key);
    const networkOnly = this.ctx.isFastPathEligible(enabledKeys);

    if (networkOnly) {
      if (this.ctx.perfTracker) {
        this.ctx.perfTracker.setPath('fast');
      }
      if (this.ctx.context?.mode === 'network-only') {
        return this.buildNetworkOnlyQuery({ limit, offset, orderBy });
      }
      return buildNetworkOnlyQueryImpl(this.ctx, { limit, offset, orderBy });
    }

    if (this.ctx.perfTracker) {
      this.ctx.perfTracker.setPath('slow');
    }
    return buildNetworkSlowPathListQuery(
      this.ctx,
      this.getFilteredObservationsCte.bind(this),
      options
    );
  }

  public buildNetworkOnlyQuery(options: NetworkListOptions): FilteredQueryResult {
    const builder = new NetworkOnlyQueryBuilder(this.ctx.context as any, () =>
      buildNetworkOnlyQueryImpl(this.ctx, options)
    );
    return builder.build();
  }

  public buildNetworkCountQuery(): QueryResult {
    const noFiltersEnabled = Object.values(this.ctx.enabled).every((value) => !value);
    if (noFiltersEnabled) {
      return buildNetworkNoFilterCountQuery(this.ctx);
    }

    const enabledKeys = Object.entries(this.ctx.enabled)
      .filter(([, value]) => value)
      .map(([key]) => key);
    const networkOnly = this.ctx.isFastPathEligible(enabledKeys);
    if (networkOnly) {
      return buildNetworkOnlyCountQuery(this.ctx);
    }

    // SLOW PATH
    return buildNetworkSlowPathCountQuery(this.ctx, this.getFilteredObservationsCte.bind(this));
  }

  public buildThreatSeverityCountsQuery(): QueryResult {
    return buildThreatSeverityCountsQuery(this.ctx, this.getFilteredObservationsCte.bind(this));
  }

  public buildDashboardMetricsQuery(): QueryResult {
    return buildNetworkDashboardMetricsQuery(this.ctx, this.getFilteredObservationsCte.bind(this));
  }
}
