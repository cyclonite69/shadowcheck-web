import type { FilterBuildContext } from '../FilterBuildContext';
import type { CteResult, AnalyticsOptions, AnalyticsQueries } from '../types';
import { buildAnalyticsQueryContext } from './analyticsQueryContext';
import {
  buildAnalyticsQueriesFromContext,
  buildAnalyticsQueriesFromMaterializedView,
} from './analyticsQueryBuilders';

export class AnalyticsModule {
  constructor(
    private ctx: FilterBuildContext,
    private getFilteredObservationsCte: () => CteResult
  ) {}

  public buildAnalyticsQueries(options: AnalyticsOptions = {}): AnalyticsQueries {
    const context = buildAnalyticsQueryContext(this.ctx, this.getFilteredObservationsCte(), options);
    return buildAnalyticsQueriesFromContext(context);
  }

  public buildAnalyticsQueriesFromMV(): AnalyticsQueries {
    return buildAnalyticsQueriesFromMaterializedView();
  }
}
